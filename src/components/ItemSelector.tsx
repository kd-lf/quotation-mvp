
import {
  Checkbox,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  FormControlLabel,
  Tooltip,
  IconButton,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useMemo, useState } from "react";
import type { Catalog, Dependency, Product } from "../types";

type Row = Product & {
  checked?: boolean;
  qty?: number;
  // depGroup -> optionSKU chosen for that group (only meaningful for parent rows)
  selectedOptions?: Record<string, string>;
};

export default function ItemSelector({
  items,
  onChange,
  automationEnabled,
  setAutomationEnabled,
  catalog,
}: {
  items: Row[];
  onChange: (rows: Row[]) => void;
  automationEnabled: boolean;
  setAutomationEnabled: (v: boolean) => void;
  catalog: Catalog;
}) {
  // Base working rows
  const [selected, setSelected] = useState<Row[]>(
    items.map((p) => ({ ...p, checked: false, qty: 1, selectedOptions: {} }))
  );

  // owners[optionSKU] = set of parent row indices that selected that dependency
  const [owners, setOwners] = useState<Record<string, Set<number>>>({});

  // Identify which SKUs are "parents" (they appear as ParentSKU in the dependencies sheet)
  const parentSKUSet = useMemo(
    () => new Set(Array.from(catalog.groupsByParent.keys())),
    [catalog.groupsByParent]
  );
  const isParent = (sku: string) => parentSKUSet.has(sku);

  const cloneOwners = (o: Record<string, Set<number>>) => {
    const next: Record<string, Set<number>> = {};
    Object.keys(o).forEach((k) => (next[k] = new Set(o[k])));
    return next;
  };

  // ------------------------------- Apply owners (compute managed dep rows) ---

function applyOwners(rows: Row[], own: Record<string, Set<number>>): Row[] {
  if (!automationEnabled) return rows.map((r) => ({ ...r }));

  const managed = new Set(Object.keys(own));
  // Work on a local copy and iterate until stable (or safe guard hit)
  let current = rows.map((r) => ({ ...r }));
  let pass = 0;

  while (pass < 5) {
    pass++;
    let changed = false;

    const next = current.map((r) => {
      if (!managed.has(r.sku)) return r;

      // r is a dependency SKU; compute total qty from all parents that own it
      let total = 0;
      const ownerSet = own[r.sku];
      if (ownerSet && ownerSet.size > 0) {
        for (const parentIdx of ownerSet) {
          const parent = current[parentIdx];
          if (!parent?.checked) continue;

          const groups = catalog.groupsByParent.get(parent.sku);
          if (!groups) continue;

          // Find the dependency definition for (parent -> this optionSKU)
          for (const depList of groups.values()) {
            const dep = depList.find((d) => d.optionSKU === r.sku);
            if (dep) {
              const parentQty = Math.max(1, Number(parent.qty || 1));
              total += dep.qtyMode === "perParent" ? parentQty * dep.qty : dep.qty; // <- cascades via parent's *current* qty
            }
          }
        }
      }

      const newChecked = total > 0;
      const newQty = newChecked ? Math.max(total, 1) : 1;

      if (r.checked !== newChecked || (newChecked && (r.qty ?? 1) !== newQty)) {
        changed = true;
        return { ...r, checked: newChecked, qty: newQty };
      }
      return r;
    });

    if (!changed) return next; // stable
    current = next;            // another pass to propagate to deeper levels
  }

  return current; // return even if we hit the pass cap (should be rare)
}


  // ----------------------------- Helpers: descendants & lookups (recursive) ---
  const indexBySKU = useMemo(() => {
    const m = new Map<string, number>();
    selected.forEach((r, i) => m.set(r.sku, i));
    return m;
  }, [selected]);

  function getSelectedChildSKUsOf(index: number): string[] {
    const row = selected[index];
    const opts = row?.selectedOptions || {};
    return Object.values(opts).filter(Boolean);
  }

  function collectDescendantIndices(rootIndex: number, idxBySKU: Map<string, number>): number[] {
    const result: number[] = [];
    const seen = new Set<number>();
    function dfs(idx: number) {
      const childSKUs = getSelectedChildSKUsOf(idx);
      for (const sku of childSKUs) {
        const childIdx = idxBySKU.get(sku);
        if (childIdx === undefined || seen.has(childIdx)) continue;
        seen.add(childIdx);
        result.push(childIdx);
        if (isParent(selected[childIdx].sku)) dfs(childIdx);
      }
    }
    dfs(rootIndex);
    return result;
  }

  // ------------------------------------ Highlight: only if owned by checked parent
  function isSelectedAsDep(sku: string): boolean {
    if (automationEnabled) {
      const s = owners[sku];
      if (!s || s.size === 0) return false;
      // highlight only if any owning parent row is currently checked
      for (const parentIdx of s) {
        const p = selected[parentIdx];
        if (p?.checked) return true;
      }
      return false;
    }

    // Manual mode: infer from selectedOptions of checked parents
    for (let i = 0; i < selected.length; i++) {
      const r = selected[i];
      if (!isParent(r.sku) || !r.checked) continue;
      const opts = r.selectedOptions || {};
      if (Object.values(opts).includes(sku)) return true;
    }
    return false;
  }

  // --------------------------------- Ownership removal for a given owner row ---
  function removeOwnershipForOwner(ownerIdx: number, own: Record<string, Set<number>>) {
    const opts = selected[ownerIdx]?.selectedOptions || {};
    Object.values(opts).forEach((sku) => {
      if (!sku) return;
      if (!own[sku]) own[sku] = new Set<number>();
      own[sku].delete(ownerIdx);
      if (own[sku].size === 0) delete own[sku];
    });
  }

  // ---------------------- Reset a node (and its descendants) completely -------
  function resetNodeAndDescendants(rootIdx: number, own: Record<string, Set<number>>, rows: Row[]) {
    // remove this node's ownership first (if it happens to be a parent)
    if (isParent(rows[rootIdx].sku)) {
      const opts = rows[rootIdx].selectedOptions || {};
      Object.values(opts).forEach((sku) => {
        if (!own[sku]) own[sku] = new Set<number>();
        own[sku].delete(rootIdx);
        if (own[sku].size === 0) delete own[sku];
      });
    }
    // reset this node
    rows[rootIdx] = { ...rows[rootIdx], checked: false, qty: 1, selectedOptions: {} };

    // reset descendants (depth-first)
    const descendants = collectDescendantIndices(rootIdx, indexBySKU);
    for (const dIdx of descendants) {
      if (isParent(rows[dIdx].sku)) {
        const dOpts = rows[dIdx].selectedOptions || {};
        Object.values(dOpts).forEach((sku) => {
          if (!own[sku]) own[sku] = new Set<number>();
          own[sku].delete(dIdx);
          if (own[sku].size === 0) delete own[sku];
        });
      }
      rows[dIdx] = { ...rows[dIdx], checked: false, qty: 1, selectedOptions: {} };
    }
  }

  // ------------------------------------ Update a parent's group selection ------
  function setParentGroupSelection(parentIndex: number, group: string, newOptionSKU: string) {
    const prev = selected[parentIndex]?.selectedOptions?.[group] || "";

    if (!automationEnabled) {
      // Manual mode: just store the choice; UI/ordering will reflect it
      const rows = [...selected];
      const prevOpts = rows[parentIndex].selectedOptions || {};
      rows[parentIndex] = { ...rows[parentIndex], selectedOptions: { ...prevOpts, [group]: newOptionSKU } };
      setSelected(rows);
      onChange(rows);
      return;
    }

    const nextOwners = cloneOwners(owners);
    const rows = [...selected];

    // 1) Clean up the previous branch (if any)
    if (prev) {
      // Remove this parent's ownership of the previous option
      if (!nextOwners[prev]) nextOwners[prev] = new Set<number>();
      nextOwners[prev].delete(parentIndex);
      if (nextOwners[prev].size === 0) delete nextOwners[prev];

      // If nobody else owns the previous option anymore, reset that node and its descendants
      const prevIdx = indexBySKU.get(prev);
      const stillOwned = !!(nextOwners[prev] && nextOwners[prev].size > 0);
      if (prevIdx !== undefined && !stillOwned) {
        resetNodeAndDescendants(prevIdx, nextOwners, rows);
      }
    }

    // 2) Add ownership for the new option
    if (newOptionSKU) {
      if (!nextOwners[newOptionSKU]) nextOwners[newOptionSKU] = new Set<number>();
      nextOwners[newOptionSKU].add(parentIndex);
    }

    // 3) Update the parent's selection set
    const prevOpts = rows[parentIndex].selectedOptions || {};
    rows[parentIndex] = {
      ...rows[parentIndex],
      selectedOptions: { ...prevOpts, [group]: newOptionSKU },
    };

    const synced = applyOwners(rows, nextOwners);
    setOwners(nextOwners);
    setSelected(synced);
    onChange(synced);
  }

  // --------------------------------- Deselect a parent (full cascade) ----------
  function deselectParent(parentIndex: number) {
    const nextOwners = cloneOwners(owners);
    const rows = [...selected];
    const parentRow = rows[parentIndex];
    if (!parentRow) return;

    // Collect every descendant index (level-1, level-2, …)
    const allDescendantIdx = collectDescendantIndices(parentIndex, indexBySKU);

    // 1) Remove ownership of the top-level parent over its direct options
    removeOwnershipForOwner(parentIndex, nextOwners);

    // 2) For each descendant that is itself a parent, remove its ownership over its own options
    for (const childIdx of allDescendantIdx) {
      if (isParent(rows[childIdx].sku)) {
        removeOwnershipForOwner(childIdx, nextOwners);
      }
    }

    // 3) Reset parent and all descendants
    rows[parentIndex] = { ...parentRow, checked: false, qty: 1, selectedOptions: {} };
    for (const childIdx of allDescendantIdx) {
      rows[childIdx] = { ...rows[childIdx], checked: false, qty: 1, selectedOptions: {} };
    }

    // 4) Safety: also clear direct dependency rows that might not be in descendant set
    const directSKUs = Object.values(parentRow.selectedOptions || {});
    directSKUs.forEach((sku) => {
      const depIdx = rows.findIndex((r) => r.sku === sku);
      if (depIdx >= 0 && !allDescendantIdx.includes(depIdx)) {
        rows[depIdx] = { ...rows[depIdx], checked: false, qty: 1 };
      }
    });

    const synced = applyOwners(rows, nextOwners);
    setOwners(nextOwners);
    setSelected(synced);
    onChange(synced);
  }

  function selectParent(parentIndex: number) {
    const nextOwners = cloneOwners(owners);
    // Clear lingering ownerships for this parent
    Object.keys(nextOwners).forEach((sku) => {
      if (nextOwners[sku].has(parentIndex)) {
        nextOwners[sku].delete(parentIndex);
        if (nextOwners[sku].size === 0) delete nextOwners[sku];
      }
    });

    const rows = [...selected];
    rows[parentIndex] = { ...rows[parentIndex], checked: true, selectedOptions: {} };

    const synced = applyOwners(rows, nextOwners);
    setOwners(nextOwners);
    setSelected(synced);
    onChange(synced);
  }

  function updateQty(index: number, nextQty: number) {
    const qty = Math.max(1, Number(nextQty));
    const rows = [...selected];
    rows[index] = { ...rows[index], qty };
    const synced = applyOwners(rows, owners);
    setSelected(synced);
    onChange(synced);
  }

  // --------------------------- Rendering order (recursive under parent) -------
  const renderOrder = useMemo(() => {
    const order: number[] = [];
    const placed = new Set<number>();

    // 1) For each selected parent (if not yet placed), place parent then all descendants
    selected.forEach((row, i) => {
      if (isParent(row.sku) && row.checked && !placed.has(i)) {
        order.push(i);
        placed.add(i);

        const descendants = collectDescendantIndices(i, indexBySKU);
        for (const dIdx of descendants) {
          if (!placed.has(dIdx)) {
            order.push(dIdx);
            placed.add(dIdx);
          }
        }
      }
    });

    // 2) Append everything else in original order
    selected.forEach((_, i) => {
      if (!placed.has(i)) order.push(i);
    });

    return order;
  }, [selected, isParent, indexBySKU]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <>

<FormControlLabel
  control={
    <Checkbox
      checked={automationEnabled}
      onChange={(e) => setAutomationEnabled(e.target.checked)}
    />
  }
  label={
    <Tooltip
      title="When enabled, required (dependent) items are automatically included and locked to keep the configuration consistent. Turn off to manually override parent–child relationships."
      arrow
      placement="right"
    >
      <span>Auto-manage dependencies</span>
    </Tooltip>
  }
/>


      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Select</TableCell>
            <TableCell>Item</TableCell>
            <TableCell>SKU</TableCell>
            <TableCell>Price</TableCell>
            <TableCell>Qty</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {renderOrder.map((idx) => {
            const row = selected[idx];
            const isParentRow = isParent(row.sku);
            const groups = isParentRow ? catalog.groupsByParent.get(row.sku) : undefined;
            
            // One truth: auto-managed if owned by any checked parent (works for any depth AND even if it's also a parent)
            const autoManaged = automationEnabled && isSelectedAsDep(row.sku);

            // Use the same flag for both: highlight + disable
            const managedByOwners = autoManaged;
            const isDepRow = autoManaged

            return (
              <>
                <TableRow
                  key={`r-${row.sku}`}
                  style={{
                    background: isDepRow ? "#fcfcff" : undefined,
                    borderLeft: isDepRow ? "4px solid #4b6fff" : undefined,
                    opacity: managedByOwners ? 0.9 : 1,
                  }}
                >
                  <TableCell>
                    <Checkbox
                      checked={!!row.checked}
                      disabled={managedByOwners}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (!automationEnabled) {
                          // Manual mode: free toggle
                          const rows = [...selected];
                          rows[idx] = { ...rows[idx], checked };
                          setSelected(rows);
                          onChange(rows);
                          return;
                        }
                        if (isParentRow) {
                          if (!checked) deselectParent(idx);
                          else selectParent(idx);
                        } else {
                          // Standalone non-parent row
                          const rows = [...selected];
                          rows[idx] = { ...rows[idx], checked };
                          setSelected(rows);
                          onChange(rows);
                        }
                      }}
                    />
                  </TableCell>

                  <TableCell>{row.item}</TableCell>
                  <TableCell>{row.sku}

                    
  {!!row.link && (
    <Tooltip title="Open product page">
      <IconButton
        component="a"
        href={row.link}
        target="_blank"
        rel="noopener noreferrer"
        size="small"
        aria-label="Open product page"
        onClick={(e) => e.stopPropagation()}
        sx={{ ml: 1 }}
      >
        <OpenInNewIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  )}

                  </TableCell>
                  <TableCell>
                    {row.price} {row.currency}
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={row.qty ?? 1}
                      disabled={automationEnabled && (!row.checked || managedByOwners)}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (!automationEnabled || !isParentRow) {
                          const rows = [...selected];
                          rows[idx] = { ...rows[idx], qty: Math.max(1, next) };
                          setSelected(rows);
                          onChange(rows);
                          return;
                        }
                        updateQty(idx, next);
                      }}
                      style={{ width: 80 }}
                    />
                  </TableCell>
                </TableRow>

                {/* Dynamic dependency groups from Excel (only for selected parents) */}
                {row.checked && isParentRow && groups && (
                  <TableRow key={`dep-${row.sku}`}>
                    <TableCell />
                    <TableCell colSpan={4}>
                      <div
                        style={{
                          padding: 15,
                          background: "#f7f7f7",
                          borderLeft: "3px solid #999",
                          borderRadius: 4,
                        }}
                      >
                        <strong>Options</strong>
                        {Array.from(groups.entries()).map(([groupName, options]) => {
                          const value = row.selectedOptions?.[groupName] ?? "";
                          return (
                            <div key={groupName} style={{ marginTop: 10 }}>
                              {groupName}:{" "}
                              <Select
                                size="small"
                                value={value}
                                displayEmpty
                                onChange={(e) =>
                                  setParentGroupSelection(idx, groupName, String(e.target.value || ""))
                                }
                                style={{ marginLeft: 10, minWidth: 240 }}
                              >
                                <MenuItem value="">None</MenuItem>
                                {options.map((opt: Dependency) => {
                                  const product = catalog.bySKU.get(opt.optionSKU);
                                  const label = product
                                    ? `${product.item} (${opt.optionSKU})`
                                    : opt.optionSKU;
                                  return (
                                    <MenuItem key={opt.optionSKU} value={opt.optionSKU}>
                                      {label}
                                    </MenuItem>
                                  );
                                })}
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
