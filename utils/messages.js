export function ensureVisualizationCTA(reply) {
  if (reply.includes("💡 Inspiracja") && !reply.includes("🎨")) {
    return reply + `<div>🎨 Chcesz zobaczyć wizualizację tej aranżacji?</div>`;
  }
  return reply;
}

export function getLastBotMessage(messages) {
  return [...messages].reverse().find(m => m.role === "assistant")?.content;
}