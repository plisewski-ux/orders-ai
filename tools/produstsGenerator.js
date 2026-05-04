import OpenAI from "openai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const IMAGES_DIR = "./images";
const OUTPUT_FILE = "./products.json";

// 🧠 helper do ID
function generateId(index) {
  return String(index).padStart(6, "0");
}

// 💰 losowa cena demo
function generatePrice(category) {
  const base = {
    "kubek": 39,
    "kieliszek": 29,
    "wazon": 89,
    "doniczka": 49,
    "obraz": 199,
    "stół": 899,
    "krzesło": 299,
    "sofa": 1999,
    "komoda": 1299
  };

  const basePrice = base[category] || 99;
  return basePrice + Math.floor(Math.random() * 50);
}

// 📸 analiza jednego zdjęcia
async function analyzeImage(imagePath) {
  const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });

  const response = await openai.responses.create({
    model: "gpt-4.1",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `
Przeanalizuj produkt na zdjęciu i zwróć JSON:

{
  "name": "",
  "category": "",
  "style": "",
  "color": "",
  "prompt": ""
}

ZASADY:
- name: przyjazna nazwa po polsku (np. "Beżowy kubek ceramiczny w stylu boho")
- category: jedno słowo (np. kubek, wazon, krzesło, sofa, obraz)
- style: jedno słowo (np. boho, modern, scandinavian, classic)
- color: główny kolor
- prompt: krótki opis produktu do generowania obrazu (bez tła, bez ludzi)
`
          },
{
  type: "input_image",
  image_url: `data:image/jpeg;base64,${imageBase64}`
}
        ]
      }
    ]
  });

  const text = response.output_text;

  try {
    return JSON.parse(text);
  } catch (e) {
    console.log("⚠️ JSON parse error, fallback:", text);
    return null;
  }
}

// 📂 główna logika
async function generateProducts() {
  const files = fs.readdirSync(IMAGES_DIR);

  const grouped = {};

  // grupowanie po ID
  files.forEach(file => {
    const match = file.match(/(produkt_\d+)_([ab])/);
    if (!match) return;

    const key = match[1];
    const type = match[2];

    if (!grouped[key]) grouped[key] = {};
    grouped[key][type] = file;
  });

  const products = [];
  let index = 1;

  for (const key of Object.keys(grouped)) {
    const item = grouped[key];

    if (!item.a || !item.b) {
      console.log("⚠️ pomijam (brak zdjęć):", key);
      continue;
    }

    console.log("🔍 analizuję:", key);

    const analysis = await analyzeImage(
      path.join(IMAGES_DIR, item.a)
    );

    if (!analysis) continue;

    const product = {
      id: generateId(index),
      name: analysis.name,
      category: analysis.category,
      style: analysis.style,
      color: analysis.color,
      prompt: analysis.prompt,
      price: generatePrice(analysis.category),
      image: item.b
    };

    products.push(product);
    index++;
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(products, null, 2));

  console.log("✅ Gotowe! Zapisano products.json");
}

generateProducts();