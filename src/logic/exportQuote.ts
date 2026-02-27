// FILE: src/logic/exportQuote.ts
import * as XLSX from "xlsx";
import type { ConfigState } from "../types";
import expandConfigToQuoteItems from "./expandConfigToQuoteItems";

export interface QuoteMetadata {
  systemSku: string;
  selections: Record<string, string | string[]>;
  bomSelections: Record<string, string[]>;
  quantities: Record<string, number>;
  priceBookName: string | null;
  priceBookEntries: number | null;
  priceBookUploadedAt: string | null;
  version: string;
}

export function exportQuoteToExcel(
  state: ConfigState,
  priceMap: Map<string, number> | null,   // <-- NEW
  priceBookName: string | null,
  priceBookEntries: number | null,
  priceBookUploadedAt: Date | null
) {
  if (!state.system) {
    alert("Cannot export quote: No system selected.");
    return;
  }

  // -----------------------------
  // 1. Build CUSTOMER-FACING ROWS
  // -----------------------------
  const items = expandConfigToQuoteItems({
    ...state,
    priceMap, // <-- use priceMap passed into function
  });

  const customerRows = items
    .filter((it) => it.checked && !it.isHeader)
    .map((it) => ({
    Description: it.item,
    SKU: it.sku,
    Qty: it.qty ?? 1,
    "Unit Price": it.price,
    Total: (it.qty ?? 1) * (it.price ?? 0),
    }));

  const wsQuote = XLSX.utils.json_to_sheet(customerRows);

  // -----------------------------
  // 2. METADATA
  // -----------------------------
  const selections: Record<string, string | string[]> = {};
  state.selections.forEach((v, group) => {
    selections[group] = Array.isArray(v) ? v : v;
  });

  const bomSelections: Record<string, string[]> = {};
  state.selectedBom.forEach((set, parent) => {
    bomSelections[parent] = Array.from(set);
  });

  const quantities: Record<string, number> = {};
  state.quantities.forEach((qty, key) => {
    quantities[key] = qty;
  });

  const metadata: QuoteMetadata = {
    systemSku: state.system.sku,
    selections,
    bomSelections,
    quantities,
    priceBookName,
    priceBookEntries,
    priceBookUploadedAt: priceBookUploadedAt?.toISOString() ?? null,
    version: "1.0",
  };

  const wsMeta = XLSX.utils.json_to_sheet([{ json: JSON.stringify(metadata) }]);
  (wsMeta as any)["!hidden"] = 1;

  // -----------------------------
  // 3. Save workbook
  // -----------------------------
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsQuote, "Quote");
  XLSX.utils.book_append_sheet(wb, wsMeta, "Metadata");

  const filename = `Quote_${state.system.name.replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(wb, filename);
}