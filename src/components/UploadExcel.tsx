
import * as XLSX from "xlsx";
import { Button } from "@mui/material";
import { parseNOKCurrency } from "../utils/parsePrice";
import type { Catalog, Product, Dependency, QtyMode } from "../types";



// Add this helper near the top of UploadExcel.tsx
function normalizeLink(v: unknown): string | undefined {
  const raw = String(v ?? "").trim();
  if (!raw) return undefined;
  // Prepend https:// if the sheet has a bare domain/path
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}




// Canonicalize QtyMode to the exact union values we use in the app.
function canonicalQtyMode(v: any): QtyMode {
  const s = String(v ?? "fixed").trim().toLowerCase();
  return s === "perparent" ? "perParent" : "fixed";
}

// Parse Required strictly (only true/yes/1 are true)
function parseRequired(v: any): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

export default function UploadExcel({ onData }: { onData: (catalog: Catalog) => void }) {
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data as string, { type: "binary" });

      const productsSheet = workbook.Sheets["Products"];
      const depsSheet = workbook.Sheets["Dependencies"];
      if (!productsSheet || !depsSheet) {
        console.error("Workbook must contain 'Products' and 'Dependencies' sheets.");
        return;
      }

      const productsRows = XLSX.utils.sheet_to_json<any>(productsSheet, { defval: "" });
      const depsRows = XLSX.utils.sheet_to_json<any>(depsSheet, { defval: "" });

      const products: Product[] = productsRows.map((row: any) => ({
        item: row.Item,
        sku: row.SKU,
        price: parseNOKCurrency(row.Price?.toString?.() ?? String(row.Price)),
        currency: row.Currency || "NOK",
        link: normalizeLink(row.Link),
      }));

      const dependencies: Dependency[] = depsRows.map((r: any) => {
        const parentSKU = String(r.ParentSKU ?? "").trim();
        const depGroup = String(r.DepGroup ?? "").trim();
        const optionSKU = String(r.OptionSKU ?? "").trim();
        const qtyMode = canonicalQtyMode(r.QtyMode);
        const qty = Number(r.Qty ?? 1) || 1;
        const required = parseRequired(r.Required);
        const notes = String(r.Notes ?? "").trim() || undefined;
        return { parentSKU, depGroup, optionSKU, qtyMode, qty, required, notes };
      });

      // Build indexes
      const bySKU = new Map<string, Product>();
      products.forEach((p) => bySKU.set(p.sku, p));

      const groupsByParent = new Map<string, Map<string, Dependency[]>>();
      for (const d of dependencies) {
        if (!groupsByParent.has(d.parentSKU)) groupsByParent.set(d.parentSKU, new Map());
        const groupMap = groupsByParent.get(d.parentSKU)!;
        if (!groupMap.has(d.depGroup)) groupMap.set(d.depGroup, []);
        groupMap.get(d.depGroup)!.push(d);
      }

      // Optional: warn if dependencies reference SKUs not present in Products
      const missing: string[] = [];
      dependencies.forEach((d) => {
        if (!bySKU.has(d.optionSKU)) missing.push(d.optionSKU);
      });
      if (missing.length) {
        console.warn("Dependencies reference missing SKUs:", Array.from(new Set(missing)).join(", "));
      }

      // Optional sanity log (uncomment if you want to verify parsed values)
      // console.table(dependencies.map(d => ({
      //   parent: d.parentSKU, group: d.depGroup, option: d.optionSKU,
      //   qtyMode: d.qtyMode, qty: d.qty, required: d.required
      // })));

      onData({ products, dependencies, bySKU, groupsByParent });
    };
    reader.readAsBinaryString(file);
  };

  return (
    <Button variant="contained" component="label">
      Upload Excel
      <input type="file" hidden onChange={handleUpload} />
    </Button>
  );
}
