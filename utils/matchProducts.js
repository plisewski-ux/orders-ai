export function matchProducts(orderItems, allProducts) {
  const styles = orderItems.map(i => i.style);
  const colors = orderItems.map(i => i.color);

  return allProducts
    .filter(p => !orderItems.find(i => i.id === p.id))
    .map(p => {
      let score = 0;
      if (styles.includes(p.style)) score += 2;
      if (colors.includes(p.color)) score += 1;
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 1);
}