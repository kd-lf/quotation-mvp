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
} from "@mui/material";
import type { ConfigState, Product } from "../types";
import { applyRules, selectSystem, selectItem } from "../logic/ruleEngine.ts"; // You will create this file next
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";

const SOFTWARE_GROUP = "Software Options"; // must match your PRODUCTS group name exactly

interface Props {
  state: ConfigState;
  setState: React.Dispatch<React.SetStateAction<ConfigState | null>>;
}

/**
 * ItemSelector v2
 * - Renders Level 1 "System" dropdown
 * - Then renders groups in level order
 * - Options for each group shown as Select dropdowns
 * - Automation toggle wired in
 */
export default function ItemSelector({ state, setState }: Props) {
  const { catalog, selections, automation, system } = state;

  // --------------------------
  // System selection handler
  // --------------------------

  const handleSystemSelect = (sku: string) => {
    const sys = catalog.systems.find((s) => s.sku === sku);
    if (!sys) return;

    setState((prev) => {
      if (!prev) return prev; // <— guard for null
      let next = selectSystem(sys, prev); // prev is now non-null
      if (next.automation) next = applyRules(next);
      return next;
    });
  };

  // --------------------------
  // Option selection handler
  // --------------------------

  const handleOptionSelect = (group: string, sku: string) => {
    setState((prev) => {
      if (!prev) return prev; // <— guard for null
      let next = selectItem(group, sku, prev); // prev is now non-null
      if (next.automation) next = applyRules(next);
      return next;
    });
  };

  // --------------------------
  // Group → options
  // --------------------------
  const getOptionsForGroup = (group: string): Product[] =>
    catalog.items.filter((i) => i.group === group);

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
                  if (!prev) return prev; // keep null as null safely
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

        const raw = selections.get(group);
        const selected = Array.isArray(raw) ? raw : raw ? [raw] : [];

        return (
          <Box key={group} sx={{ my: 2 }}>
            <Typography variant="h6">{group}</Typography>

            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>{group}</InputLabel>

              <Select
                multiple={isSoftware}
                value={isSoftware ? selected : (selected[0] ?? "")}
                label={group}
                onChange={(e) => {
                  const v = e.target.value;

                  if (isSoftware) {
                    // v is string[] when multiple=true
                    // easiest: toggle via selectItem by diffing OR create a setGroupSelection function
                    // minimal: set whole array in state directly
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
                        <Checkbox checked={selected.includes(item.sku)} />
                        <ListItemText primary={item.name} />
                      </>
                    ) : (
                      item.name
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Divider sx={{ mt: 2 }} />
          </Box>
        );
      })}
    </Box>
  );
}
