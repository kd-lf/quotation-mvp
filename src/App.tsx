import { useEffect, useMemo, useState } from "react";
import { Container } from "@mui/material";

import Logo from "./components/Logo";
import UploadExcel from "./components/UploadExcel";
import ItemSelector from "./components/ItemSelector";
import QuoteSummary from "./components/QuoteSummary";
import UserManagement from "./components/UserManagement";

// TYPE-ONLY imports (TS with verbatimModuleSyntax)
import type { Catalog, ConfigState } from "./types";
import { createInitialState } from "./logic/ruleEngine";

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

  // load role from storage
  useEffect(() => {
    const saved = localStorage.getItem("role") as AppRole | null;
    if (saved) setRole(saved);
  }, []);

  const perms = permissionsFor(role);  

  // === Adapter: convert live configuration -> legacy ItemRow[] for QuoteSummary ===
  const itemsForSummary: ItemRow[] = useMemo(() => {
    if (!state) return [];

    const out: ItemRow[] = [];

    // Include the selected system (if any) as the first line
    if (state.system) {
      out.push({
        item: state.system.name,
        sku: state.system.sku,
        price: state.system.price ?? 0,
        currency: state.system.currency ?? "NOK",
        checked: true,
        qty: 1,
      });
    }

    // Then, one line per selected group option (in level order)
    const asArray = (v: string | string[] | undefined): string[] =>
      !v ? [] : Array.isArray(v) ? v : [v];

    for (const group of state.catalog.groups) {
      const skus = asArray(state.selections.get(group));

      for (const sku of skus) {
        const p = state.catalog.bySKU.get(sku);
        if (!p) continue;

        out.push({
          item: p.name,
          sku: p.sku,
          price: p.price ?? 0,
          currency: p.currency ?? "NOK",
          checked: true,
          qty: 1,
        });
      }
    }

    return out;
  }, [state]);

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
           <UploadExcel
  onData={(cat) => {
    setCatalog(cat);
    setState(createInitialState(cat));
  }}
  hasBook={!!catalog}
  onReset={() => {
    setCatalog(null);
    setState(null);
  }}
/>
          )}

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

          {/* New engine: ItemSelector now drives state, not a local items array */}
          {state && perms.canQuote && (
            <>
              <ItemSelector state={state} setState={setState} />
              {/* Keep your existing QuoteSummary – it still receives ItemRow[] + automation flag */}
              <QuoteSummary items={itemsForSummary} automationEnabled={state.automation} />
            </>
          )}
        </>
      )}
    </Container>
  );
}
