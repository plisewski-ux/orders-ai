import express from "express";
import OpenAI from "openai";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const ENABLE_IMAGES = process.env.ENABLE_IMAGES === "true";
const rules = JSON.parse(fs.readFileSync("./rules.json", "utf-8"));
const app = express();

app.use(express.json());
app.use(cors());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 📦 produkty
const products = JSON.parse(
  fs.readFileSync("./products.json", "utf-8")
);

function getRelevantRules(userMessage) {
  const text = userMessage.toLowerCase();

  return rules
    .filter(rule =>
      rule.keywords.some(k => text.includes(k))
    )
    .map(r => r.content)
    .join("\n");
}

// 🧠 pamięć
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
ZASADY ARANŻACJI:
--------------------------------

- produkty muszą być umieszczone w logicznych miejscach
- nie łącz produktów w sposób nielogiczny (np. wazon na sofie)
- wazon → stół, komoda, półka
- poduszka → sofa, fotel, łóżko
- kubek / miska → stół, blat, półka
- dekoracje → półka, komoda, ściana

- jeśli produkty są z różnych kategorii:
  → opisz je jako osobne elementy aranżacji
  → NIE mieszaj ich w jednym miejscu

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




    `
  }
];

// =========================
// 🧠 MATCHING PRODUKTÓW
// =========================
function matchProducts(orderItems, allProducts) {
  const styles = orderItems.map(i => i.style);
  const colors = orderItems.map(i => i.color);

  return allProducts
    .filter(p => !orderItems.find(i => i.id === p.id))
    .map(p => {
      let score = 0;

      if (styles.includes(p.style)) score += 2;
      if (colors.includes(p.color)) score += 1;

      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 1);
}

// =========================
// 🧠 wykrywanie wizualizacji
// =========================
function wantsImage(text) {

  return text === "__SHOW_VISUALIZATION__";

}

function ensureVisualizationCTA(reply) {
  const hasInspiration = reply.includes("💡 Inspiracja");
  const hasCTA = reply.includes("🎨");

  if (hasInspiration && !hasCTA) {
    return reply + `
<div>🎨 Chcesz zobaczyć wizualizację tej aranżacji?</div>
`;
  }

  return reply;
}

function getLastBotMessage() {
  return [...messages]
    .reverse()
    .find(m => m.role === "assistant")?.content;
}

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const rulesContext = getRelevantRules(userMessage);
    const isVisualization = wantsImage(userMessage);

// ❗ NIE dodawaj do historii jeśli to akcja UI
if (!isVisualization) {
  messages.push({ role: "user", content: userMessage });
}

    const generateImage = ENABLE_IMAGES && wantsImage(userMessage);

    // =========================
    // 🎨 GENEROWANIE OBRAZU
    // =========================
    if (generateImage) {
      const lastBotMessage = getLastBotMessage();

      if (!lastBotMessage) {
        return res.json({
          reply: "Najpierw zapytaj o inspirację 🙂"
        });
      }

      const promptRes = await openai.responses.create({
        model: "gpt-4.1",
        input: `
Na podstawie tej inspiracji stwórz prompt do realistycznej aranżacji wnętrza:

${lastBotMessage}

Zasady:
- realistyczne
- katalog wnętrzarski
- miękkie światło
- bez ludzi
`
      });

      const imagePrompt = promptRes.output_text;

      const image = await openai.images.generate({
        model: "gpt-image-1",
        prompt: imagePrompt,
        size: "1024x1024"
      });

      const imageUrl =
        image.data[0].url ||
        `data:image/png;base64,${image.data[0].b64_json}`;

      return res.json({
        reply: `
<div><strong>🎨 Wizualizacja</strong></div>
<div>Tak może wyglądać Twoja aranżacja:</div>
`,
        image: imageUrl
      });
    }

    // =========================
    // 🧠 AI RESPONSE
    // =========================
    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: [
      ...messages,
      ...(rulesContext
        ? [{
            role: "system",
            content: `Zasady sklepu:\n${rulesContext}`
          }]
        : [])
],
      tools: [
        {
          type: "function",
          name: "get_order_details",
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

    const output = response.output?.[0];
    if (!output) {
      return res.json({ reply: "Nie mogę teraz odpowiedzieć." });
    }

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
          body: JSON.stringify({ OredrID: order_id })
        }
      );

      const data = await apiRes.json();

      if (!data || !data[0]) {
        return res.json({
          reply: `
<div><strong>🔍 Nie widzę takiego zamówienia</strong></div>
<div>Sprawdź numer zamówienia 🙂</div>
`
        });
      }

      const order = data[0];
      const isCancelled = order.OrderStatus === "cancelled";

      // 🔥 MATCHING
      let suggestions = [];

      if (!isCancelled) {
      suggestions = matchProducts(order.Items || [], products);
      }

      // 🔥 kontekst dla AI
      const productContext = suggestions
        .map(p => `${p.id} - ${p.name}`)
        .join("\n");

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

      const orderContext = (order.Items || [])
      .map(p => `${p.name} (${p.category}, ${p.style}, ${p.color})`)
      .join("\n");

      const final = await openai.responses.create({
        model: "gpt-4.1",
        input: [
          ...messages,
          output,
          toolResponse,
          {
            role: "system",
            content: `
Produkty z zamówienia:
${orderContext}

Dostępne produkty do inspiracji:
${productContext}

STATUS ZAMÓWIENIA: ${order.OrderStatus}

ZASADY:
- jeśli status to "cancelled":
  → NIE twórz sekcji "💡 Inspiracja"
- MUSISZ nawiązać do produktu z zamówienia
- pokaż jak nowy produkt uzupełnia produkt z zamówienia
- użyj języka typu:
  "Do [produkt z zamówienia] dobrze pasuje..."
  "Świetnie uzupełni..."
  "Możesz zestawić z..."

- wybierz MAKSYMALNIE 1 produkt z listy
- MUSISZ wspomnieć dokładnie ten produkt
- NIE wymyślaj innych produktów

- zachowaj logikę aranżacji:
  - poduszka → sofa/łóżko
  - kubek → stół/kuchnia
  - dekoracja → półka/komoda

- jeśli proponujesz produkt → dodaj:
<div data-product-id="ID"></div>
`
          }
        ]
      });

      let reply =
  final.output?.[0]?.content?.[0]?.text ||
  "Nie udało się wygenerować odpowiedzi.";

// 🔥 TU DODAJEMY CTA
reply = ensureVisualizationCTA(reply);

messages.push({ role: "assistant", content: reply });

return res.json({
  reply,
  products: suggestions
});
    }

    // =========================
    // 💬 NORMAL RESPONSE
    // =========================
    const reply =
      output.content?.[0]?.text ||
      "Możesz podać numer zamówienia 🙂";

    messages.push({ role: "assistant", content: reply });

    return res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      reply: "Wystąpił błąd serwera."
    });
  }
});

// =========================
// 🌐 STATIC
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server działa na porcie", PORT);
});