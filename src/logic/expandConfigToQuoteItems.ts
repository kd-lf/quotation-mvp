// FILE: src/logic/expandConfigToQuoteItems.ts
import type { Product } from "../types";

export default function expandConfigToQuoteItems(state: any) {
  const result: any[] = [];

  const { system, catalog, selections, selectedBom, priceMap } = state;
  if (!system) return result;

  // Normalize SKU for robust lookups
  const normSku = (s: string) =>
    String(s)
      .replace(/[\s\u00A0]/g, "")
      .trim()
      .toUpperCase();

  // Price priority: priceBook → BOM price → PRODUCTS price → 0
  const getPrice = (sku: string, bomFallback?: number) => {
    const key = normSku(sku);

    if (priceMap?.has(key)) return priceMap.get(key)!; // 1) price book
    if (typeof bomFallback === "number") return bomFallback; // 2) BOM sheet price
    const p = catalog.bySKU.get(sku)?.price; // 3) product sheet price

    return typeof p === "number" ? p : 0; // 4) fallback
  };

  // ------------------------------------------------------
  // 1) SYSTEM
  // ------------------------------------------------------
  const sysBom = catalog.bomByParentSku.get(system.sku) ?? [];
  const sysSelected = selectedBom.get(system.sku) ?? new Set<string>();

  if (sysBom.length > 0) {
    //
    // System WITH children → produce HEADER (true header, no price)
    //
    result.push({
      item: system.name,
      sku: system.sku,
      isHeader: true,
      checked: true,
    });

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
  } else {
    //
    // System has NO children → SINGLE priced bold row
    //
    result.push({
      item: system.name,
      sku: system.sku,
      qty: 1,
      price: getPrice(system.sku),
      isHeader: false,
      isBoldParent: true, // ⭐ bold BUT priced
      checked: true,
    });
  }

  // ------------------------------------------------------
  // 3) GROUP SELECTIONS + BOM
  // ------------------------------------------------------
  for (const group of catalog.groups) {
    const selectedValues = selections.get(group);
    if (!selectedValues) continue;

    const skus = Array.isArray(selectedValues) ? selectedValues : [selectedValues];

    for (const sku of skus) {
      const p: Product | undefined = catalog.bySKU.get(sku);
      if (!p) continue;

      const bom = catalog.bomByParentSku.get(p.sku) ?? [];
      const selectedChildren = selectedBom.get(p.sku) ?? new Set<string>();

      if (bom.length > 0) {
        //
        // Parent WITH children → HEADER + children
        //
        result.push({
          item: p.name,
          sku: p.sku,
          isHeader: true,
          checked: true,
        });

        for (const line of bom) {
          const lp = catalog.bySKU.get(line.sku);

          result.push({
            item: lp?.name ?? line.name ?? line.sku,
            sku: line.sku,
            qty: line.qty,
            price: getPrice(line.sku, line.price),
            isHeader: false,
            checked: selectedChildren.has(line.sku),
          });
        }
      } else {
        //
        // Parent WITHOUT children → SINGLE bold priced row
        //
        result.push({
          item: p.name,
          sku: p.sku,
          qty: 1,
          price: getPrice(p.sku),
          isHeader: false,
          isBoldParent: true, // ⭐ bold BUT priced
          checked: true,
        });
      }
    }
  }

  return result;
}
