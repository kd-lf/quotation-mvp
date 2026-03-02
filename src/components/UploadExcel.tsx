// FILE: src/components/UploadExcel.tsx
import * as XLSX from "xlsx";
import { Alert, Button, Stack } from "@mui/material";
import { useCallback, useRef, useState } from "react";
import type { Catalog, Product, Rule, RuleAction, RuleCondition } from "../types";
import type { BomLine } from "../types";

function toSku(v: unknown): string {
  return String(v ?? "").trim();
}

function toNum(v: unknown, fallback: number): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (v == null || String(v).trim() === "") return fallback;
  const normalized = String(v).trim().toLowerCase();
  return ["yes", "true", "1", "y"].includes(normalized);
}

function parseBomSheet(workbook: XLSX.WorkBook): Map<string, BomLine[]> {
  const sheet = workbook.Sheets["BOM"];
  const map = new Map<string, BomLine[]>();
  if (!sheet) return map;

  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
  for (const r of rows) {
    const parent = toSku(r.Parent);
    const sku = toSku(r.SKU);
    if (!parent || !sku) continue;

    const qty = Math.max(1, Math.floor(toNum(r.Quantity, 1)));
    const name = toSku(r.Name) || undefined;

    const rawPrice = r.Price;
    const priceNum = toNum(rawPrice, NaN);
    const price = Number.isFinite(priceNum) ? priceNum : undefined;

    const autoSelected = toBool(r.AutoSelected, true);

    const line: BomLine = { sku, qty, autoSelected, name, price };
    const arr = map.get(parent) ?? [];
    arr.push(line);
    map.set(parent, arr);
  }

  return map;
}

function generateAutoSKU(index: number): string {
  return `AUTO-${String(index).padStart(4, "0")}`;
}

const norm = (s: string) => s.trim().toLowerCase();

function getHeaderKeys(sheet: XLSX.WorkSheet): string[] {
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  return (rows[0] ?? []).map((x) => String(x).trim()).filter(Boolean);
}

function validateRequiredHeaders(
  sheet: XLSX.WorkSheet,
  required: string[],
  sheetName: string,
): string[] {
  const present = new Set(getHeaderKeys(sheet).map(norm));
  const missing = required.filter((h) => !present.has(norm(h)));
  return missing.length ? [`${sheetName} missing column(s): ${missing.join(", ")}`] : [];
}

export default function UploadExcel({
  onData,
  hasBook,
  onReset,
}: {
  onData: (catalog: Catalog) => void;
  hasBook: boolean;
  onReset: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setErrors([]);
      setWarnings([]);
      setBusy(true);

      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });

        const productsSheet = workbook.Sheets["PRODUCTS"];
        const rulesSheet = workbook.Sheets["RULES"];

        const nextErrors: string[] = [];
        const nextWarnings: string[] = [];

        if (!productsSheet) nextErrors.push("Missing sheet: PRODUCTS");
        if (!rulesSheet) nextErrors.push("Missing sheet: RULES");

        if (productsSheet) {
          nextErrors.push(
            ...validateRequiredHeaders(productsSheet, ["Level", "Group", "Name"], "PRODUCTS"),
          );
          nextWarnings.push(
            ...validateRequiredHeaders(
              productsSheet,
              ["SKU", "Default", "Price", "Currency", "Notes"],
              "PRODUCTS",
            ).map((m) => `${m} (some features may be limited)`),
          );
        }

        if (rulesSheet) {
          nextErrors.push(
            ...validateRequiredHeaders(
              rulesSheet,
              ["RuleID", "Enabled", "THEN_Action", "THEN_Group"],
              "RULES",
            ),
          );
          nextWarnings.push(
            ...validateRequiredHeaders(
              rulesSheet,
              ["IF_Group", "IF_SKU", "IF_Contains", "THEN_SKU"],
              "RULES",
            ).map((m) => `${m} (some rules may not work as expected)`),
          );
        }

        if (nextErrors.length) {
          setErrors(nextErrors);
          setWarnings(nextWarnings);
          return;
        }

        setWarnings(nextWarnings);

        // =======================
        // PARSE PRODUCTS
        // =======================
        const productRows = XLSX.utils.sheet_to_json<any>(productsSheet!, { defval: "" });
        const ruleRows = XLSX.utils.sheet_to_json<any>(rulesSheet!, { defval: "" });

        const products: Product[] = [];
        let autoCount = 1;

        for (const row of productRows) {
          if (!row.Name) continue;

          const rawSku = String(row.SKU ?? "").trim();
          const isPlaceholder = rawSku === "" || rawSku === "-" || /^n\/?a$/i.test(rawSku);

          const sku = isPlaceholder ? generateAutoSKU(autoCount++) : rawSku;

          products.push({
            level: Number(row.Level) || 0,
            group: row.Group?.toString().trim() || "",
            name: row.Name?.toString().trim() || "",
            sku,
            default: String(row.Default ?? "")
              .toLowerCase()
              .includes("yes"),
            price: row.Price !== "" && row.Price != null ? Number(row.Price) : undefined,
            currency: row.Currency ? String(row.Currency).trim() : undefined,
            notes: row.Notes ? String(row.Notes).trim() : undefined,
          });
        }

        const systems = products.filter((p) => p.level === 1);
        const items = products.filter((p) => p.level > 1);

        const groups = Array.from(
          new Set(
            items
              .slice()
              .sort((a, b) => a.level - b.level)
              .map((item) => item.group),
          ),
        );

        // =======================
        // PARSE RULES
        // =======================
        const rules: Rule[] = ruleRows
          .map((r: any) => {
            if (!r.RuleID) return null;

            const containsRaw = r.IF_Contains?.toString().trim() || "";
            const isNegation = containsRaw.startsWith("!");

            const cond: RuleCondition = {
              group: r.IF_Group?.toString().trim() || undefined,
              sku: r.IF_SKU?.toString().trim() || undefined,
              contains: !isNegation ? containsRaw || undefined : undefined,
              notContains: isNegation ? containsRaw.substring(1) : undefined,
            };

            const action: RuleAction = {
              action: r.THEN_Action?.toString().trim(),
              group: r.THEN_Group?.toString().trim(),
              sku: r.THEN_SKU?.toString().trim() || undefined,
            };

            const rule: Rule = {
              id: String(r.RuleID).trim(),
              enabled: String(r.Enabled ?? "")
                .toLowerCase()
                .includes("yes"),
              if: cond,
              then: action,
            };

            return rule;
          })
          .filter(Boolean) as Rule[];

        // =======================
        // BUILD SKU INDEX
        // =======================
        const bySKU = new Map<string, Product>();
        for (const p of products) bySKU.set(p.sku, p);

        const bomByParentSku = parseBomSheet(workbook);

        const catalog: Catalog = {
          systems,
          items,
          groups,
          rules,
          bySKU,
          bomByParentSku,
        };

        onData(catalog);
      } catch (err) {
        console.error(err);
        setErrors([
          "Failed to read workbook. Check sheet names (PRODUCTS/RULES) and column headers match the template.",
        ]);
      } finally {
        setBusy(false);
      }
    },
    [onData],
  );

  return (
    <Stack spacing={2}>
      {errors.length > 0 && (
        <Alert severity="error">
          <div>Couldn’t load workbook:</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {errors.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Alert>
      )}

      {warnings.length > 0 && errors.length === 0 && (
        <Alert severity="warning">
          <div>Loaded, but check these:</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {warnings.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Alert>
      )}

      {hasBook ? (
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => {
            setErrors([]);
            setWarnings([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
            onReset();
          }}
        >
          {busy ? "WORKING..." : "RESET"}
        </Button>
      ) : (
        <Button variant="contained" component="label" disabled={busy}>
          {busy ? "LOADING..." : "UPLOAD PRODUCT BOOK"}
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept=".xlsx,.xls"
            onChange={handleUpload}
          />
        </Button>
      )}
    </Stack>
  );
}
