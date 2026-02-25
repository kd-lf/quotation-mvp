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
        const selectedSKU = selections.get(group) || "";

        return (
          <Box key={group} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
              {group}
            </Typography>

            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>{group}</InputLabel>

              <Select
                value={selectedSKU}
                label={group}
                onChange={(e) => handleOptionSelect(group, e.target.value)}
              >
                {getOptionsForGroup(group).map((item) => (
                  <MenuItem key={item.sku} value={item.sku}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        );
      })}
    </Box>
  );
}
