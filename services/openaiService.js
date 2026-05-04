export async function createInitialResponse(openai, messages, rulesContext) {
  return openai.responses.create({
    model: "gpt-4.1",
    input: [
      ...messages,
      ...(rulesContext
        ? [{ role: "system", content: `Zasady:\n${rulesContext}` }]
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
}

export async function createFinalResponse(openai, { messages, functionCall, order, suggestions }) {
  if (!functionCall?.call_id) {
    throw new Error("Missing call_id in functionCall");
  }

  const productContext = suggestions
    .map(p => `${p.id} - ${p.name}`)
    .join("\n");

  const toolResponse = {
    type: "function_call_output",
    call_id: functionCall.call_id,
    output: JSON.stringify({
      status: order.OrderStatus,
      carrier: order.Carrier,
      tracking: order.TrackingNum,
      items: order.Items
    })
  };

  return openai.responses.create({
    model: "gpt-4.1",
    input: [
      ...messages,
      functionCall,     // 🔥 MUSI BYĆ
      toolResponse,     // 🔥 MUSI BYĆ
      {
        role: "system",
        content: `

STATUS: ${order.OrderStatus}

Produkty do inspiracji:

${productContext}

FORMAT ODPOWIEDZI:

Użyj dokładnie tej struktury HTML:

<div><strong>📦 Status zamówienia</strong></div>

<div>...</div>

<div><strong>🚚 Dostawa</strong></div>

<div>...</div>

<div><strong>💡 Inspiracja</strong></div>

<div>...</div>

ZASADY:

- jeśli status zawiera "cancel" → NIE twórz sekcji "💡 Inspiracja"

- nie pokazuj pustych sekcji

- nie wymyślaj danych

INSPIRACJA:

- MUSISZ nawiązać do produktu z zamówienia

- użyj języka typu:

  "Do [produkt] pasuje..."

  "Możesz zestawić z..."

- użyj MAX 1 produktu z listy

- jeśli używasz produktu → dodaj:

<div data-product-id="ID"></div>

`
      }
    ]
  });
}