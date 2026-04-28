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

// 🧠 pamięć
let messages = [
  {
    role: "system",
    content: `
Pomagasz klientom sklepu home decor.

TRYBY:
- zamówienia → użyj funkcji
- pytania ogólne → odpowiadaj naturalnie

ZASADY:
- przy inspiracjach zapytaj:
"Chcesz, żebym wygenerował wizualizację?"

- NIE generuj obrazów automatycznie

FORMAT:
- używaj HTML <div>
`
  }
];

// 🔍 czy user chce wizualizacji
function wantsImage(text) {
  const q = text.toLowerCase();
  return (
    q.includes("wizualiz") ||
    q.includes("pokaż") ||
    q.includes("pokaz") ||
    q.includes("zdjęcie") ||
    q.includes("zdjecie")
  );
}

// 🧠 ostatnia odpowiedź bota
function getLastBotMessage() {
  return [...messages].reverse().find(m => m.role === "assistant")?.content;
}

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    console.log("➡️ USER:", userMessage);

    messages.push({ role: "user", content: userMessage });

    const generateImage = ENABLE_IMAGES && wantsImage(userMessage);

    // =========================
    // 🎨 GENEROWANIE OBRAZU
    // =========================
    if (generateImage) {
      const lastBotMessage = getLastBotMessage();

      if (!lastBotMessage) {
        return res.json({
          reply: "Najpierw opisz proszę, czego szukasz 🙂"
        });
      }

      const promptRes = await openai.responses.create({
        model: "gpt-4.1",
        input: `
Na podstawie poniższego opisu wnętrza stwórz krótki prompt do obrazu:

${lastBotMessage}

Zasady:
- realistyczne wnętrze
- styl katalog wnętrzarski
- bez ludzi
`
      });

      const imagePrompt = promptRes.output_text;

      const image = await openai.images.generate({
        model: "gpt-image-1",
        prompt: imagePrompt,
        size: "1024x1024"
      });

      let imageUrl = null;

      if (image.data[0].url) {
        imageUrl = image.data[0].url;
      } else if (image.data[0].b64_json) {
        imageUrl = `data:image/png;base64,${image.data[0].b64_json}`;
      }

      return res.json({
        reply: `
<div><strong>🎨 Wizualizacja</strong></div>
<div>Tak może wyglądać Twoja aranżacja:</div>
`,
        image: imageUrl
      });
    }

    // =========================
    // 💬 NORMAL CHAT
    // =========================

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: messages
    });

    const reply =
      response.output?.[0]?.content?.[0]?.text ||
      "Możesz zapytać o zamówienie lub inspiracje 🙂";

    messages.push({ role: "assistant", content: reply });

    return res.json({ reply });

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
  console.log("🚀 Server działa na porcie", PORT);
});