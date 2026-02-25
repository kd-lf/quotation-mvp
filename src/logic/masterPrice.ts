// src/logic/masterPrice.ts
import * as XLSX from "xlsx";

const normSku = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toUpperCase();

function parsePrice(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;

  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;

  let s = String(v).trim();
  if (!s) return undefined;

  // remove spaces (incl. non-breaking)
  s = s.replace(/[\s\u00A0]/g, "");

  // Heuristic:
  // "3,440" -> thousands separator -> 3440
  // "3,44"  -> decimal -> 3.44
  // If comma with exactly 3 digits after -> thousands
  const commaMatch = s.match(/^(-?\d+),(\d{3})$/);
  if (commaMatch) {
    s = `${commaMatch[1]}${commaMatch[2]}`;
  } else {
    // otherwise treat comma as decimal separator
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Scan ALL sheets.
 * Assumption: SKU is in column C (index 2) and price is in column F (index 5).
 */
export function buildMasterPriceMap(workbook: XLSX.WorkBook): Map<string, number> {
  const map = new Map<string, number>();
  console.log("USING masterPrice.ts v2 (SKU col C, price col F)");
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });

    for (const row of rows) {
      if (!row || row.length < 6) continue;

      const sku = normSku(row[2]); // Column C
      const price = parsePrice(row[5]); // Column F

      if (!sku || price === undefined) continue;

      map.set(sku, price);
    }
  }

  return map;
}
