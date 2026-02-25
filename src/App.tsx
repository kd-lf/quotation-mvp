import { useEffect, useMemo, useState } from "react";
import { Container, Box } from "@mui/material";

import Logo from "./components/Logo";
import UploadExcel from "./components/UploadExcel";
import UploadPriceBook from "./components/UploadPriceBook";
import ItemSelector from "./components/ItemSelector";
import QuoteSummary from "./components/QuoteSummary";
import UserManagement from "./components/UserManagement";

import type { Catalog, ConfigState } from "./types";
import { createInitialState } from "./logic/ruleEngine";
import { applyMasterPricesAndBomRollups } from "./logic/pricing";

// ---- Legacy summary line type (kept so QuoteSummary keeps working) ----
export type AppRole = "SuperUser" | "InternalUser" | "ExternalUser";

export type ItemRow = {
  item: string;
  sku: string;
  price: number;
  currency: string;
  checked?: boolean;
  qty?: number;
  link?: string;
  isHeader?: boolean; // <-- add
  parentSku?: string; // <-- optional grouping
};

function permissionsFor(role: AppRole) {
  return {
    canQuote: true,
    canUpload: role === "SuperUser",
    canManageUsers: role === "SuperUser" || role === "InternalUser",
  };
}

export default function App() {
  const [role, setRole] = useState<AppRole>("SuperUser");
  const [page, setPage] = useState<"quote" | "users">("quote");

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState<ConfigState | null>(null);
  const [priceMap, setPriceMap] = useState<Map<string, number> | null>(null);

  // load role from storage
  useEffect(() => {
    const saved = localStorage.getItem("role") as AppRole | null;
    if (saved) setRole(saved);
  }, []);

  const perms = permissionsFor(role);

  // when product book uploads:
  const onCatalog = (cat: Catalog) => {
    const priced = priceMap ? applyMasterPricesAndBomRollups(cat, priceMap) : cat;
    setCatalog(priced);
    setState(createInitialState(priced));
  };

  // when price book uploads:
  const onPrices = (pm: Map<string, number>) => {
    console.log("Master price map size:", pm.size);

    const testSku = "444593"; // real BOM child SKU

    console.log("pm.get(testSku):", pm.get(testSku));

    setPriceMap(pm);

    setCatalog((prev) => {
      if (!prev) return prev;

      const priced = applyMasterPricesAndBomRollups(prev, pm);

      console.log("priced.bySKU has testSku:", priced.bySKU.has(testSku));
      console.log("priced.bySKU.get(testSku)?.price:", priced.bySKU.get(testSku)?.price);

      setState((s) => (s ? { ...s, catalog: priced } : s));

      return priced;
    });
  };

  const resetAll = () => {
    setCatalog(null);
    setState(null);
    setPriceMap(null);
  };

  // === Adapter: convert live configuration -> legacy ItemRow[] for QuoteSummary ===
  const itemsForSummary: ItemRow[] = useMemo(() => {
    if (!state) return [];

    const out: ItemRow[] = [];
    const bom = state.catalog.bomByParentSku;

    const asArray = (v: string | string[] | undefined): string[] =>
      !v ? [] : Array.isArray(v) ? v : [v];

    const expandParent = (parentSku: string) => {
      const parent = state.catalog.bySKU.get(parentSku);
      if (!parent) return;

      const bomLines = bom?.get(parentSku);

      // If this SKU has BOM children → Mode A bundle
      if (bomLines?.length) {
        // Parent header row (not priced)
        out.push({
          item: parent.name,
          sku: parent.sku,
          price: 0,
          currency: parent.currency ?? "NOK",
          qty: 1,
          checked: true,
          isHeader: true,
        });

        // Children rows (priced)
        for (const line of bomLines) {
          const child = state.catalog.bySKU.get(line.sku);
          const norm = (s: string) => s.trim().toUpperCase();

          out.push({
            item: child?.name ?? line.name ?? line.sku,
            sku: line.sku,
            price: child?.price ?? priceMap?.get(norm(line.sku)) ?? line.price ?? 0,
            currency: child?.currency ?? parent.currency ?? "NOK",
            qty: line.qty,
            checked: true,
            parentSku: parentSku,
          });
        }
      } else {
        // Normal leaf item (no BOM)
        out.push({
          item: parent.name,
          sku: parent.sku,
          price: parent.price ?? 0,
          currency: parent.currency ?? "NOK",
          qty: 1,
          checked: true,
        });
      }
    };

    // Expand system first (if selected)
    if (state.system) {
      expandParent(state.system.sku);
    }

    // Then expand selected group items
    for (const group of state.catalog.groups) {
      const skus = asArray(state.selections.get(group));
      for (const sku of skus) {
        expandParent(sku);
      }
    }

    return out;
  }, [state, priceMap]);

  return (
    <Container maxWidth="lg" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <Logo />

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>Quotation Tool</h2>
      </div>

      {/* Actions row */}
      {(perms.canUpload || perms.canManageUsers) && (
        <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
          {perms.canUpload && page === "quote" && (
            <Box sx={{ display: "flex", gap: 2 }}>
              <UploadExcel onData={onCatalog} hasBook={!!catalog} onReset={resetAll} />
              <UploadPriceBook disabled={!catalog} onPrices={onPrices} />
            </Box>
          )}

          {/* If you re-enable this later, import Button again */}
          {/*
          {perms.canManageUsers && (
            <Button
              variant="outlined"
              onClick={() => setPage(page === "users" ? "quote" : "users")}
            >
              {page === "users" ? "Back to Quotation" : "User Management"}
            </Button>
          )}
          */}
        </div>
      )}

      {/* PAGE: User management */}
      {page === "users" && perms.canManageUsers && (
        <UserManagement onBack={() => setPage("quote")} currentRole={role} />
      )}

      {/* PAGE: Quotation */}
      {page === "quote" && (
        <>
          {!catalog && (
            <div style={{ marginTop: 8 }}>
              {perms.canUpload
                ? "No product book loaded. Please upload an Excel file to get started."
                : "Please ask a SuperUser to upload the product file."}
            </div>
          )}

          {state && perms.canQuote && (
            <>
              <ItemSelector state={state} setState={setState} />
              <QuoteSummary items={itemsForSummary} automationEnabled={state.automation} />
            </>
          )}
        </>
      )}
    </Container>
  );
}
