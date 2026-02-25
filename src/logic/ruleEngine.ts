// src/logic/ruleEngine.ts
// Lightweight rule engine for the Excel E3 model (PRODUCTS + RULES)

import type { Catalog, ConfigState, Product, RuleAction, RuleCondition } from "../types";

/* =================================================================================
 * Small utilities
 * ================================================================================= */

type SelectionValue = string | string[];

function asArray(v: SelectionValue | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function cloneState(state: ConfigState): ConfigState {
  return {
    ...state,
    selections: new Map(state.selections),
  };
}

function getOptionsForGroup(catalog: Catalog, group: string): Product[] {
  return catalog.items.filter((i) => i.group === group);
}

function getSelectedProductsForGroup(state: ConfigState, group: string): Product[] {
  const v = state.selections.get(group);
  const skus = asArray(v);
  return skus.map((sku) => state.catalog.bySKU.get(sku)).filter((p): p is Product => !!p);
}

/* =================================================================================
 * Defaults and core mutations
 * ================================================================================= */

/**
 * Populate default selections for all groups (idempotent; will not override an existing selection).
 */
function applyGroupDefaults(state: ConfigState): ConfigState {
  const next = cloneState(state);

  for (const group of next.catalog.groups) {
    if (next.selections.has(group)) continue; // keep user / previous choice
    const def = getOptionsForGroup(next.catalog, group).find((o) => o.default);
    if (def) next.selections.set(group, def.sku);
  }
  return next;
}

/**
 * Force a specific default inside a group (overwrites current selection).
 */
function setDefaultInGroup(state: ConfigState, group: string, sku?: string): ConfigState {
  const next = cloneState(state);

  if (group && sku) {
    // Only set if the SKU exists and belongs to the group
    const product = next.catalog.bySKU.get(sku);
    if (product && product.group === group) {
      next.selections.set(group, sku);
    }
  } else if (group && !sku) {
    // If no SKU provided, fall back to the first flagged default in the group
    const fallback = getOptionsForGroup(next.catalog, group).find((o) => o.default);
    if (fallback) next.selections.set(group, fallback.sku);
  }

  return next;
}

/**
 * Ensure a group has *some* valid selection; use flagged default if none.
 */
function requireSelection(state: ConfigState, group: string): ConfigState {
  const next = cloneState(state);

  const options = getOptionsForGroup(next.catalog, group);
  const current = asArray(next.selections.get(group));

  // keep only valid SKUs that exist in options
  const valid = current.filter((sku) => options.some((o) => o.sku === sku));

  if (valid.length > 0) {
    next.selections.set(group, valid.length === 1 ? valid[0] : valid);
    return next;
  }

  const def = options.find((o) => o.default) ?? options[0];
  if (def) next.selections.set(group, def.sku);

  return next;
}

/**
 * Remove any current selection in a group.
 */
function clearSelection(state: ConfigState, group: string): ConfigState {
  const next = cloneState(state);
  next.selections.delete(group);
  return next;
}

/**
 * Auto-select a specific SKU (resolves and writes to the SKU's group).
 */
function autoSelectSku(state: ConfigState, sku?: string): ConfigState {
  const next = cloneState(state);

  if (!sku) return next;
  const product = next.catalog.bySKU.get(sku);
  if (!product) return next;

  next.selections.set(product.group, product.sku);
  return next;
}

/* =================================================================================
 * Rule matching
 * ================================================================================= */

/**
 * Match a rule condition. By default we evaluate against the selected Level-1 system.
 * If condition.group targets a specific component group, we evaluate against that group's selection.
 */
export function ruleMatches(condition: RuleCondition, state: ConfigState): boolean {
  const targetGroup = condition.group?.trim();
  const hasSystem = !!state.system;

  const isSystemGroup =
    !targetGroup ||
    /system/i.test(targetGroup) ||
    (hasSystem && targetGroup === state.system?.group);

  const candidates: Product[] = isSystemGroup
    ? state.system
      ? [state.system]
      : []
    : targetGroup
      ? getSelectedProductsForGroup(state, targetGroup)
      : [];

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
      // Block means user cannot select from this group; for now, we clear current selection.
      // (You can wire UI disabling with this knowledge if you store a blocked set in state.)
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
 * Public API
 * ================================================================================= */

/**
 * Select a Level-1 system; clears previous selections, reapplies defaults and rules.
 */
export function selectSystem(system: Product, state: ConfigState): ConfigState {
  let next: ConfigState = {
    ...state,
    system,
    selections: new Map(), // reset all component selections when system changes
  };

  // Populate group defaults, then run rules (caller may call applyRules again; this is idempotent)
  next = applyGroupDefaults(next);
  return state.automation ? applyRules(next) : next;
}

/**
 * Select a specific SKU inside a group (user action).
 */
const MULTI_GROUPS = new Set<string>(["Software Options"]); // must match your Excel group name exactly

export function selectItem(group: string, sku: string, state: ConfigState): ConfigState {
  const next = cloneState(state);

  const product = next.catalog.bySKU.get(sku);
  if (!product || product.group !== group) return next;

  if (MULTI_GROUPS.has(group)) {
    const current = asArray(next.selections.get(group));
    const updated = current.includes(sku) ? current.filter((s) => s !== sku) : [...current, sku];

    if (updated.length === 0) next.selections.delete(group);
    else next.selections.set(group, updated);
  } else {
    next.selections.set(group, sku);
  }

  return state.automation ? applyRules(next) : next;
}

/**
 * Apply all rules against the current state (idempotent).
 */
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

/**
 * Utility: build an initial empty state for a catalog (no system chosen yet).
 */
export function createInitialState(catalog: Catalog): ConfigState {
  return {
    catalog,
    system: undefined,
    selections: new Map(),
    automation: true,
  };
}
``;
