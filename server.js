import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import chatRoute from "./routes/chat.js";

const app = express();
app.use(express.json());
app.use(cors());

app.use("/chat", chatRoute);

// static (frontend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server działa na porcie", PORT);
});