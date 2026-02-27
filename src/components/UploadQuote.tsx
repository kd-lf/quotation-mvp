// FILE: src/components/UploadQuote.tsx
import * as XLSX from "xlsx";
import { Button } from "@mui/material";
import { useRef, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import type { QuoteMetadata } from "../logic/exportQuote";
import { createInitialState } from "../logic/ruleEngine";
import type { Catalog, ConfigState } from "../types";

export default function UploadQuote({
  catalog,
  setState,
  onNegotiatedPrices,
}: {
  catalog: Catalog | null;
  setState: Dispatch<SetStateAction<ConfigState | null>>;
  onNegotiatedPrices: (prices: Map<string, number>) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !catalog) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });

    const sheet = wb.Sheets["Metadata"];
    if (!sheet) {
      alert("This does not appear to be a quote file (Metadata sheet missing).");
      return;
    }

    const row = XLSX.utils.sheet_to_json<any>(sheet)[0];
    const metadata: QuoteMetadata = JSON.parse(row.json);

    const quoteSheet = wb.Sheets["Quote"];
    const quoteRows = quoteSheet ? XLSX.utils.sheet_to_json<any>(quoteSheet) : [];

    // -----------------------------
    // REBUILD STATE FROM METADATA
    // -----------------------------
    const base = createInitialState(catalog);

    // Restore system
    const system = catalog.systems.find((s) => s.sku === metadata.systemSku);
    if (!system) {
      alert("System in quote does not exist in current product model.");
      return;
    }
    base.system = system;

    // Restore selections
    const map = new Map<string, any>();
    for (const [group, val] of Object.entries(metadata.selections)) {
      map.set(group, val);
    }
    base.selections = map;

    // Restore BOM selections
    const bomMap = new Map<string, Set<string>>();
    for (const [parent, children] of Object.entries(metadata.bomSelections)) {
      bomMap.set(parent, new Set(children));
    }
    base.selectedBom = bomMap;

    const normalizeSku = (value: string) =>
      String(value)
        .replace(/[\s\u00A0]/g, "")
        .trim()
        .toUpperCase();

    const negotiatedMap = new Map<string, number>();
    for (const quoteRow of quoteRows) {
      const rawSku = quoteRow["SKU"];
      const rawUnitPrice = quoteRow["Unit Price"];

      if (!rawSku || rawUnitPrice == null || rawUnitPrice === "") continue;

      const numericPrice = Number(rawUnitPrice);
      if (!Number.isFinite(numericPrice)) continue;

      negotiatedMap.set(normalizeSku(rawSku), numericPrice);
    }

    setState(base);
    onNegotiatedPrices(negotiatedMap);

    if (ref.current) ref.current.value = "";
    alert(`Quote restored successfully with ${negotiatedMap.size} negotiated prices.`);
  };

  return (
    <Button variant="outlined" component="label" disabled={!catalog}>
      IMPORT QUOTE
      <input
        ref={ref}
        type="file"
        hidden
        accept=".xlsx"
        onChange={onUpload}
      />
    </Button>
  );
}