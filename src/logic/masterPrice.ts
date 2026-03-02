import * as XLSX from "xlsx";

export type PriceBookCurrencyInfo = {
  currency: string;
  usdConversionRate: number;
};

const normSku = (v: unknown) =>
  String(v ?? "")
    .replace(/[\s\u00A0]/g, "")
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
  const commaThousands = s.match(/^(-?\d+),(\d{3})$/);
  if (commaThousands) {
    s = `${commaThousands[1]}${commaThousands[2]}`;
  } else {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Build a map of SKU -> unit price by scanning ALL sheets.
 * Assumption: SKU is in column C (index 2) and price is in column F (index 5).
 */
export function buildMasterPriceMap(workbook: XLSX.WorkBook): Map<string, number> {
  console.log("USING masterPrice.ts v2 (SKU col C, price col F)");

  const map = new Map<string, number>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });

    for (const row of rows) {
      if (!row || row.length < 6) continue;

      const sku = normSku(row[2]); // Column C
      const price = parsePrice(row[5]); // Column F
      if (!sku || price === undefined) continue;

      // First hit wins (prevents later sheets/rows overwriting)
      if (!map.has(sku)) map.set(sku, price);
    }
  }

  return map;
}

function readCell(sheet: XLSX.WorkSheet | undefined, cellRef: string): unknown {
  if (!sheet) return undefined;
  return sheet[cellRef]?.v;
}

export function extractPriceBookCurrencyInfo(workbook: XLSX.WorkBook): PriceBookCurrencyInfo | null {
  const calculationSheet = workbook.Sheets["CALCULTION SHEET"];
  if (!calculationSheet) return null;

  const rawCurrency = String(readCell(calculationSheet, "E4") ?? "")
    .trim()
    .toUpperCase();
  const usdConversionRate = parsePrice(readCell(calculationSheet, "E5"));

  if (!rawCurrency || usdConversionRate === undefined) return null;

  return {
    currency: rawCurrency,
    usdConversionRate,
  };
}
