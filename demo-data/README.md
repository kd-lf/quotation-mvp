# Demo Spreadsheet Data (Fake)

Use these CSV files to quickly create demo Excel workbooks for the app.

## Files

- `product_book_PRODUCTS.csv` → `PRODUCTS` sheet
- `product_book_RULES.csv` → `RULES` sheet
- `product_book_BOM.csv` → `BOM` sheet (optional)
- `price_book_demo.csv` → any sheet in a separate price book workbook

## How to use in Excel

1. Create a new workbook for the **product book**.
2. Import each `product_book_*.csv` file into its own sheet.
3. Rename sheets exactly to `PRODUCTS`, `RULES`, and `BOM`.
4. Save as `product-book-demo.xlsx`.
5. Create a second workbook for pricing and import `price_book_demo.csv`.
6. Save as `price-book-demo.xlsx` and upload it as your price book.

## Why this dataset is useful

- Includes 2 systems and multiple option groups.
- Includes defaults and non-default options.
- Includes rule behavior: `require`, `block`, `setDefault`, `autoSelect`, and `clearDefault`.
- Includes BOM expansion rows with both auto-selected and optional child lines.
- Includes matching SKU prices for both top-level and BOM SKUs.
