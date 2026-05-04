import fs from "fs";

// 🔧 KONFIG
const ORDERS_COUNT = 20; // 👈 zmień ile zamówień chcesz

const STATUSES = ["paid", "sent", "ready to sent", "cancelled"];
const CARRIERS = ["INPOST", "GLS", "UPS", "POCZTA_POLSKA"];

// 📦 wczytaj produkty
const products = JSON.parse(
  fs.readFileSync("./products.json", "utf-8")
);

// 🎲 helper
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomItems(products) {
  const count = Math.floor(Math.random() * 3) + 1; // 1-3
  const shuffled = [...products].sort(() => 0.5 - Math.random());

  return shuffled.slice(0, count).map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    style: p.style,
    color: p.color
  }));
}

function generateTracking() {
  return Math.floor(Math.random() * 1e12).toString();
}

// 🧠 generator
function generateOrders(count) {
  const orders = [];

  for (let i = 1; i <= count; i++) {
    const status = getRandom(STATUSES);
    const carrier = getRandom(CARRIERS);

    const order = {
      OredrID: `HY12345${String(i).padStart(3, "0")}`,
      OrderStatus: status,
      Carrier: carrier,
      TrackingNum:
        status === "sent"
          ? generateTracking()
          : null,
      Items: getRandomItems(products)
    };

    orders.push(order);
  }

  return orders;
}

// 💾 zapis
const orders = generateOrders(ORDERS_COUNT);

fs.writeFileSync(
  "./orders.json",
  JSON.stringify(orders, null, 2),
  "utf-8"
);

console.log(`✅ Wygenerowano ${ORDERS_COUNT} zamówień`);