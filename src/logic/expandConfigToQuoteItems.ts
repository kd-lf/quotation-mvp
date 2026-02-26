import type { Product } from "../types";

export default function expandConfigToQuoteItems(state: any) {
  const result: any[] = [];

  const { system, catalog, selections, selectedBom, priceMap } = state;
  if (!system) return result;

  // Normalize SKU for robust lookups (trim, remove spaces/nbsp, uppercase)
  const normSku = (s: string) =>
    String(s)
      .replace(/[\s\u00A0]/g, "")
      .trim()
      .toUpperCase();

  // Price priority: 1) price book, 2) BOM-line price, 3) PRODUCTS price, 4) 0
  const getPrice = (sku: string, bomFallback?: number) => {
    const key = normSku(sku);
    if (priceMap?.has(key)) return priceMap.get(key)!; // 1) master price book
    if (typeof bomFallback === "number") return bomFallback; // 2) BOM price if present
    const p = catalog.bySKU.get(sku)?.price; // 3) product price (PRODUCTS sheet)
    return typeof p === "number" ? p : 0; // 4) default
  };

  // ------------------------------------------------------
  // 1) System header (shown, not priced)
  // ------------------------------------------------------
  result.push({
    item: system.name,
    sku: system.sku,
    isHeader: true,
    checked: true,
  });

  // ------------------------------------------------------
  // 2) System BOM (optional children with checkboxes)
  // ------------------------------------------------------
  const sysBom = catalog.bomByParentSku.get(system.sku) ?? [];
  const sysSelected = selectedBom.get(system.sku) ?? new Set<string>();

  for (const line of sysBom) {
    const p = catalog.bySKU.get(line.sku);
    result.push({
      item: p?.name ?? line.name ?? line.sku,
      sku: line.sku,
      qty: line.qty,
      price: getPrice(line.sku, line.price),
      isHeader: false,
      checked: sysSelected.has(line.sku),
    });
  }

  // ------------------------------------------------------
  // 3) Group selections + their BOM
  // ------------------------------------------------------
  for (const group of catalog.groups) {
    const sel = selections.get(group);
    if (!sel) continue;

    const groupSkus = Array.isArray(sel) ? sel : [sel];

    for (const sku of groupSkus) {
      const p: Product | undefined = catalog.bySKU.get(sku);
      if (!p) continue;

      // Header row for the chosen option
      result.push({
        item: p.name,
        sku: p.sku,
        isHeader: true,
        checked: true,
      });

      // BOM children for that option
      const bom = catalog.bomByParentSku.get(p.sku) ?? [];
      const selSet = selectedBom.get(p.sku) ?? new Set<string>();

      for (const line of bom) {
        const lp = catalog.bySKU.get(line.sku);
        result.push({
          item: lp?.name ?? line.name ?? line.sku,
          sku: line.sku,
          qty: line.qty,
          price: getPrice(line.sku, line.price),
          isHeader: false,
          checked: selSet.has(line.sku),
        });
      }
    }
  }

  return result;
}
