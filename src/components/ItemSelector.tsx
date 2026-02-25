import React from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  Divider,
  Stack,
} from "@mui/material";
import type { ConfigState, Product, SelectionValue } from "../types";
import { applyRules, selectSystem, selectItem } from "../logic/ruleEngine.ts";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";

const SOFTWARE_GROUP = "Software Options"; // must match your PRODUCTS group name exactly

interface Props {
  state: ConfigState;
  setState: React.Dispatch<React.SetStateAction<ConfigState | null>>;
}

const asArray = (v: SelectionValue | undefined): string[] => (!v ? [] : Array.isArray(v) ? v : [v]);

/**
 * ItemSelector v2
 * - Renders Level 1 "System" dropdown
 * - Then renders groups in level order
 * - Options for each group shown as Select dropdowns
 * - Automation toggle wired in
 * - Shows BOM lines under the selected parent (system + any group selection with BOM)
 */
export default function ItemSelector({ state, setState }: Props) {
  const { catalog, selections, automation, system } = state;

  const getOptionsForGroup = (group: string): Product[] =>
    catalog.items.filter((i) => i.group === group);

  const bomForSku = (sku?: string) => (sku ? catalog.bomByParentSku?.get(sku) : undefined);

  // --------------------------
  // System selection handler
  // --------------------------
  const handleSystemSelect = (sku: string) => {
    const sys = catalog.systems.find((s) => s.sku === sku);
    if (!sys) return;

    setState((prev) => {
      if (!prev) return prev;
      let next = selectSystem(sys, prev);
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

  const renderBom = (parentSku?: string) => {
    const bomLines = bomForSku(parentSku);
    if (!bomLines?.length) return null;

    return (
      <Box sx={{ mt: 1, ml: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Includes:
        </Typography>

        <Stack spacing={0.5}>
          {bomLines.map((line, idx) => {
            const p = catalog.bySKU.get(line.sku);
            const label = p?.name ?? line.name ?? line.sku;
            return (
              <Typography
                key={`${parentSku}-${line.sku}-${idx}`}
                variant="body2"
                color="text.secondary"
              >
                {line.qty} × {line.sku} — {label}
              </Typography>
            );
          })}
        </Stack>
      </Box>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* ---------------------- */}
      {/* SYSTEM SELECTION */}
      {/* ---------------------- */}
      <Box>
        <Typography variant="h6">Select HiPAP System</Typography>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel>System</InputLabel>
          <Select
            value={system?.sku || ""}
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

      {/* ---------------------- */}
      {/* AUTOMATION TOGGLE */}
      {/* ---------------------- */}
      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={automation}
              onChange={() =>
                setState((prev) => {
                  if (!prev) return prev;
                  return { ...prev, automation: !prev.automation };
                })
              }
            />
          }
          label="Automation Enabled"
        />
      </Box>

      <Divider />

      {/* ---------------------- */}
      {/* GROUP SECTIONS */}
      {/* ---------------------- */}
      {catalog.groups.map((group) => {
        const isSoftware = group === SOFTWARE_GROUP;

        const selectedSkus = asArray(selections.get(group));
        const selectedForControl = isSoftware ? selectedSkus : (selectedSkus[0] ?? "");

        // For BOM display under the selector: only makes sense for single-choice groups.
        const parentSkuForBom = !isSoftware ? selectedSkus[0] : undefined;

        return (
          <Box key={group} sx={{ my: 2 }}>
            <Typography variant="h6">{group}</Typography>

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
                      const next = { ...prev, selections: new Map(prev.selections) };
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

            {/* BOM under selected parent option */}
            {renderBom(parentSkuForBom)}

            <Divider sx={{ mt: 2 }} />
          </Box>
        );
      })}
    </Box>
  );
}
