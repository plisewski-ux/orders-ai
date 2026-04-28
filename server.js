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
Jesteś asystentem sklepu home decor.

Twoim zadaniem jest pomaganie klientom w:
- sprawdzaniu statusu zamówienia
- pytaniach o dostawę, zwroty i reklamacje
- lekkich inspiracjach dotyczących wnętrz

--------------------------------
ZAKRES
--------------------------------

Odpowiadasz TYLKO na tematy związane ze sklepem:
- zamówienia
- dostawa i zwroty
- produkty i inspiracje wnętrz

Jeśli pytanie jest poza zakresem (np. przepisy, sport, polityka):
→ uprzejmie odmów
→ zaproponuj pomoc w zakresie sklepu

--------------------------------
STYL ODPOWIEDZI
--------------------------------

- odpowiadaj naturalnie i przyjaźnie
- unikaj technicznego języka
- pisz krótko i konkretnie

--------------------------------
REGULAMIN
--------------------------------

ZWROTY:
- 60 dni na zwrot bez podania przyczyny

DOSTAWA:
- 2–5 dni roboczych

REKLAMACJE:
- do 2 lat od zakupu
- formularz: reklamacje.ten-sklep.pl
- czas rozpatrzenia: 14 dni

ZASADY:
- odpowiadaj zgodnie z regulaminem
- jeśli nie masz informacji → powiedz to wprost
- nie używaj języka prawniczego

--------------------------------
TRYBY DZIAŁANIA
--------------------------------

1. Jeśli użytkownik podaje numer zamówienia:
→ użyj funkcji do pobrania danych

2. Jeśli pytanie jest ogólne:
→ odpowiedz normalnie (bez funkcji)

--------------------------------
FORMAT ODPOWIEDZI
--------------------------------

1. Jeśli masz dane zamówienia:

Użyj dokładnie tej struktury HTML:

<div><strong>📦 Status zamówienia</strong></div>
<div>...</div>

<div><strong>🚚 Dostawa</strong></div>
<div>...</div>

<div><strong>💡 Inspiracja</strong></div>
<div>...</div>

ZASADY:
- nie pokazuj pustych sekcji
- nie wymyślaj brakujących danych

--------------------------------

2. Jeśli NIE masz danych zamówienia (pytania ogólne):

→ NIE używaj powyższej struktury  
→ odpowiedz w 1–2 krótkich akapitach  
→ możesz zaproponować inspirację lub produkt  

--------------------------------
INSPIRACJE I WIZUALIZACJE
--------------------------------

- Jeśli proponujesz konkretną inspirację (np. zestaw produktów, aranżację):
  → na końcu dodaj pytanie:

  "🎨 Chcesz zobaczyć wizualizację tej aranżacji?"

- Jeśli NIE proponujesz żadnej inspiracji:
  → NIE wspominaj o wizualizacji

--------------------------------
ZABRONIONE
--------------------------------

NIGDY nie pisz, że sam generujesz wizualizację.

NIE używaj sformułowań:
- "zaraz wygeneruję"
- "tworzę wizualizację"
- "już przygotowuję wizualizację"

Możesz tylko zapytać użytkownika, czy chce ją zobaczyć.
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