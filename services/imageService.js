export async function generateImage(openai, lastMessage) {
  const promptRes = await openai.responses.create({
    model: "gpt-4.1",
    input: `Stwórz prompt do realistycznej aranżacji:\n${lastMessage}`
  });

  const image = await openai.images.generate({
    model: "gpt-image-1",
    prompt: promptRes.output_text,
    size: "1024x1024"
  });

  return image.data[0].url || `data:image/png;base64,${image.data[0].b64_json}`;
}