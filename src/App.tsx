import { useEffect, useState } from "react";
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

import expandConfigToQuoteItems from "./logic/expandConfigToQuoteItems";

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

  isHeader?: boolean; // parent BOM header row (Mode A: not priced)
  parentSku?: string; // optional grouping
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

  // ===== DEBUG GROUP SANITY CHECK =====
  if (catalog) {
    console.log("=== RAW GROUPS FROM EXCEL ===");
    catalog.groups.forEach((g: string, idx: number) => {
      console.log(
        `GROUP[${idx}]:`,
        JSON.stringify(g),
        g.split("").map((c: string) => c.charCodeAt(0)),
      );
    });

    console.log("=== PRODUCT GROUPS ===");
    catalog.items.forEach((i: any) => {
      console.log(
        `SKU=${i.sku}`,
        "group=",
        JSON.stringify(i.group),
        "chars=",
        i.group.split("").map((c: string) => c.charCodeAt(0)),
      );
    });
  }
  // ===== END DEBUG =====

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

      console.log("Price map lookup test:", pm.get(testSku.trim().toUpperCase()));

      setState((s) => (s ? { ...s, catalog: priced } : s));

      return priced;
    });
  };

  const resetAll = () => {
    setCatalog(null);
    setState(null);
    setPriceMap(null);
  };

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

              <QuoteSummary
                items={expandConfigToQuoteItems({ ...state, priceMap })}
                automationEnabled={state.automation}
                validDays={30}
              />
            </>
          )}
        </>
      )}
    </Container>
  );
}
