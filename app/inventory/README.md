# Household inventory — frontend (`app/inventory/`)

Next.js page for the Django `inventory` app (see its README). A family
(project) sees what it owns, how each thing is doing and what it lacks. Admins,
managers and members can edit. Everyone else gets a read-only view.

---

## 1. File map

| File | Role |
|---|---|
| `inventoryApi.ts` | `apiClient` (same setup as `productApi.ts`), types, fixed choices, all API calls, `getApiErrorMessage` |
| `page.tsx` | Screen shell: project picker, view buttons, filters, table, inline condition, opens the dialogs |
| `ItemForm.tsx` | Add/edit dialog. Category, subcategory and location are typed or picked, created on save |
| `CategoryManager.tsx` | Dialog to add, rename and delete categories and their subcategories |
| `ImportPanel.tsx` | Paste or upload a sheet, matched by column name |

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
| Projects | `projects`, `projectId`, derived `project`, `canEdit` |
| Data | `items`, `locations`, `categories`, `loading`, `error` |
| View | `tab` (all / unrated / attention / lacking) |
| Filters | `search`, `categoryId`, `subcategoryId`, `custodian`, `locationId` |
| Dialogs | `formOpen` + `editing`, `importOpen`, `categoriesOpen` |

Switching project resets every filter and the view.

The four view buttons double as counters:

- **All items**: everything.
- **Not rated**: `condition === ""`.
- **Needs action**: condition Poor or Broken, or any action other than OK.
- **Lacking**: `gap > 0`, shown as "Short by N".

---

## 3. Categories are custom

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

## 4. Permissions in the UI

`GET /inventory/my-projects/` returns `can_edit` for each project.

- `can_edit = false`: shows a "View only" badge, plain condition text instead of
  the dropdown, and no Categories / Import / Add / Edit / Delete controls.
- The dialogs only mount when `canEdit` is true.
- The server enforces the same rules (403 on writes), so hiding controls is a
  convenience, not security.

If the user is on no project, the page says so and asks them to contact their
organisation admin.

---

## 5. Import (`ImportPanel.tsx`)

Paste rows from Excel or Google Sheets, header row included, or choose a
`.csv` / `.tsv` file. Tab-separated is detected from the header, otherwise comma.

Headers are matched case-insensitively and everything else is ignored:

| Header | Field |
|---|---|
| Object, Item, Name | name |
| Type, Variant | variant |
| Custodian, Owner | custodian |
| Category | category |
| SubCategory, Sub category, Sub-category | subcategory |
| Space, Location | location |
| Brand | brand |
| Condition | condition |
| Quantity, Qty, Qty have | qty_have |
| Qty needed | qty_needed |
| Remarks | remarks |

The parser splits on the delimiter and does not handle quoted commas. Use the
tab-separated paste from a spreadsheet for messy data. Rows with an empty name
are dropped before sending.

---

## 6. Conventions

- `inventoryApi.ts` copies the client setup from `productApi.ts`:
  `NEXT_PUBLIC_HOST` plus `/api`, token from `localStorage` / `sessionStorage`,
  `withCredentials`, and a 401 redirect to `/auth/login?next=…`. If you change
  that setup, change both files.
- `getApiErrorMessage(err, fallback)` has the same shape as in `productApi.ts`.
  Plain `Error`s thrown in `handleSave` show their message directly.
- `STATUSES`, `CONDITIONS` and `ACTIONS` mirror `inventory/models.py`. Edit both.
- Dialogs close on Escape, and form fields have visible focus rings.

---

## 7. Extension checklist

**Showing a new `Item` field**

1. Add it to `Item` and `ItemInput` in `inventoryApi.ts`. If the API returns a
   read-only extra (like `category_name`), omit it from `ItemInput`.
2. Add it to `blank()` and `fromItem()` in `ItemForm.tsx`, and add the input.
3. Add a column in `page.tsx` if it should show in the table.
4. For import, add the header to `HEADER_MAP` in `ImportPanel.tsx` (the backend
   must read it too).

**A new filter**

Add state in `page.tsx`, a control in the filter row, a line in the `visible`
memo, and reset it in the project-change effect.

---

## 8. Known caveats

- All filtering is client-side. This is fine for hundreds of rows. If a family
  grows past a few thousand, move filters to the API (it already supports them).
- Categories are per project, so each family builds its own list.
- There is no way to move a subcategory to another category or merge two
  categories. Rename or recreate, then re-pick on the items.
- The condition dropdown saves immediately with no undo. Failures reload the
  list and show the error.
