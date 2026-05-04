# 🛍️ AI Order Assistant + Interior Inspiration Engine

Asystent AI dla sklepu home decor, który łączy:
- obsługę zamówień (status, dostawa, zwroty, reklamacje)
- dynamiczne inspiracje wnętrzarskie
- generowanie wizualizacji aranżacji
- prosty mechanizm RAG (regulamin sklepu)

---

# 🎯 Cel projektu

Celem systemu jest:
- odciążenie supportu klienta  
- zwiększenie sprzedaży przez inspiracje (upsell)  
- poprawa doświadczenia użytkownika  
- demonstracja wykorzystania AI w e-commerce  

---

# ⚙️ Funkcjonalności

## 📦 Obsługa zamówień
- sprawdzanie statusu zamówienia
- informacje o dostawie
- obsługa zwrotów i reklamacji (RAG)

## 💡 Inspiracje wnętrz
- dopasowanie produktów do zamówienia
- logiczne aranżacje (np. poduszka → sofa)
- powiązanie stylistyczne (kolor, styl)

## 🛒 Rekomendacje produktów
- prosty scoring (styl + kolor)
- max 1 produkt na inspirację
- automatyczne renderowanie kart produktu w UI

## 🎨 Wizualizacje
- generowanie obrazu na podstawie inspiracji
- realistyczne sceny wnętrz
- trigger przez UI (button)

## 📚 Mini RAG (regulamin)
- dynamiczne dopasowanie zasad sklepu
- brak hardcodowania w promptach
- łatwa rozbudowa przez rules.json

---

# 🧠 Jak działa system (flow)

User → Chat API
      → RAG (rules.json)
      → OpenAI (intent detection)
          → function_call (get_order_details)
              → Order API (mock / SnapLogic)
      → matching produktów
      → OpenAI (final response)
      → UI (HTML + produkty + CTA)
      → (opcjonalnie) generacja obrazu

---

# 🔄 Proces biznesowy (skrót)

1. Użytkownik zadaje pytanie lub podaje numer zamówienia  
2. System identyfikuje intencję (AI)  
3. Jeśli potrzebne → pobiera dane zamówienia  
4. Dobiera produkty pasujące stylistycznie  
5. Generuje odpowiedź:
   - status zamówienia
   - dostawa
   - inspiracja (jeśli możliwa)  
6. Dodaje CTA do wizualizacji  
7. Po kliknięciu → generuje obraz aranżacji  

---

# 🧩 Architektura

## Backend (Node.js / Express)

- routes/chat.js → główny flow rozmowy  
- services/ → logika biznesowa  
- utils/ → helpery  
- data/ → produkty + rules  
- tools/ → generatory danych  

---

## 📁 Struktura projektu

project/
├── routes/
│   └── chat.js
│
├── services/
│   ├── openaiService.js
│   ├── orderService.js
│   ├── ragService.js
│   └── imageService.js
│
├── utils/
│   ├── matchProducts.js
│   └── messages.js
│
├── data/
│   ├── products.json
│   └── rules.json
│
├── tools/
│   ├── productsGenerator.js
│   └── ordersGenerator.js
│
├── public/
│   └── index.html
│
└── server.js

---

# 🧰 Technologie

- Node.js + Express  
- OpenAI API:
  - gpt-4.1 (chat + reasoning)
  - gpt-image-1 (wizualizacje)
- Fetch API (SnapLogic / mock)
- Vanilla JS frontend  

---

# 🧪 Tools (folder /tools)

## 🛍️ productsGenerator.js
Generuje produkty na podstawie zdjęć:
- opis produktu
- styl
- kolor
- kategoria

👉 używane do budowy katalogu produktów

---

## 📦 ordersGenerator.js
Generuje mockowe zamówienia:
- statusy (paid, cancelled, shipped)
- produkty
- dane dostawy

👉 używane do testów i demo

---

# 📚 RAG (rules.json)

Przykład:

{
  "keywords": ["zwrot"],
  "content": "Zwrot możliwy do 60 dni..."
}

System:
- dopasowuje keywords
- wstrzykuje do prompta
- AI odpowiada zgodnie z regulaminem

---

# 🎨 Mechanizm wizualizacji

1. Użytkownik klika button  
2. UI wysyła:
txt __SHOW_VISUALIZATION__ 

3. Backend:
- bierze ostatnią odpowiedź bota
- generuje prompt
- wywołuje OpenAI Images

4. Zwraca obraz

---

# ⚠️ Ważne zasady biznesowe

- brak inspiracji dla zamówień anulowanych  
- max 1 produkt w inspiracji  
- inspiracja musi nawiązywać do zamówienia  
- produkty muszą być logicznie użyte  

---

# 🚀 Uruchomienie

bash npm install npm run dev 

.env:

env OPENAI_API_KEY=your_key SNAPLOGIC_TOKEN=your_token ENABLE_IMAGES=true 

---

# 📈 Możliwe rozszerzenia

- personalizacja użytkownika  
- ranking ML produktów  
- zapis inspiracji  
- multi-room visualization  
- streaming odpowiedzi  

---

# 🤝 Autor

Projekt demonstracyjny pokazujący wykorzystanie AI w e-commerce:
- conversational commerce
- AI-driven recommendations
- generative UI + images

---

# 📄 Licencja

MIT / demo proj
