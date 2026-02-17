
// src/types.ts
export type Product = {
  item: string;
  sku: string;
  price: number;
  currency: string;
  link?: string;
};

export type QtyMode = 'fixed' | 'perParent'; // you can extend later

export type Dependency = {
  parentSKU: string;
  depGroup: string;
  optionSKU: string;
  qtyMode: QtyMode; // 'fixed' means add dep.qty once per parent; 'perParent' multiplies by parent qty
  qty: number;
  required: boolean;
  notes?: string;
};

export type Catalog = {
  products: Product[];
  dependencies: Dependency[];
  bySKU: Map<string, Product>;
  groupsByParent: Map<string, Map<string, Dependency[]>>; // ParentSKU -> (group -> options[])
};
