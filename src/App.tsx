// FILE: src/App.tsx
import { useState } from "react";
import { Container, Box, Chip } from "@mui/material";
import Logo from "./components/Logo";
import UploadExcel from "./components/UploadExcel";
import UploadPriceBook from "./components/UploadPriceBook";
import ItemSelector from "./components/ItemSelector";
import type { Catalog, ConfigState } from "./types";
import { createInitialState } from "./logic/ruleEngine";
import { applyMasterPricesAndBomRollups } from "./logic/pricing";
import type { PriceBookCurrencyInfo } from "./logic/masterPrice";

export type AppRole = "SuperUser" | "InternalUser" | "ExternalUser";

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState<ConfigState | null>(null);
  const [priceMap, setPriceMap] = useState<Map<string, number> | null>(null);
  const [negotiatedPriceMap, setNegotiatedPriceMap] = useState<Map<string, number> | null>(null);

  const [priceBookName, setPriceBookName] = useState<string | null>(null);
  const [priceBookEntries, setPriceBookEntries] = useState<number | null>(null);
  const [priceBookUploadedAt, setPriceBookUploadedAt] = useState<Date | null>(null);
  const [priceBookCurrencyInfo, setPriceBookCurrencyInfo] = useState<PriceBookCurrencyInfo | null>(null);

  const onCatalog = (cat: Catalog) => {
    const priced = priceMap ? applyMasterPricesAndBomRollups(cat, priceMap) : cat;
    setCatalog(priced);
    setState(createInitialState(priced));
  };

  const onPrices = (pm: Map<string, number>, currencyInfo: PriceBookCurrencyInfo | null) => {
    console.log("Master price map size:", pm.size);
    setPriceMap(pm);
    setPriceBookEntries(pm.size);
    setPriceBookCurrencyInfo(currencyInfo);

    setCatalog((prev) => {
      if (!prev) return prev;
      const priced = applyMasterPricesAndBomRollups(prev, pm);
      setState((s) => (s ? { ...s, catalog: priced } : s));
      return priced;
    });
  };

  const resetAll = () => {
    setCatalog(null);
    setState(null);
    setPriceMap(null);
    setPriceBookName(null);
    setNegotiatedPriceMap(null);
    setPriceBookUploadedAt(null);
    setPriceBookEntries(null);
    setPriceBookCurrencyInfo(null);
  };

  const effectivePriceMap = negotiatedPriceMap ?? priceMap;

  const statusLabel = (() => {
    if (!catalog) return "Status: No files uploaded";
    if (catalog && !priceMap && !negotiatedPriceMap) return "Status: Product book uploaded, no prices loaded";
    if (catalog && negotiatedPriceMap) {
      return `Status: Product book + negotiated prices (${negotiatedPriceMap.size} overrides)`;
    }
    const currencyText = priceBookCurrencyInfo
      ? `, ${priceBookCurrencyInfo.currency} (1 USD = ${priceBookCurrencyInfo.usdConversionRate.toFixed(4)})`
      : "";
    return `Status: Product book + price sheet (${priceBookEntries ?? 0} entries${currencyText})`;
  })();

  return (
    <Container maxWidth="lg" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <Logo />

      {/* Actions row */}
      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <Box sx={{ display: "flex", gap: 2 }}>
          <UploadExcel onData={onCatalog} hasBook={!!catalog} onReset={resetAll} />

          <UploadPriceBook
            disabled={!catalog}
            onPrices={onPrices}
            onInfo={(info) => {
              setPriceBookName(info.name);
              setPriceBookUploadedAt(info.uploadedAt);
            }}
          />
        </Box>
      </div>

      <Chip
        label={statusLabel}
        color={negotiatedPriceMap ? "secondary" : catalog ? "primary" : "default"}
        variant="outlined"
        sx={{ mb: 2, fontSize: "0.85rem" }}
      />

      {/* Quotation */}
      {state && (
        <ItemSelector
          state={state}
          setState={setState}
          priceMap={effectivePriceMap}
          priceBookName={priceBookName}
          priceBookEntries={priceBookEntries}
          priceBookUploadedAt={priceBookUploadedAt}
          priceBookCurrencyInfo={priceBookCurrencyInfo}
          negotiatedPriceMap={negotiatedPriceMap}
          clearNegotiatedPrices={() => setNegotiatedPriceMap(null)}
          onNegotiatedPrices={(prices) => setNegotiatedPriceMap(prices)}
        />
      )}
    </Container>
  );
}
