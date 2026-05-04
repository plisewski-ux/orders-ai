import express from "express";
import OpenAI from "openai";

import { getRelevantRules } from "../services/ragService.js";
import { getOrder } from "../services/orderService.js";
import { generateImage } from "../services/imageService.js";
import { createInitialResponse, createFinalResponse } from "../services/openaiService.js";

import { matchProducts } from "../utils/matchProducts.js";
import { ensureVisualizationCTA, getLastBotMessage } from "../utils/messages.js";

import fs from "fs";

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ENABLE_IMAGES = process.env.ENABLE_IMAGES === "true";
const products = JSON.parse(fs.readFileSync("./data/products.json", "utf-8"));

// ⚠️ globalna pamięć (MVP only)
let messages = [
  {
    role: "system",
    content: `Jesteś asystentem sklepu home decor. Pomagasz w zamówieniach, dostawie, zwrotach i inspiracjach.`
  }
];

router.post("/", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const isVisualization = userMessage === "__SHOW_VISUALIZATION__";

    // 📩 zapis user message
    if (!isVisualization) {
      messages.push({ role: "user", content: userMessage });
    }

    // =========================
    // 🎨 GENEROWANIE OBRAZU
    // =========================
    if (ENABLE_IMAGES && isVisualization) {
      const last = getLastBotMessage(messages);

      if (!last) {
        return res.json({ reply: "Najpierw zapytaj o inspirację 🙂" });
      }

      const imageUrl = await generateImage(openai, last);

      return res.json({
        reply: `<div><strong>🎨 Wizualizacja</strong></div><div>Tak może wyglądać Twoja aranżacja:</div>`,
        image: imageUrl
      });
    }

    // =========================
    // 📚 RAG
    // =========================
    const rulesContext = getRelevantRules(userMessage);

    // =========================
    // 🤖 FIRST CALL
    // =========================
    const response = await createInitialResponse(openai, messages, rulesContext);

    const functionCall = response.output.find(
      o => o.type === "function_call" && o.call_id
    );

    // 💬 brak function call → zwykła odpowiedź
    if (!functionCall) {
      const msg = response.output.find(o => o.type === "message");
      const text = msg?.content?.[0]?.text || "OK";

      messages.push({ role: "assistant", content: text });
      return res.json({ reply: text });
    }

    // 🛑 guard (ważne!)
    if (!functionCall.call_id) {
      console.error("❌ Missing call_id:", functionCall);
      return res.json({ reply: "Błąd przetwarzania zamówienia." });
    }

    // =========================
    // 📦 ORDER FETCH
    // =========================
    const args = JSON.parse(functionCall.arguments);
    const order = await getOrder(args.order_id, process.env.SNAPLOGIC_TOKEN);

    if (!order) {
      const reply = `
<div><strong>🔍 Nie widzę takiego zamówienia</strong></div>
<div>Sprawdź numer zamówienia 🙂</div>
`;

      messages.push({ role: "assistant", content: reply });
      return res.json({ reply });
    }

    // =========================
    // 🧠 LOGIKA
    // =========================
    const isCancelled = order.OrderStatus?.toLowerCase().includes("cancel");

    let suggestions = [];
    if (!isCancelled) {
      suggestions = matchProducts(order.Items || [], products);
    }

    // =========================
    // 🤖 FINAL CALL
    // =========================
    const final = await createFinalResponse(openai, {
      messages,
      functionCall,
      order,
      suggestions
    });

    const msg = final.output.find(o => o.type === "message");
    let reply = msg?.content?.[0]?.text || "Błąd";

    // 🧱 fallback HTML
    if (!reply.includes("<div>")) {
      reply = `<div>${reply}</div>`;
    }

    // 🎨 CTA tylko jeśli jest inspiracja
    if (!isCancelled && reply.includes("💡 Inspiracja")) {
      reply = ensureVisualizationCTA(reply);
    }

    // ❌ usuń inspirację dla cancelled
    if (isCancelled) {
      reply = reply.replace(
        /<div><strong>💡 Inspiracja<\/strong><\/div>[\s\S]*?(?=<div>|$)/,
        ""
      );

      reply = reply.replace(/<div>🎨.*?<\/div>/g, "");
    }

    const productsToShow = isCancelled ? [] : suggestions;

    // 💾 zapis
    messages.push({ role: "assistant", content: reply });

    return res.json({
      reply,
      products: productsToShow
    });

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).json({ reply: "Błąd serwera" });
  }
});

export default router;