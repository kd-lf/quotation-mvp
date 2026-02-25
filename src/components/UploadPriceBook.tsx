import * as XLSX from "xlsx";
import { Button } from "@mui/material";
import { useCallback, useRef, useState } from "react";
import { buildMasterPriceMap } from "../logic/masterPrice";

export default function UploadPriceBook({
  disabled,
  onPrices,
}: {
  disabled?: boolean;
  onPrices: (priceMap: Map<string, number>) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const onChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setBusy(true);
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: "array" });
        const map = buildMasterPriceMap(wb);
        onPrices(map);
      } finally {
        setBusy(false);
        if (ref.current) ref.current.value = "";
      }
    },
    [onPrices],
  );

  return (
    <Button variant="outlined" component="label" disabled={disabled || busy}>
      {busy ? "LOADING PRICES..." : "UPLOAD PRICE BOOK"}
      <input ref={ref} type="file" hidden accept=".xlsx,.xls" onChange={onChange} />
    </Button>
  );
}
