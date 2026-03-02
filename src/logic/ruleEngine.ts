// FILE: src/logic/ruleEngine.ts
// Lightweight rule engine for the Excel E3 model (PRODUCTS + RULES)

import type { Catalog, ConfigState, Product, RuleAction, RuleCondition } from "../types";

/* =================================================================================
 * Small utilities
 * ================================================================================= */

function cloneState(state: ConfigState): ConfigState {
  return {
    ...state,
    selections: new Map(state.selections),
    selectedBom: new Map(state.selectedBom),
    quantities: new Map(state.quantities),
  };
}

function getOptionsForGroup(catalog: Catalog, group: string): Product[] {
  return catalog.items.filter((i) => i.group === group);
}

function getSelectedProductsForGroup(state: ConfigState, group: string): Product[] {
  const sku = state.selections.get(group);
  if (!sku) return [];

  const product = state.catalog.bySKU.get(sku);
  return product ? [product] : [];
}

/* =================================================================================
 * Defaults / Required / Basic operations
 * ================================================================================= */

function applyGroupDefaults(state: ConfigState): ConfigState {
  const next = cloneState(state);

  for (const group of next.catalog.groups) {
    if (next.selections.has(group)) continue;

    const options = getOptionsForGroup(next.catalog, group);
    const def = options.find((o) => o.default) ?? options[0];

    if (def) next.selections.set(group, def.sku);
  }

  return next;
}

function setDefaultInGroup(state: ConfigState, group: string, sku?: string): ConfigState {
  const next = cloneState(state);
  const currentSelection = next.selections.get(group);

  if (currentSelection) {
    const selectedProduct = next.catalog.bySKU.get(currentSelection);
    if (selectedProduct?.group === group) return next;
  }

  if (group && sku) {
    const product = next.catalog.bySKU.get(sku);
    if (product && product.group === group) {
      next.selections.set(group, sku);
    }
  } else if (group) {
    const fallback = getOptionsForGroup(next.catalog, group).find((o) => o.default);
    if (fallback) next.selections.set(group, fallback.sku);
  }

  return next;
}

function requireSelection(state: ConfigState, group: string): ConfigState {
  const next = cloneState(state);

  const options = getOptionsForGroup(next.catalog, group);
  const current = next.selections.get(group);

  if (current && options.some((o) => o.sku === current)) {
    next.selections.set(group, current);
    return next;
  }

  const def = options.find((o) => o.default) ?? options[0];
  if (def) next.selections.set(group, def.sku);

  return next;
}

function clearSelection(state: ConfigState, group: string): ConfigState {
  const next = cloneState(state);
  next.selections.delete(group);
  return next;
}

function autoSelectSku(state: ConfigState, sku?: string): ConfigState {
  const next = cloneState(state);
  if (!sku) return next;

  const product = next.catalog.bySKU.get(sku);
  if (!product) return next;

  next.selections.set(product.group, product.sku);
  return next;
}

/* =================================================================================
 * RULE MATCHING — (FIXED)
 * ================================================================================= */

/**
 * Correct semantics:
 * - If IF_Group is empty → treat as system rule
 * - If IF_Group equals the selected system's group → system rule
 * - Otherwise → ONLY match inside that exact group
 */
export function ruleMatches(condition: RuleCondition, state: ConfigState): boolean {
  const targetGroup = condition.group?.trim();

  const appliesToSystem = !targetGroup || targetGroup.toLowerCase() === "system";

  const candidates: Product[] = appliesToSystem
    ? state.system
      ? [state.system]
      : []
    : getSelectedProductsForGroup(state, targetGroup!);

  if (candidates.length === 0) return false;

  return candidates.some((subject) => {
    if (condition.sku && condition.sku !== subject.sku) return false;

    const subjectName = (subject.name || "").toUpperCase();

    if (condition.contains && !subjectName.includes(condition.contains.toUpperCase())) return false;

    if (condition.notContains && subjectName.includes(condition.notContains.toUpperCase()))
      return false;

    return true;
  });
}

/* =================================================================================
 * Rule actions
 * ================================================================================= */

export function applyRuleAction(action: RuleAction, state: ConfigState): ConfigState {
  const { action: kind, group, sku } = action;

  switch (kind) {
    case "setDefault":
      return setDefaultInGroup(state, group, sku);

    case "require":
      return requireSelection(state, group);

    case "block":
      return clearSelection(state, group);

    case "autoSelect":
      return autoSelectSku(state, sku);

    case "clearDefault":
      return clearSelection(state, group);

    default:
      return state;
  }
}

/* =================================================================================
 * PUBLIC API
 * ================================================================================= */

export function selectSystem(system: Product, state: ConfigState): ConfigState {
  let next: ConfigState = {
    ...state,
    system,
    selections: new Map(),
  };

  next = applyGroupDefaults(next);
  next = next.automation ? applyRules(next) : next;

  return next;
}

export function selectItem(group: string, sku: string, state: ConfigState): ConfigState {
  const next = cloneState(state);

  const product = next.catalog.bySKU.get(sku);
  if (!product || product.group !== group) return next;

  next.selections.set(group, sku);

  return state.automation ? applyRules(next) : next;
}

export function applyRules(state: ConfigState): ConfigState {
  if (!state.automation) return state;

  let next = cloneState(state);

  for (const rule of state.catalog.rules) {
    if (!rule.enabled) continue;
    if (ruleMatches(rule.if, next)) {
      next = applyRuleAction(rule.then, next);
    }
  }

  return next;
}

export function createInitialState(catalog: Catalog): ConfigState {
  return {
    catalog,
    system: undefined,
    selections: new Map(),
    automation: true,
    selectedBom: new Map(),
    quantities: new Map(),
  };
}
