
import { useEffect, useState } from "react";
import { Container, Button } from "@mui/material";

import Logo from "./components/Logo";
import UploadExcel from "./components/UploadExcel";
import ItemSelector from "./components/ItemSelector";
import QuoteSummary from "./components/QuoteSummary";
import UserManagement from "./components/UserManagement";

import type { Catalog } from "./types";

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
  const [role, setRole] = useState<AppRole>("ExternalUser");
  const [page, setPage] = useState<"quote" | "users">("quote");

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [automationEnabled, setAutomationEnabled] = useState(true);

  // load role from storage
  useEffect(() => {
    const saved = localStorage.getItem("role") as AppRole | null;
    if (saved) setRole(saved);
  }, []);

  const perms = permissionsFor(role);

  const onRoleChange = (next: AppRole) => {
    setRole(next);
    localStorage.setItem("role", next);
  };

  const resetAll = () => {
    setCatalog(null);
    setItems([]);
    setAutomationEnabled(true);
    setPage("quote");
    localStorage.removeItem("role");
    setRole("ExternalUser");
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
        <h2 style={{ margin: 0 }}>Quotation Tool (MVP)</h2>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value as AppRole)}
            style={{ padding: "6px 8px" }}
            title="MVP role selector"
          >
            <option value="SuperUser">SuperUser</option>
            <option value="InternalUser">InternalUser</option>
            <option value="ExternalUser">ExternalUser</option>
          </select>

          <Button onClick={resetAll}>RESET</Button>
        </div>
      </div>

      {/* Actions row */}
      {(perms.canUpload || perms.canManageUsers) && (
        <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
          {perms.canUpload && page === "quote" && (
            <UploadExcel
              onData={(cat) => {
                setCatalog(cat);
                setItems(cat.products.map((p) => ({ ...p, checked: false, qty: 1 })));
                setPage("quote");
              }}
            />
          )}

          {perms.canManageUsers && (
            <Button
              variant="outlined"
              onClick={() => setPage(page === "users" ? "quote" : "users")}
            >
              {page === "users" ? "Back to Quotation" : "User Management"}
            </Button>
          )}
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
                ? "Upload a product workbook to begin."
                : "Please ask a SuperUser to upload the product file."}
            </div>
          )}

          {catalog && items.length > 0 && perms.canQuote && (
            <>
              <ItemSelector
                items={items}
                onChange={setItems}
                automationEnabled={automationEnabled}
                setAutomationEnabled={setAutomationEnabled}
                catalog={catalog}
              />
              <QuoteSummary items={items} automationEnabled={automationEnabled} />
            </>
          )}
        </>
      )}
    </Container>
  );
}
