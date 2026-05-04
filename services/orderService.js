export async function getOrder(order_id, token) {
  const res = await fetch(
    "https://elastic.snaplogic.com/api/1/rest/slsched/feed/bbk_dev/Dynamics365/shared/AI_TEST_PL%20Task",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ OredrID: order_id }) // 👈 sprawdź literówkę!
    }
  );

  const text = await res.text();

  console.log("STATUS:", res.status);
  console.log("RAW:", text.slice(0, 300));

  if (!res.ok) {
    console.error("❌ API ERROR");
    return null;
  }

  try {
    return JSON.parse(text)?.[0] || null;
  } catch {
    console.error("❌ JSON parse failed");
    return null;
  }
}