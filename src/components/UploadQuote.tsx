// FILE: src/components/UploadQuote.tsx
import * as XLSX from "xlsx";
import { Button } from "@mui/material";
import { useRef } from "react";
import type { QuoteMetadata } from "../logic/exportQuote";
import { createInitialState } from "../logic/ruleEngine";
import type { Catalog, ConfigState } from "../types";

export default function UploadQuote({
  catalog,
  setState,
}: {
  catalog: Catalog | null;
  setState: (s: ConfigState) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setState(base);

    if (ref.current) ref.current.value = "";
    alert("Quote restored successfully!");
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