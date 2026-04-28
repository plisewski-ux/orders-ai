import fs from "fs";

const styles = ["skandynawskim", "loftowym", "boho", "nowoczesnym", "klasycznym"];
const categories = [
  { key: "sofa", name: "sofa" },
  { key: "table", name: "stół" },
  { key: "chair", name: "krzesło" },
  { key: "decor", name: "dekoracja" },
  { key: "lamp", name: "lampa" },
  { key: "bed", name: "łóżko" },
  { key: "rug", name: "dywan" }
];

const colors = [
  { key: "beige", name: "Beżowy" },
  { key: "black", name: "Czarny" },
  { key: "white", name: "Biały" },
  { key: "wood", name: "Drewniany" },
  { key: "grey", name: "Szary" },
  { key: "green", name: "Zielony" },
  { key: "blue", name: "Niebieski" }
];

const carriers = ["INPOST", "GLS", "UPS", "POCZTA"];
const statuses = ["paid", "sent", "ready to sent", "cancelled"];

// 📦 PRODUCTS
const products = [];

for (let i = 1; i <= 300; i++) {
  const category = categories[i % categories.length];
  const style = styles[i % styles.length];
  const color = colors[i % colors.length];

  const name = `${color.name} ${category.name} w stylu ${style}`;

  products.push({
    id: `P${i}`,
    name,
    category: category.key,
    style,
    color: color.key
  });
}

// 📦 ORDERS
const orders = [];

for (let i = 1; i <= 100; i++) {
  const status = statuses[i % statuses.length];
  const carrier = carriers[i % carriers.length];

  const itemCount = Math.floor(Math.random() * 5) + 1;

  const items = [];
  for (let j = 0; j < itemCount; j++) {
    const product = products[Math.floor(Math.random() * products.length)];
    items.push(product);
  }

  const order = {
    OredrID: `HY12345${String(i).padStart(3, "0")}`,
    OrderStatus: status,
    Carrier: carrier,
    ...(status === "sent" || status === "ready to sent"
      ? { TrackingNum: String(Math.floor(Math.random() * 1e12)) }
      : {}),
    Items: items
  };

  orders.push(order);
}

// 💾 SAVE
fs.writeFileSync("products.json", JSON.stringify(products, null, 2));
fs.writeFileSync("orders.json", JSON.stringify(orders, null, 2));

console.log("✅ Wygenerowano products.json i orders.json");