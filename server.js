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
Pomagasz klientom sklepu home decor sprawdzić status zamówienia, ale mozesz sie spotkac takze z pytaniami ogolnymi.
ZAKRES ASYSTENTA:

Pomagasz tylko w:
- statusie zamówienia
- dostawie i zwrotach
- produktach i inspiracjach do wnętrz

Jeśli pytanie jest poza tym zakresem:
- uprzejmie odmów
- zaproponuj pomoc w zakresie sklepu

Nie odpowiadaj na pytania niezwiązane ze sklepem (np. przepisy kulinarne, sport, polityka).

ZASADY:
- odpowiadaj naturalnie i przyjaźnie
- unikaj technicznego języka

REGULAMIN:

ZWROTY:
- 60 dni na zwrot bez podania przyczyny

DOSTAWA:
- 2–5 dni roboczych

REKLAMACJE:
- do 2 lat on zakupu.
- formularz reklamacyjny: reklamacje.ten-sklep.pl
- czas na rozpatrzenie reklamacji 14 dni

ZASADY:

- odpowiadaj na pytania klientów zgodnie z regulaminem
- jeśli nie masz informacji → powiedz to wprost
- odpowiadaj krótko i konkretnie

TRYBY:
- jeśli użytkownik podaje numer zamówienia → użyj funkcji
- jeśli pyta ogólnie → odpowiedz normalnie (bez funkcji)

FORMAT ODPOWIEDZI:

1. Jeśli masz dane zamówienia (status, tracking):
→ użyj struktury:

<div><strong>📦 Status zamówienia</strong></div>
<div>...</div>

<div><strong>🚚 Dostawa</strong></div>
<div>...</div>

<div><strong>💡 Inspiracja</strong></div>
<div>...</div>

DODATKOWO:

- jeśli tworzysz sekcję "💡 Inspiracja":
  - NA KOŃCU dodaj:
  "🎨 Chcesz, żebym wygenerował wizualizację tej aranżacji?"

- NIE generuj obrazów samodzielnie
- wizualizacja powstaje tylko gdy użytkownik o to poprosi

2. Jeśli NIE masz danych zamówienia (pytanie ogólne, inspiracje):
→ NIE używaj powyższej struktury
→ odpowiedz naturalnie w 1–2 krótkich akapitach
→ możesz zaproponować produkty lub styl

ZASADY:
- nie wymyślaj brakujących danych (np. przewoźnika)
- nie pokazuj pustych sekcji
`
  }
];

// 🧠 wykrywanie wizualizacji
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
    // 🎨 GENEROWANIE OBRAZU NA ŻĄDANIE
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
Na podstawie poniższego opisu wnętrza stwórz prompt do realistycznego obrazu:

${lastBotMessage}

Zasady:
- styl katalog wnętrzarski
- realistyczne
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
    // 🧠 NORMAL FLOW (jak było)
    // =========================

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

    if (!response.output || !response.output[0]) {
      return res.json({ reply: "Nie mogę teraz odpowiedzieć." });
    }

    const output = response.output[0];

    // =========================
    // 🔧 FUNCTION CALL
    // =========================
    if (output.type === "function_call") {
      const args = JSON.parse(output.arguments);
      const order_id = args.order_id;

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

      if (!data || !data[0]) {
        return res.json({
          reply: `
<div><strong>🔍 Nie widzę takiego zamówienia</strong></div>
<div>Sprawdź proszę numer — może wkradła się literówka.</div>
`
        });
      }

      const order = data[0];

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

      const final = await openai.responses.create({
        model: "gpt-4.1",
        input: [...messages, output, toolResponse]
      });

      const reply =
        final.output?.[0]?.content?.[0]?.text ||
        "Nie udało się wygenerować odpowiedzi.";

      messages.push({ role: "assistant", content: reply });

      return res.json({ reply }); // ❗ brak auto image
    }

    // =========================
    // 💬 NORMAL RESPONSE
    // =========================

    const reply =
      output.content?.[0]?.text ||
      "Możesz podać numer zamówienia albo zapytać o inspiracje 🙂";

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