// src/types.ts — Configurator v2 (Excel E3: PRODUCTS + RULES)

// ---------- Core product & catalog ----------

export interface Product {
  level: number; // 1 = system, >=2 = component groups (order)
  group: string; // e.g., "Gate Valve", "Hull Unit"
  name: string; // display label
  sku: string; // real SKU or AUTO-xxxx if generated
  default: boolean; // default option within this group
  price?: number;
  currency?: string;
  notes?: string;
}

export interface RuleCondition {
  // Evaluate against the chosen Level-1 system (and later we can extend to group-level events)
  group?: string; // e.g., "HiPAP System"
  sku?: string; // exact match
  contains?: string; // substring to match in system.name (case-insensitive)
  notContains?: string; // negated substring (for "!SINGLE" style)
}

export type RuleActionType = "setDefault" | "require" | "block" | "autoSelect" | "clearDefault";

export interface RuleAction {
  action: RuleActionType;
  group: string; // target group the action applies to
  sku?: string; // optional target SKU (when relevant)
}

export interface Rule {
  id: string; // e.g., "R001"
  enabled: boolean;
  if: RuleCondition;
  then: RuleAction;
}

export interface Catalog {
  systems: Product[]; // Level 1 rows from PRODUCTS
  items: Product[]; // Level >= 2
  groups: string[]; // ordered by Level from PRODUCTS
  rules: Rule[]; // parsed from RULES
  bySKU: Map<string, Product>;
}

// ---------- Live configurator state ----------

export interface ConfigState {
  system?: Product; // selected Level-1 system
  selections: Map<string, string>; // group -> sku
  catalog: Catalog;
  automation: boolean; // automation ON/OFF (your override toggle)
}

// ---------- (Optional) UI helpers ----------

export interface GroupView {
  name: string;
  level: number;
  options: Product[];
  selectedSKU?: string;
}
