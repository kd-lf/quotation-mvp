import type { BomLine, Catalog, Product } from "../types";

export function applyMasterPricesAndBomRollups(
  catalog: Catalog,
  masterPriceMap: Map<string, number>,
): Catalog {
  // Clone catalog shallowly (keep Maps, but rebuild bySKU + items arrays immutably)
  const systems: Product[] = catalog.systems.map((p) => ({ ...p }));
  const items: Product[] = catalog.items.map((p) => ({ ...p }));

  const bySKU = new Map<string, Product>();
  for (const p of [...systems, ...items]) bySKU.set(p.sku, p);

  const bom = catalog.bomByParentSku;

  // 1) apply master prices to everything we can
  for (const p of bySKU.values()) {
    const mp = masterPriceMap.get(p.sku.trim().toUpperCase());
    if (mp !== undefined) p.price = mp;
  }

  // 2) roll up BOM parents from children
  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const unitPrice = (sku: string, bomLine?: BomLine): number => {
    if (memo.has(sku)) return memo.get(sku)!;
    if (visiting.has(sku)) return 0; // cycle guard

    const bomLines = bom?.get(sku);
    if (bomLines?.length) {
      visiting.add(sku);
      const total = bomLines.reduce((acc, line) => acc + line.qty * unitPrice(line.sku, line), 0);
      visiting.delete(sku);
      memo.set(sku, total);
      return total;
    }

    const mp = masterPriceMap.get(sku.trim().toUpperCase());
    if (mp !== undefined) return mp;

    const p = bySKU.get(sku);
    if (p?.price !== undefined) return p.price;

    if (bomLine?.price !== undefined) return bomLine.price;

    return 0;
  };

  if (bom) {
    for (const [parentSku] of bom.entries()) {
      const parent = bySKU.get(parentSku);
      if (!parent) continue;
      parent.price = unitPrice(parentSku);
    }
  }

  return {
    ...catalog,
    systems,
    items,
    bySKU,
  };
}
