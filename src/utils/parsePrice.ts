
export function parseNOKCurrency(value: string): number {
  const cleaned = value
    .replace("kr", "")
    .replace(/\s/g, "")
    .replace(".", "")
    .replace(",", ".");
  return parseFloat(cleaned);
}
