import express from "express";
import OpenAI from "openai";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const ENABLE_IMAGES = process.env.ENABLE_IMAGES === "true";

const app = express();
app.use(express.json());
app.use(cors());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 🧠 pamięć (demo)
let messages = [
  {
    role: "system",
    content: `
Pomagasz klientom sklepu home decor sprawdzić status zamówienia.

ZASADY:
- odpowiadaj naturalnie i przyjaźnie
- unikaj technicznego języka

STATUS:
- "paid" → zamówienie zostało opłacone
- "sent" → zamówienie jest w drodze 🚚
- "ready to sent" → zamówienie jest przygotowane do wysyłki 📦
- "cancelled" → zamówienie zostało anulowane

DODATKOWO:
- jeśli masz listę items:
  - wspomnij 1 produkt z zamówienia
  - zaproponuj 1 pasujący element dekoracyjny
  - nie bądź nachalny

FORMAT ODPOWIEDZI (OBOWIĄZKOWY):

Zawsze formatuj odpowiedź w HTML używając <div>.

Używaj dokładnie tego układu:

<div><strong>📦 Status zamówienia</strong></div>

<div>[1-2 zdania]</div>

<div><strong>🚚 Dostawa</strong></div>

<div>Przewoźnik: ...</div>

<div>Numer śledzenia: ...</div>

<div><strong>💡 Inspiracja</strong></div>

<div>[1-2 zdania]</div>

ZASADY:

- NIE pisz jednego bloku tekstu

- NIE pomijaj sekcji

- NIE używaj list ani markdown

- używaj tylko <div>
`
  }
];

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    console.log("➡️ USER:", userMessage);

    messages.push({ role: "user", content: userMessage });

    // 🧠 1. model decyduje co robić
    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: messages,
      tools: [
        {
          type: "function",
          name: "get_order_details",
          description: "Pobiera szczegóły zamówienia",
          parameters: {
            type: "object",
            properties: {
              order_id: { type: "string" }
            },
            required: ["order_id"]
          }
        }
      ]
    });

    const output = response.output[0];

    // 🔧 FUNCTION CALL
    if (output.type === "function_call") {
      const args = JSON.parse(output.arguments);
      const order_id = args.order_id;

      console.log("🔧 FUNCTION CALL:", order_id);

      // 📡 SnapLogic
      const apiRes = await fetch(
        "https://elastic.snaplogic.com/api/1/rest/slsched/feed/bbk_dev/Dynamics365/shared/AI_TEST_PL%20Task",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SNAPLOGIC_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            OredrID: order_id
          })
        }
      );

      const data = await apiRes.json();
      console.log("📦 SNAP RESPONSE:", data);

      if (!data || !data[0]) {
        return res.json({
          reply: `
        <div><strong>🔍 Nie widzę takiego zamówienia</strong></div>
        <div>Sprawdź proszę numer — może wkradła się literówka.</div>

        <div><strong>💡 Przy okazji</strong></div>
        <div>Jeśli szukasz inspiracji do wnętrza, chętnie coś podpowiem 🙂</div>
        `
        });
      }

      const order = data[0];

      // 🔁 TOOL RESPONSE
      const toolResponse = {
        type: "function_call_output",
        call_id: output.call_id,
        output: JSON.stringify({
          status: order.OrderStatus,
          carrier: order.Carrier,
          tracking: order.TrackingNum,
          items: order.Items
        })
      };

 // 🧠 FINAL TEXT
const final = await openai.responses.create({
  model: "gpt-4.1",
  input: [
    ...messages,
    output,
    toolResponse
  ]
});

const reply =
  final.output?.[0]?.content?.[0]?.text ||
  "Nie udało się wygenerować odpowiedzi.";

messages.push({ role: "assistant", content: reply });

// 🎨 GENEROWANIE OBRAZU (opcjonalnie)
let imageUrl = null;

if (ENABLE_IMAGES) {
  try {
    if (order.Items && order.Items.length > 0) {
      const itemsText = order.Items
        .slice(0, 3)
        .map(i => i.name)
        .join(", ");

      const imagePrompt = `
Nowoczesne wnętrze w stylu ${order.Items[0].style}.

Zawiera:
${itemsText}

Styl: realistyczny, katalog wnętrzarski, miękkie światło, bez ludzi
`;

      const image = await openai.images.generate({
        model: "gpt-image-1",
        prompt: imagePrompt,
        size: "1024x1024"
      });

      if (image.data[0].url) {
        imageUrl = image.data[0].url;
      } else if (image.data[0].b64_json) {
        imageUrl = `data:image/png;base64,${image.data[0].b64_json}`;
      }
    }
  } catch (err) {
    console.log("⚠️ image error:", err.message);
  }
}

console.log("📤 sending image:", imageUrl ? "YES" : "NO");

return res.json({
  reply,
  image: imageUrl
});

    // 💬 fallback
    const reply =
      output.content?.[0]?.text ||
      "Podaj numer zamówienia.";

    messages.push({ role: "assistant", content: reply });

    res.json({ reply });

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).json({
      reply: "Wystąpił błąd serwera."
    });
  }
});

// 🌐 static
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server działa na porcie", PORT);
});