# Household inventory — frontend (`app/inventory/`)

Next.js page for the Django `inventory` app (see its README). A family
(project) sees what it owns, how each thing is doing and what it lacks. Admins,
managers and members can edit. Everyone else gets a read-only view.

---

## 1. File map

| File | Role |
|---|---|
| `inventoryApi.ts` | `apiClient` (same setup as `productApi.ts`), types, fixed choices (`STATUSES`, `CONDITIONS`, `ACTIONS`, `UNITS`), all API calls, helpers (`money`, `fmtQty`, `unitShort`, `labelOf`), `getApiErrorMessage` |
| `page.tsx` | Screen shell: project picker, view buttons, filters, table, inline condition, opens the dialogs |
| `ItemForm.tsx` | Add/edit dialog. Category, subcategory and location are typed or picked, created on save. Color, unit and decimal quantities |
| `ColorField.tsx` | Standard color swatches (CSS/W3C names), custom picker, hex readout, clear. Exports `COLOR_PRESETS` and `colorName` |
| `CategoryManager.tsx` | Dialog to add, rename and delete categories and their subcategories |
| `CustodianDialog.tsx` | Dialog to change who looks after one item (opened from the table) |
| `ImportPanel.tsx` | Paste or upload a sheet, matched by column name |
| `JsonPanel.tsx` | Paste JSON dialog: validate (dry run), review per-item results, apply |
| `itemJson.ts` | `itemsToJson` (copy), `parseItemsJson` (paste), `copyText` (clipboard) |

Styling is Tailwind utilities only. There is no CSS file.

---

## 2. Data flow

`page.tsx` loads three lists per project in one `reload()`:
`listItems`, `listLocations`, `listCategories` (subcategories come nested on each
category). Everything is filtered **client-side** from the full list. There is no
server paging.

Every write calls `reload()` afterwards. The one exception is the inline
condition change, which updates the row immediately and reloads only if the
request fails.

### State, by concern

| Concern | State |
|---|---|
| Projects | `orgId`, `projects`, `projectId`, derived `project`, `canEdit` |
| Data | `items`, `locations`, `categories`, `loading`, `error` |
| View | `tab` (all / unrated / attention / lacking) |
| Filters | `search`, `categoryId`, `subcategoryId`, `custodian`, `locationId` |
| Dialogs | `formOpen` + `editing`, `importOpen`, `jsonOpen`, `categoriesOpen`, `custodianItem` |
| Selection | `selected` (set of item ids), `notice` (3 s confirmation banner) |

Switching project resets every filter and the view. The organisation picker
shows only when the user belongs to more than one organisation.

The four view buttons double as counters:

- **All items**: everything.
- **Not rated**: `condition === ""`.
- **Needs action**: condition Poor or Broken, or any action other than OK.
- **Lacking**: `Number(gap) > 0`, shown as "Short by N unit".

---

## 3. Quantities, units and rates

- Quantities are **decimals** (3 places). DRF sends them as strings
  (`"2.500"`), so `qty_have`, `qty_needed` and `gap` are typed `string` on
  `Item`. Convert with `Number()` before comparing or adding.
- `ItemInput` accepts numbers or strings for the two quantities.
- Every item has one **unit** (`UNITS` in `inventoryApi.ts`): count, g, kg, mm,
  cm, m, m², m³, ml, L. It applies to both quantities and the rate. Count shows
  no suffix.
- Display helpers: `fmtQty("2.500")` gives `2.5`, `unitShort("KG")` gives `kg`.
  The table shows `2.5 / 4 kg`, `Short by 1.5 kg` and `₹120 / kg`.
- In the form the unit is printed inside both quantity inputs and in the rate
  label ("Rate (₹ per kg)"). Changing the unit does not convert the numbers.

---

## 4. Color

- Stored as `#RRGGBB` (upper-case). Empty string means not set.
- `ColorField` offers 20 standard CSS/W3C colors as swatches (red, orange,
  yellow, green, blue, brown, black, white and so on), a custom picker
  (`<input type="color">`) for anything else, and Clear. Picked presets show
  their name next to the hex.
- The table shows a small color dot beside the item name.
- Import accepts `#RRGGBB`, `RRGGBB`, `#RGB` or one of the same standard names.
  The list lives in two places: `COLOR_PRESETS` in `ColorField.tsx` and
  `COLOR_NAMES` in `inventory/views.py`. Edit both.

---

## 4b. Table columns and selection

Columns: select, Code, Item, **Color**, Category, Location, Custodians,
Condition, Have / need, **Unit**, Rate, Cost, Action, buttons.

- Color shows a swatch plus its standard name (or hex for custom colors), and a
  dash when no color is set. Unit always shows text, `nos` for count.
- The header checkbox selects or clears every row currently shown (after
  filters). Selection resets when the project changes and drops ids that no
  longer exist after a reload.
- When rows are selected, a bar offers **Copy JSON** and **Clear selection**.
  Copy works in view-only mode too.

---

## 4c. Copy / paste JSON

1. Select rows, **Copy JSON**. The clipboard gets `{format, version, project,
   allowed, notes, items}`. `allowed` lists the valid status, condition, unit,
   action and custodian names, and `notes` explains the rules, so an AI has what
   it needs. Each item has its `code`, names for category / subcategory /
   location / custodians, and plain numbers for quantities and rate.
2. Edit it in an AI or by hand.
3. **Paste JSON** (editors only), paste, **Validate**. The dialog calls
   `POST /inventory/items/bulk/` with `dry_run: true` and lists every item as
   New, Update, No change or Error, with the changed fields, errors and warnings
   (such as "New category will be created").
4. **Apply** is enabled only when validation passed and the text has not
   changed since. It sends the same JSON with `dry_run: false`. Nothing is saved
   if any item has an error.

Rules: an item with `code` updates that item, an item without one is added,
items left out are never deleted. The whole export, a bare `items` array and
JSON wrapped in ``` fences are all accepted. JSON exported from another project
is rejected. Parse errors are shown before anything is sent.

---

## 5. Categories are custom

There is no category list in the code. They come from the API, per project.

- **While adding or editing an item**, type in Category and Subcategory. A
  matching name (case-insensitive) is reused, anything else is created on save.
  The form shows "New category, created when you save" when that will happen.
  The subcategory field is disabled until a category is typed, and its
  suggestions are limited to that category.
- **`handleSave` in `page.tsx`** does the find-or-create (location, category,
  subcategory), then sends ids to the API. A subcategory with no category throws
  "Pick a category for the subcategory."
- **Categories dialog** (editors only) renames and deletes. Renaming keeps items
  attached. Delete warns how many items will become uncategorised (category) or
  lose their subcategory (subcategory).
- **Filters**: the subcategory dropdown appears once a category is chosen.
  "Uncategorised" filters to items with no category.
- Import creates categories and subcategories from the sheet's columns, and the
  result summary says how many were created.

---

## 6. Permissions in the UI

`GET /inventory/my-projects/` returns `can_edit` for each project.

- `can_edit = false`: shows a "View only" badge, plain condition text instead of
  the dropdown, and no Categories / Import / Add / Edit / Delete / custodian
  Edit controls.
- The dialogs only mount when `canEdit` is true.
- The server enforces the same rules (403 on writes), so hiding controls is a
  convenience, not security.

If the user is on no project, the page says so and asks them to contact their
organisation admin.

---

## 7. Import (`ImportPanel.tsx`)

Paste rows from Excel or Google Sheets, header row included, or choose a
`.csv` / `.tsv` file. Tab-separated is detected from the header, otherwise comma.

Headers are matched case-insensitively and everything else is ignored:

| Header | Field |
|---|---|
| Object, Item, Name | name |
| Type, Variant | variant |
| Color, Colour | color |
| Custodian, Owner | custodian |
| Category | category |
| SubCategory, Sub category, Sub-category | subcategory |
| Space, Location | location |
| Brand | brand |
| Condition | condition |
| Quantity, Qty, Qty have | qty_have |
| Qty needed | qty_needed |
| Unit, UOM, Unit of measure | unit |
| Remarks | remarks |

- Unit accepts the code or a common word (kg, g, m, sqm, litre, nos, pcs ...).
  Blank or unknown becomes count.
- Rows with no quantity import as 1. Quantities may have decimals.
- The parser splits on the delimiter and does not handle quoted commas. Use the
  tab-separated paste from a spreadsheet for messy data. Rows with an empty name
  are dropped before sending.

---

## 8. Conventions

- `inventoryApi.ts` copies the client setup from `productApi.ts`:
  `NEXT_PUBLIC_HOST` plus `/api`, token from `localStorage` / `sessionStorage`,
  `withCredentials`, and a 401 redirect to `/auth/login?next=…`. If you change
  that setup, change both files.
- `getApiErrorMessage(err, fallback)` has the same shape as in `productApi.ts`.
  Plain `Error`s thrown in `handleSave` show their message directly.
- `STATUSES`, `CONDITIONS`, `ACTIONS` and `UNITS` mirror `inventory/models.py`.
  Edit both.
- Dialogs close on Escape, and form fields have visible focus rings.

---

## 9. Extension checklist

**Showing a new `Item` field**

1. Add it to `Item` and `ItemInput` in `inventoryApi.ts`. If the API returns a
   read-only extra (like `category_name`), omit it from `ItemInput`.
2. Add it to `blank()` and `fromItem()` in `ItemForm.tsx`, and add the input.
3. Add a column in `page.tsx` if it should show in the table.
4. For import, add the header to `HEADER_MAP` in `ImportPanel.tsx` (the backend
   must read it too).

**A new unit**

Add it to `UNITS` in `inventoryApi.ts` (with its `short` text) and to
`Item.Unit` and the `UNIT_MAP` aliases on the backend.

**A new standard color**

Add it to `COLOR_PRESETS` in `ColorField.tsx` and to `COLOR_NAMES` in
`inventory/views.py`.

**A new filter**

Add state in `page.tsx`, a control in the filter row, a line in the `visible`
memo, and reset it in the project-change effect.

---

## 10. Known caveats

- All filtering is client-side. This is fine for hundreds of rows. If a family
  grows past a few thousand, move filters to the API (it already supports them).
- Categories are per project, so each family builds its own list.
- There is no way to move a subcategory to another category or merge two
  categories. Rename or recreate, then re-pick on the items.
- The condition dropdown saves immediately with no undo. Failures reload the
  list and show the error.
- Changing an item's unit does not convert its quantities or rate.
- Colors are a plain hex string. Names are only shown for the standard presets.
- JSON bulk edit cannot delete items or change an item's project. Use the table's Delete.