import type { ConfigState, Product } from "../types";

type QuoteItem = {
  item: string;
  sku: string;
  qty?: number;
  price?: number;
  isHeader?: boolean;
  checked?: boolean;
  isBoldParent?: boolean;
};

const qtyKey = (parentSku: string, sku: string) => `${parentSku}::${sku}`;

export default function expandConfigToQuoteItems(state: ConfigState & {
  priceMap?: Map<string, number> | null;
  negotiatedPriceMap?: Map<string, number> | null;
}) {
  const result: QuoteItem[] = [];

  const { system, catalog, selections, selectedBom, priceMap, negotiatedPriceMap, quantities } = state;
  if (!system) return result;

  const normSku = (s: string) => String(s).replace(/[\s\u00A0]/g, "").trim().toUpperCase();

  const getPrice = (sku: string, bomFallback?: number) => {
    const key = normSku(sku);

    if (negotiatedPriceMap?.has(key)) return negotiatedPriceMap.get(key)!;
    if (priceMap?.has(key)) return priceMap.get(key)!;
    if (typeof bomFallback === "number") return bomFallback;
    const p = catalog.bySKU.get(sku)?.price;

    return typeof p === "number" ? p : 0;
  };

  const getQty = (parentSku: string, sku: string, defaultQty: number) => {
    const existing = quantities.get(qtyKey(parentSku, sku));
    return typeof existing === "number" ? existing : defaultQty;
  };

  const addParentWithBom = (
    parent: Product,
    bom: Array<{ sku: string; qty: number; name?: string; price?: number }>,
    selectedChildren: Set<string>,
  ) => {
    let parentPrice = 0;

    for (const line of bom) {
      const qty = getQty(parent.sku, line.sku, line.qty);
      if (!selectedChildren.has(line.sku) || qty <= 0) continue;
      parentPrice += getPrice(line.sku, line.price) * qty;
    }

    result.push({
      item: parent.name,
      sku: parent.sku,
      isHeader: true,
      checked: true,
      price: parentPrice,
    });

    for (const line of bom) {
      const p = catalog.bySKU.get(line.sku);
      const qty = getQty(parent.sku, line.sku, line.qty);

      result.push({
        item: p?.name ?? line.name ?? line.sku,
        sku: line.sku,
        qty,
        price: getPrice(line.sku, line.price),
        isHeader: false,
        checked: selectedChildren.has(line.sku) && qty > 0,
      });
    }
  };

  const sysBom = catalog.bomByParentSku.get(system.sku) ?? [];
  const sysSelected = selectedBom.get(system.sku) ?? new Set<string>();

  if (sysBom.length > 0) {
    addParentWithBom(system, sysBom, sysSelected);
  } else {
    const qty = getQty(system.sku, system.sku, 1);
    result.push({
      item: system.name,
      sku: system.sku,
      qty,
      price: getPrice(system.sku),
      isHeader: false,
      isBoldParent: true,
      checked: qty > 0,
    });
  }

  for (const group of catalog.groups) {
    const sku = selections.get(group);
    if (!sku) continue;

    const p: Product | undefined = catalog.bySKU.get(sku);
    if (!p) continue;

    const bom = catalog.bomByParentSku.get(p.sku) ?? [];
    const selectedChildren = selectedBom.get(p.sku) ?? new Set<string>();

    if (bom.length > 0) {
      addParentWithBom(p, bom, selectedChildren);
    } else {
      const qty = getQty(p.sku, p.sku, 1);
      result.push({
        item: p.name,
        sku: p.sku,
        qty,
        price: getPrice(p.sku),
        isHeader: false,
        isBoldParent: true,
        checked: qty > 0,
      });
    }
  }

  return result;
}
