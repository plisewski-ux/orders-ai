🚀 Demo – instrukcja krok po kroku

🌐 1. Uruchom aplikację

👉 Wejdź na:
https://orders-ai.onrender.com

💬 2. Scenariusz 1 – status zamówienia + inspiracja

Wpisz w czacie:
HY12345005

👉 Co się stanie:

* bot pobierze zamówienie z API
* pokaże:
    * 📦 status
    * 🚚 dostawę
    * 💡 inspirację dopasowaną do produktu
* pojawi się przycisk:
    🎨 Pokaż wizualizację

    🎨 3. Generowanie wizualizacji

Kliknij: 🎨 Pokaż wizualizację

👉 Co się stanie:

* bot wygeneruje realistyczną aranżację wnętrza
* obraz powstaje na podstawie:
    * inspiracji
    * produktów
    * prompt engineeringu

❌ 4. Scenariusz 2 – anulowane zamówienie

Wpisz: HY12345001

👉 Co zobaczysz:

* 📦 status: anulowane
* ❗ brak inspiracji
* ❗ brak przycisku wizualizacji

👉 To pokazuje:
logikę biznesową (no inspiration for cancelled orders)

⸻

🔍 5. Scenariusz 3 – brak zamówienia

Wpisz: HY00000000

👉 Bot:

* nie znajdzie zamówienia
* wyświetli komunikat:

🔍 Nie widzę takiego zamówienia

📚 6. Scenariusz 4 – pytania o regulamin (RAG)

Spróbuj: ile mam czasu na zwrot?

👉 Bot:

* użyje RAG (rules.json)
* odpowie zgodnie z regulaminem:
    * 60 dni
    * 14 dni → zwrot na metodę płatności
    * ponad 14 dni → karta podarunkowa

🚚 7. Inne pytania

Możesz testować:
jak długo idzie dostawa?
jak złożyć reklamację?

👉 Bot:

* odpowiada na podstawie rules.json
* nie halucynuje (tylko dane ze sklepu)

🧪 Testowe zamówienia
Order ID        Scenariusz

HY12345005  ✅ standard + inspiracja
HY12345001  ❌ anulowane
HY00000000  🔍 brak zamówienia

🧠 Co demonstruje system

✔ AI + API
* pobieranie zamówienia (SnapLogic / mock API)

✔ RAG
* dynamiczne zasady sklepu z rules.json

✔ Product matching
* dopasowanie produktów stylistycznie

✔ Prompt engineering
* generowanie opisów aranżacji

✔ Image generation
* wizualizacja wnętrz (OpenAI Images)

✔ UX automation
* przycisk → event → generacja obrazu