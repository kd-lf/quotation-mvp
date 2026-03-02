// FILE: src/components/UploadPriceBook.tsx
import * as XLSX from "xlsx";
import { Button } from "@mui/material";
import { useCallback, useRef, useState } from "react";
import {
  buildMasterPriceMap,
  extractPriceBookCurrencyInfo,
  type PriceBookCurrencyInfo,
} from "../logic/masterPrice";

export default function UploadPriceBook({
  disabled,
  onPrices,
  onInfo, // <-- NEW
}: {
  disabled?: boolean;
  onPrices: (priceMap: Map<string, number>, currencyInfo: PriceBookCurrencyInfo | null) => void;
  onInfo?: (info: { name: string; uploadedAt: Date }) => void; // <-- NEW
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const onChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // NEW: tell App the file name + upload time immediately
      onInfo?.({ name: file.name, uploadedAt: new Date() });

      setBusy(true);
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: "array" });
        const map = buildMasterPriceMap(wb);
        const currencyInfo = extractPriceBookCurrencyInfo(wb);
        onPrices(map, currencyInfo);
      } finally {
        setBusy(false);
        if (ref.current) ref.current.value = "";
      }
    },
    [onPrices, onInfo],
  );

  return (
    <Button variant="outlined" component="label" disabled={disabled || busy}>
      {busy ? "LOADING PRICES..." : "UPLOAD PRICE BOOK"}
      <input ref={ref} type="file" hidden accept=".xlsx,.xls" onChange={onChange} />
    </Button>
  );
}
