import * as XLSX from "xlsx";
import type { ConfigState } from "../types";
import expandConfigToQuoteItems from "./expandConfigToQuoteItems";

export function exportCrmReportToExcel(
  state: ConfigState,
  priceMap: Map<string, number> | null,
  negotiatedPriceMap: Map<string, number> | null,
) {
  if (!state.system) {
    alert("Cannot export CRM report: no system selected.");
    return;
  }

  const items = expandConfigToQuoteItems({
    ...state,
    priceMap,
    negotiatedPriceMap,
  }).filter((item) => item.checked && !item.isHeader);

  const rows = items.map((item) => ({
    systemSku: state.system?.sku,
    systemName: state.system?.name,
    sku: item.sku,
    description: item.item,
    quantity: item.qty ?? 1,
    unitPrice: item.price ?? 0,
    lineTotal: (item.qty ?? 1) * (item.price ?? 0),
    pricingSource:
      negotiatedPriceMap?.has(String(item.sku).replace(/[\s\u00A0]/g, "").trim().toUpperCase())
        ? "negotiated"
        : "pricebook",
    exportedAt: new Date().toISOString(),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "CRM");

  XLSX.writeFile(wb, `CRM_Report_${state.system.sku}.xlsx`);
}