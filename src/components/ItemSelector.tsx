import React from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Stack,
  Checkbox,
  ListItemText,
  Collapse,
  Button,
  TextField,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { exportQuoteToExcel } from "../logic/exportQuote";
import { exportCrmReportToExcel } from "../logic/exportCrmReport";
import UploadQuote from "./UploadQuote";
import expandConfigToQuoteItems from "../logic/expandConfigToQuoteItems";
import { generateQuotePdf } from "../logic/generateQuotePdf";

import type { BomLine, ConfigState, Product, SelectionValue } from "../types";
import { applyRules, selectSystem, selectItem } from "../logic/ruleEngine.ts";

const SOFTWARE_GROUP = "Software Options";
const qtyKey = (parentSku: string, sku: string) => `${parentSku}::${sku}`;

interface Props {
  state: ConfigState;
  setState: React.Dispatch<React.SetStateAction<ConfigState | null>>;
  priceMap: Map<string, number> | null;
  priceBookName: string | null;
  priceBookEntries: number | null;
  priceBookUploadedAt: Date | null;
  negotiatedPriceMap: Map<string, number> | null;
  clearNegotiatedPrices: () => void;
  onNegotiatedPrices: (prices: Map<string, number>) => void;
}

const asArray = (v: SelectionValue | undefined): string[] => (!v ? [] : Array.isArray(v) ? v : [v]);

interface BomSectionProps {
  parentSku: string;
  bomLines: BomLine[];
  catalog: ConfigState["catalog"];
  quantities: ConfigState["quantities"];
  selectedSet: Set<string>;
  parentTotal: number;
  getUnitPrice: (sku: string, fallback?: number) => number;
  onToggleBom: (parentSku: string, childSku: string) => void;
  onUpdateQty: (parentSku: string, sku: string, value: string) => void;
  onEnsurePreselected: (parentSku: string, bomLines: BomLine[]) => void;
}

function BomSection({
  parentSku,
  bomLines,
  catalog,
  quantities,
  selectedSet,
  parentTotal,
  getUnitPrice,
  onToggleBom,
  onUpdateQty,
  onEnsurePreselected,
}: BomSectionProps) {
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    onEnsurePreselected(parentSku, bomLines);
  }, [parentSku, bomLines, onEnsurePreselected]);

  const checkedCount = Array.from(selectedSet).length;
  const totalCount = bomLines.length;

  return (
    <Box sx={{ mt: 1, ml: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none",
          justifyContent: "space-between",
          pr: 1,
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {expanded ? (
            <ExpandLessIcon fontSize="small" sx={{ mr: 0.5 }} />
          ) : (
            <ExpandMoreIcon fontSize="small" sx={{ mr: 0.5 }} />
          )}

          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Includes {checkedCount} / {totalCount}
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {parentTotal.toFixed(2)} NOK
        </Typography>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {bomLines.map((line, idx) => {
            const product = catalog.bySKU.get(line.sku);
            const label = product?.name ?? line.name ?? line.sku;
            const qty = quantities.get(qtyKey(parentSku, line.sku)) ?? line.qty ?? 1;
            const unitPrice = getUnitPrice(line.sku, line.price);

            return (
              <Box key={`${parentSku}-${line.sku}-${idx}`} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Checkbox
                  size="small"
                  checked={selectedSet.has(line.sku)}
                  onChange={() => onToggleBom(parentSku, line.sku)}
                />

                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {line.sku} — {label}
                </Typography>

                <TextField
                  size="small"
                  type="number"
                  label="Qty"
                  value={qty}
                  onChange={(e) => onUpdateQty(parentSku, line.sku, e.target.value)}
                  inputProps={{ min: 0, step: 1, style: { width: 64 } }}
                />

                <Typography
                  variant="body2"
                  sx={{ width: 120, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                >
                  {(unitPrice * qty).toFixed(2)} NOK
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Collapse>
    </Box>
  );
}

export default function ItemSelector({
  state,
  setState,
  priceMap,
  priceBookName,
  priceBookEntries,
  priceBookUploadedAt,
  negotiatedPriceMap,
  clearNegotiatedPrices,
  onNegotiatedPrices,
}: Props) {
  const [exportParentsOnly, setExportParentsOnly] = React.useState(false);
  const { catalog, selections, system, selectedBom, quantities } = state;

  const getOptionsForGroup = (group: string): Product[] =>
    catalog.items.filter((i) => i.group === group);

  const bomForSku = (sku?: string) => (sku ? catalog.bomByParentSku?.get(sku) : undefined);

  const getUnitPrice = (sku: string, fallback?: number) => {
    const normSku = String(sku).replace(/[\s\u00A0]/g, "").trim().toUpperCase();

    if (negotiatedPriceMap?.has(normSku)) return negotiatedPriceMap.get(normSku)!;
    if (priceMap?.has(normSku)) return priceMap.get(normSku)!;
    if (typeof fallback === "number") return fallback;
    const p = catalog.bySKU.get(sku)?.price;
    return typeof p === "number" ? p : 0;
  };

  const ensureBomPreselected = React.useCallback((parentSku: string, bomLines: BomLine[]) => {
    setState((prev) => {
      if (!prev) return prev;

      const map = new Map(prev.selectedBom);
      const qtyMap = new Map(prev.quantities);
      let changed = false;

      if (!map.has(parentSku)) {
        map.set(parentSku, new Set(bomLines.map((line) => line.sku)));
        changed = true;
      }

      for (const line of bomLines) {
        const key = qtyKey(parentSku, line.sku);
        if (!qtyMap.has(key)) {
          qtyMap.set(key, Math.max(0, Number(line.qty ?? 1) || 1));
          changed = true;
        }
      }

      if (!changed) return prev;
      return { ...prev, selectedBom: map, quantities: qtyMap };
    });
  }, [setState]);

  const handleSystemSelect = (sku: string) => {
    const sys = catalog.systems.find((s) => s.sku === sku);
    if (!sys) return;

    setState((prev) => {
      if (!prev) return prev;
      let next = selectSystem(sys, prev);

      next = { ...next, selectedBom: new Map(), quantities: new Map() };

      if (next.automation) next = applyRules(next);
      return next;
    });
  };

  const handleOptionSelect = (group: string, sku: string) => {
    setState((prev) => {
      if (!prev) return prev;
      let next = selectItem(group, sku, prev);

      if (next.automation) next = applyRules(next);
      return next;
    });
  };

  const updateQty = (parentSku: string, sku: string, value: string) => {
    const parsed = Number(value);
    const safeQty = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;

    setState((prev) => {
      if (!prev) return prev;
      const nextQty = new Map(prev.quantities);
      nextQty.set(qtyKey(parentSku, sku), safeQty);
      return { ...prev, quantities: nextQty };
    });
  };

  const getBomTotal = (parentSku: string, lines: BomLine[], selectedSet: Set<string>) =>
    lines.reduce((sum, line) => {
      const qty = quantities.get(qtyKey(parentSku, line.sku)) ?? line.qty ?? 1;
      if (!selectedSet.has(line.sku) || qty <= 0) return sum;
      return sum + getUnitPrice(line.sku, line.price) * qty;
    }, 0);

  const renderStandaloneRow = (sku: string) => {
    const product = catalog.bySKU.get(sku);
    if (!product) return null;

    const qty = quantities.get(qtyKey(sku, sku)) ?? 1;
    const unitPrice = getUnitPrice(sku, product.price);

    return (
      <Box key={sku} sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
            {product.sku}
          </Typography>
          <TextField
            size="small"
            type="number"
            label="Qty"
            value={qty}
            onChange={(e) => updateQty(sku, sku, e.target.value)}
            inputProps={{ min: 0, step: 1, style: { width: 64 } }}
          />
          <Typography variant="body2" sx={{ width: 140, textAlign: "right", fontWeight: 600 }}>
            {(unitPrice * qty).toFixed(2)} NOK
          </Typography>
        </Box>
      </Box>
    );
  };

  const toggleBom = (parentSku: string, childSku: string) => {
    setState((prev) => {
      if (!prev) return prev;

      const map = new Map(prev.selectedBom);
      const set = new Set(map.get(parentSku) ?? []);

      if (set.has(childSku)) set.delete(childSku);
      else set.add(childSku);

      map.set(parentSku, set);
      return { ...prev, selectedBom: map };
    });
  };

  const renderBom = (parentSku?: string) => {
    const bomLines = bomForSku(parentSku);
    if (!parentSku || !bomLines?.length) return null;

    const selectedSet = selectedBom.get(parentSku) ?? new Set<string>();
    const parentTotal = getBomTotal(parentSku, bomLines, selectedSet);

    return (
      <BomSection
        parentSku={parentSku}
        bomLines={bomLines}
        catalog={catalog}
        quantities={quantities}
        selectedSet={selectedSet}
        parentTotal={parentTotal}
        getUnitPrice={getUnitPrice}
        onToggleBom={toggleBom}
        onUpdateQty={updateQty}
        onEnsurePreselected={ensureBomPreselected}
      />
    );
  };

  const getPdfItems = () => {
    const items = expandConfigToQuoteItems({ ...state, priceMap, negotiatedPriceMap });
    if (!exportParentsOnly) return items;

    return items
      .filter((item) => item.checked && (item.isHeader || item.isBoldParent))
      .map((item) => ({
        ...item,
        isHeader: false,
        isBoldParent: true,
        qty: item.qty ?? 1,
        checked: true,
      }));
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", mt: 2, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          onClick={() =>
            exportQuoteToExcel(state, priceMap, priceBookName, priceBookEntries, priceBookUploadedAt)
          }
        >
          Export Quote
        </Button>

        <Button
          variant="outlined"
          onClick={() => exportCrmReportToExcel(state, priceMap, negotiatedPriceMap)}
        >
          Export CRM Report
        </Button>

        <UploadQuote
          catalog={state.catalog}
          setState={setState}
          onNegotiatedPrices={onNegotiatedPrices}
        />

        {negotiatedPriceMap && (
          <Button variant="text" color="secondary" onClick={clearNegotiatedPrices}>
            Clear Negotiated Prices
          </Button>
        )}
      </Box>

      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", alignItems: "center", mt: -1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Checkbox
            size="small"
            checked={exportParentsOnly}
            onChange={(e) => setExportParentsOnly(e.target.checked)}
          />
          <Typography variant="body2">Only export parents (no children)</Typography>
        </Box>

        <Button
          variant="contained"
          color="secondary"
          onClick={() => generateQuotePdf(getPdfItems(), state.automation, 30)}
        >
          Generate PDF
        </Button>
      </Box>

      <Box>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel>System</InputLabel>
          <Select
            value={system?.sku ?? ""}
            label="System"
            onChange={(e) => handleSystemSelect(e.target.value)}
          >
            {catalog.systems.map((sys) => (
              <MenuItem key={sys.sku} value={sys.sku}>
                {sys.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {system && !(bomForSku(system.sku)?.length) && renderStandaloneRow(system.sku)}
        {renderBom(system?.sku)}
      </Box>

      {catalog.groups.map((group) => {
        const isSoftware = group === SOFTWARE_GROUP;
        const selectedSkus = asArray(selections.get(group));
        const selectedForControl = isSoftware ? selectedSkus : (selectedSkus[0] ?? "");
        const parentSkuForBom = !isSoftware ? selectedSkus[0] : undefined;

        return (
          <Box key={group} sx={{ my: 2 }}>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>{group}</InputLabel>

              <Select
                multiple={isSoftware}
                value={selectedForControl}
                label={group}
                onChange={(e) => {
                  const v = e.target.value;

                  if (isSoftware) {
                    const nextSkus = typeof v === "string" ? [v] : (v as string[]);
                    setState((prev) => {
                      if (!prev) return prev;
                      const next = {
                        ...prev,
                        selections: new Map(prev.selections),
                      };
                      next.selections.set(group, nextSkus);
                      return next.automation ? applyRules(next) : next;
                    });
                  } else {
                    handleOptionSelect(group, v as string);
                  }
                }}
                renderValue={(val) =>
                  Array.isArray(val)
                    ? val.map((sku) => catalog.bySKU.get(sku)?.name ?? sku).join(", ")
                    : (catalog.bySKU.get(val as string)?.name ?? (val as string))
                }
              >
                {getOptionsForGroup(group).map((item) => (
                  <MenuItem key={item.sku} value={item.sku}>
                    {isSoftware ? (
                      <>
                        <Checkbox checked={selectedSkus.includes(item.sku)} />
                        <ListItemText primary={item.name} />
                      </>
                    ) : (
                      item.name
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {isSoftware && selectedSkus.map((sku) => renderStandaloneRow(sku))}
            {!isSoftware && parentSkuForBom && !(bomForSku(parentSkuForBom)?.length) &&
              renderStandaloneRow(parentSkuForBom)}

            {renderBom(parentSkuForBom)}
          </Box>
        );
      })}
    </Box>
  );
}
