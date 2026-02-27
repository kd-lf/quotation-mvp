# Quotation MVP

A React + TypeScript web app for building configurable product quotes from Excel product books, applying rules, rolling up BOM pricing, and exporting results to Excel/PDF for customers and CRM.

## What this app does

- Upload a **product book** workbook and build an interactive configurator from it.
- Upload a **price book** workbook and apply SKU-based master pricing.
- Select a system and component options by group.
- Automatically apply rule-based behaviors (defaults, required choices, blocking, auto-select).
- Expand BOM children, control per-line inclusion, and edit quantities.
- Export:
  - customer quote Excel (`Quote` + hidden `Metadata`)
  - CRM report Excel
  - PDF quotation
- Re-import a previously exported quote and restore both configuration and negotiated prices.

## Tech stack

- **Vite** + **React 19** + **TypeScript**
- **MUI** for UI components
- **SheetJS (xlsx)** for Excel import/export
- **jsPDF + jspdf-autotable** for PDF generation

## Getting started

### Prerequisites

- Node.js 18+
- npm (or compatible package manager)

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

The app starts on Vite's local dev server (typically `http://localhost:5173`).

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Input workbook formats

### 1) Product book (required)

Upload via **UPLOAD PRODUCT BOOK**.

Expected sheets:

- `PRODUCTS` (required)
- `RULES` (required)
- `BOM` (optional)

#### `PRODUCTS` sheet

Required columns:

- `Level`
- `Group`
- `Name`

Recommended columns (enables extra behavior/pricing metadata):

- `SKU`
- `Default`
- `Price`
- `Currency`
- `Notes`

Notes:

- `Level = 1` rows are treated as systems.
- `Level > 1` rows are option items grouped by `Group`.
- Missing/placeholder SKU values are auto-generated as `AUTO-0001`, `AUTO-0002`, etc.

#### `RULES` sheet

Required columns:

- `RuleID`
- `Enabled`
- `THEN_Action`
- `THEN_Group`

Recommended columns:

- `IF_Group`
- `IF_SKU`
- `IF_Contains`
- `THEN_SKU`

Supported actions:

- `setDefault`
- `require`
- `block`
- `autoSelect`
- `clearDefault`

#### `BOM` sheet (optional)

Expected columns:

- `Parent`
- `SKU`
- `Quantity`
- `Name` (optional)
- `Price` (optional fallback)

### 2) Price book (optional but recommended)

Upload via **UPLOAD PRICE BOOK** after loading a product book.

Price extraction behavior:

- All sheets are scanned.
- SKU is read from **column C**.
- Unit price is read from **column F**.
- SKUs are normalized (trimmed, uppercased, whitespace removed).
- First SKU match wins.

## Typical workflow

1. Upload product book (`PRODUCTS` + `RULES`, optional `BOM`).
2. Upload price book.
3. Select a system and configure each group.
4. Review BOM expansions, include/exclude child lines, and edit quantities.
5. Optionally import a previous quote to apply negotiated prices.
6. Export quote (Excel/PDF) and CRM report.

## NPM scripts

- `npm run dev` – start local dev server
- `npm run build` – type-check and build production bundle
- `npm run preview` – preview production build locally
- `npm run lint` – run ESLint
- `npm run format` – run Prettier write
- `npm run format:check` – verify formatting
- `npm run deploy` – publish `dist/` via `gh-pages`

## Project structure

```text
src/
  components/
    UploadExcel.tsx        # product book ingestion + validation
    UploadPriceBook.tsx    # price book ingestion
    UploadQuote.tsx        # restore quote metadata + negotiated prices
    ItemSelector.tsx       # main configurator UI, BOM controls, exports
  logic/
    ruleEngine.ts          # selection state + rule execution
    pricing.ts             # master price/BOM rollups
    masterPrice.ts         # SKU->price parsing from price book
    exportQuote.ts         # customer quote export + metadata
    exportCrmReport.ts     # CRM-oriented export
    generateQuotePdf.ts    # PDF output
  types.ts                 # shared domain model
```

## Notes & troubleshooting

- If upload fails, verify sheet names and headers exactly match expected values.
- If no system is selected, exports are intentionally blocked.
- Negotiated prices override price book prices for matching SKUs.
- BOM totals only include child lines that are checked and have quantity > 0.
