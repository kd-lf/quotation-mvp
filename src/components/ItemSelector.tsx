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
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { exportQuoteToExcel } from "../logic/exportQuote";
import { exportCrmReportToExcel } from "../logic/exportCrmReport";
import UploadQuote from "./UploadQuote";
import expandConfigToQuoteItems from "../logic/expandConfigToQuoteItems";
import { generateQuotePdf } from "../logic/generateQuotePdf";

import type { ConfigState, Product, SelectionValue } from "../types";
import { applyRules, selectSystem, selectItem } from "../logic/ruleEngine.ts";

const SOFTWARE_GROUP = "Software Options"; // Must match PRODUCTS sheet

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

/**
 * ItemSelector v3
 * - Adds checkboxes for BOM children (optional accessories)
 * - Persists BOM selections inside state.selectedBom
 * - Works for system BOM and group-level BOMs
 */

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
  const { catalog, selections, system, selectedBom } = state;

  const getOptionsForGroup = (group: string): Product[] =>
    catalog.items.filter((i) => i.group === group);

  const bomForSku = (sku?: string) => (sku ? catalog.bomByParentSku?.get(sku) : undefined);

  const ensureBomPreselected = (parentSku: string, bomLines: any[]) => {
    setState((prev) => {
      if (!prev) return prev;

      const map = new Map(prev.selectedBom);

      // If already populated, do nothing (user may have edited it)
      if (map.has(parentSku)) return prev;

      const set = new Set(bomLines.map((line) => line.sku));
      map.set(parentSku, set);

      return { ...prev, selectedBom: map };
    });
  };

  // --------------------------
  // System selection handler
  // --------------------------
  const handleSystemSelect = (sku: string) => {
    const sys = catalog.systems.find((s) => s.sku === sku);
    if (!sys) return;

    setState((prev) => {
      if (!prev) return prev;
      let next = selectSystem(sys, prev);

      // Reset BOM selection for new system
      next = { ...next, selectedBom: new Map() };

      if (next.automation) next = applyRules(next);
      return next;
    });
  };

  // --------------------------
  // Option selection handler
  // --------------------------
  const handleOptionSelect = (group: string, sku: string) => {
    setState((prev) => {
      if (!prev) return prev;
      let next = selectItem(group, sku, prev);

      if (next.automation) next = applyRules(next);
      return next;
    });
  };

  // --------------------------
  // Render BOM (with checkboxes)
  // --------------------------

  const renderBom = (parentSku?: string) => {
    const bomLines = bomForSku(parentSku);
    if (!bomLines?.length) return null;

    const [expanded, setExpanded] = React.useState(false);

    // Preselect BOM children first time
    if (parentSku && bomLines.length) {
      ensureBomPreselected(parentSku, bomLines);
    }

    const selectedSet = selectedBom.get(parentSku!) ?? new Set();

    // ✔ Count only checked
    const checkedCount = Array.from(selectedSet).length;

    // ✔ Total count
    const totalCount = bomLines.length;

    const toggleBom = (childSku: string) => {
      setState((prev) => {
        if (!prev) return prev;

        const map = new Map(prev.selectedBom);
        const set = new Set(map.get(parentSku!) ?? []);

        if (set.has(childSku)) set.delete(childSku);
        else set.add(childSku);

        map.set(parentSku!, set);
        return { ...prev, selectedBom: map };
      });
    };

    return (
      <Box sx={{ mt: 1, ml: 1 }}>
        {/* Collapsible header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? (
            <ExpandLessIcon fontSize="small" sx={{ mr: 0.5 }} />
          ) : (
            <ExpandMoreIcon fontSize="small" sx={{ mr: 0.5 }} />
          )}

          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Includes {checkedCount} / {totalCount}
          </Typography>
        </Box>

        {/* Collapsing content */}
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Stack spacing={0.2} sx={{ mt: 1 }}>
            {bomLines.map((line, idx) => {
              const p = catalog.bySKU.get(line.sku);
              const label = p?.name ?? line.name ?? line.sku;

              return (
                <Box
                  key={`${parentSku}-${line.sku}-${idx}`}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Checkbox
                    size="small"
                    checked={selectedSet.has(line.sku)}
                    onChange={() => toggleBom(line.sku)}
                  />

                  
                  <Typography variant="body2" color="text.secondary">
                    {line.qty} × {line.sku} — {label}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Collapse>
      </Box>



    );
  };

  // -------------------------------------------------------------
  // UI (system selector, automation toggle, group selectors, BOM)
  // -------------------------------------------------------------
  return (
    
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
{/* QUOTE ACTIONS */}
<Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", mt: 2 }}>
  <Button
    variant="contained"
    onClick={() =>
      exportQuoteToExcel(
        state,
        priceMap,                  // <-- Comes from App.tsx
        priceBookName,
        priceBookEntries,
        priceBookUploadedAt
      )
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

  <Button
    variant="contained"
    color="secondary"
    onClick={() =>
      generateQuotePdf(
        expandConfigToQuoteItems({ ...state, priceMap, negotiatedPriceMap }),
        state.automation,
        30
      )
    }
  >
    Generate PDF
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


      {/* SYSTEM SELECTION */}
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

        {/* BOM under selected system */}
        {renderBom(system?.sku)}
      </Box>

      {/* AUTOMATION TOGGLE */}

      {/* GROUP SELECTIONS */}
      {catalog.groups.map((group) => {
        const isSoftware = group === SOFTWARE_GROUP;
        const selectedSkus = asArray(selections.get(group));
        const selectedForControl = isSoftware ? selectedSkus : (selectedSkus[0] ?? "");

        // Single-choice groups show their BOM
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
                    // Multi-choice
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
                    // Single choice
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

            {/* BOM under selected group option */}
            {renderBom(parentSkuForBom)}
          </Box>
        );
      })}
    </Box>
  );
}
