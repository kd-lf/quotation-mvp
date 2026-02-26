// FILE: src/App.tsx
import { useState } from "react";
import { Container, Box } from "@mui/material";
import Logo from "./components/Logo";
import UploadExcel from "./components/UploadExcel";
import UploadPriceBook from "./components/UploadPriceBook";
import ItemSelector from "./components/ItemSelector";
import QuoteSummary from "./components/QuoteSummary";
import type { Catalog, ConfigState } from "./types";
import { createInitialState } from "./logic/ruleEngine";
import { applyMasterPricesAndBomRollups } from "./logic/pricing";
import expandConfigToQuoteItems from "./logic/expandConfigToQuoteItems";

export type AppRole = "SuperUser" | "InternalUser" | "ExternalUser";

export default function App() {

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState<ConfigState | null>(null);
  const [priceMap, setPriceMap] = useState<Map<string, number> | null>(null);

  // NEW metadata
  const [priceBookName, setPriceBookName] = useState<string | null>(null);
  const [priceBookEntries, setPriceBookEntries] = useState<number | null>(null);
  const [priceBookUploadedAt, setPriceBookUploadedAt] = useState<Date | null>(null);

  // Load saved role
 
  // when product book uploads:
  const onCatalog = (cat: Catalog) => {
    const priced = priceMap ? applyMasterPricesAndBomRollups(cat, priceMap) : cat;
    setCatalog(priced);
    setState(createInitialState(priced));
  };

  // when price book uploads:
  const onPrices = (pm: Map<string, number>) => {
    console.log("Master price map size:", pm.size);
    setPriceMap(pm);
    setPriceBookEntries(pm.size); // <-- entries here (pm exists here)

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
    setPriceBookUploadedAt(null);
    setPriceBookEntries(null);
  };

  return (
    <Container maxWidth="lg" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <Logo />

      {/* Actions row */}
      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <Box sx={{ display: "flex", gap: 2 }}>
          <UploadExcel
            onData={onCatalog}
            hasBook={!!catalog}
            onReset={resetAll}
            // (No price-book info here anymore)
          />

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

      {/* Quotation */}
      {state && (
        <>
          <ItemSelector
            state={state}
            setState={setState}
            priceBookName={priceBookName}
            priceBookEntries={priceBookEntries}
            priceBookUploadedAt={priceBookUploadedAt}
          />

          <QuoteSummary
            items={expandConfigToQuoteItems({ ...state, priceMap })}
            automationEnabled={state.automation}
            validDays={30}
          />
        </>
      )}
    </Container>
  );
}
