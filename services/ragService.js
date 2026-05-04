import fs from "fs";

const rules = JSON.parse(fs.readFileSync("./data/rules.json", "utf-8"));

export function getRelevantRules(text) {
  const q = text.toLowerCase();

  return rules
    .filter(r => r.keywords.some(k => q.includes(k)))
    .map(r => r.content)
    .join("\n");
}