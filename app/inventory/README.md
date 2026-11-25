# Organisational inventory — frontend (`app/inventory/`)

Next.js pages for the Django `inventory` app (see its README). A project (a
family, branch or team) sees what it owns, how each thing is doing and what it
lacks. Admins, managers and members can edit. Everyone else gets a read-only
view. **Plans** (`/inventory/plans`) turn that inventory into trip, move and
event checklists, and can pull items from any organisation the user belongs to.

---

## 1. File map

| File | Role |
|---|---|
| `inventoryApi.ts` | **Exported** `apiClient` (same setup as `productApi.ts`), types, fixed choices (`STATUSES`, `CONDITIONS`, `ACTIONS`, `UNITS`), all inventory API calls, helpers (`money`, `fmtQty`, `unitShort`, `labelOf`), `getApiErrorMessage` |
| `page.tsx` | Inventory screen: organisation/project pickers, **Plans** button, view buttons, filters, table, inline condition, opens the dialogs |
| `ItemForm.tsx` | Add/edit dialog. Category, subcategory and location are typed or picked, created on save. Color, unit, decimal quantities. Optional `prefill`, `title`, `submitLabel` props (used by plans) |
| `ColorField.tsx` | Standard color swatches, custom picker, hex readout, clear. Exports `COLOR_PRESETS` and `colorName` |
| `CategoryManager.tsx` | Dialog to add, rename and delete categories and their subcategories |
| `CustodianDialog.tsx` | Dialog to change who looks after one item |
| `ImportPanel.tsx` | Paste or upload a sheet, matched by column name |
| `JsonPanel.tsx` | Paste JSON dialog: validate (dry run), review per-item results, apply |
| `itemJson.ts` | `itemsToJson` (copy), `parseItemsJson` (paste), `copyText` (clipboard) |
| `planApi.ts` | Plan types, `KINDS`, `PLAN_STATUSES`, all plan API calls, `createItemWithNames`, shared style strings (`field`, `ghostBtn`, `primaryBtn`) |
| `plans/page.tsx` | Plans list: cards with progress, New plan, Delete |
| `plans/[id]/page.tsx` | One plan: pick from inventory (left), Taking and To buy checklist (right), Finish |
| `plans/PlanDialogs.tsx` | `Modal`, `NewPlanDialog`, `FinishDialog`, `ConfirmDialog` |
| `plans/AddToInventoryFlow.tsx` | Confirm, then the item form, for turning a bought line into a real item |

Styling is Tailwind utilities only. There is no CSS file. The `[id]` folder name
must be literal, brackets included.

---

## 2. Inventory page

### Data flow

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

The header shows **Plans** to everyone (including read-only users), then, for
editors only, Categories, Import from sheet, Paste JSON and Add item.

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
- Plan lines use the same units and helpers.

---

## 4. Color

- Stored as `#RRGGBB` (upper-case). Empty string means not set.
- `ColorField` offers standard CSS/W3C colors as swatches, a custom picker, and
  Clear. Picked presets show their name next to the hex.
- The table shows a swatch plus its name (or hex), and a dash when not set.
- Import accepts `#RRGGBB`, `RRGGBB`, `#RGB` or a standard name. The list lives
  in two places: `COLOR_PRESETS` in `ColorField.tsx` and `COLOR_NAMES` in
  `inventory/views.py`. Edit both.

---

## 4b. Table columns and selection

Columns: select, Code, Item, Color, Category, Location, Custodians, Condition,
Have / need, Unit, Rate, Cost, Action, buttons.

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
   it needs.
2. Edit it in an AI or by hand.
3. **Paste JSON** (editors only), paste, **Validate**. The dialog calls
   `POST /inventory/items/bulk/` with `dry_run: true` and lists every item as
   New, Update, No change or Error, with changed fields, errors and warnings.
4. **Apply** is enabled only when validation passed and the text has not
   changed since. Nothing is saved if any item has an error.

Rules: an item with `code` updates that item, an item without one is added,
items left out are never deleted. The whole export, a bare `items` array and
JSON wrapped in ``` fences are all accepted. JSON exported from another project
is rejected.

---

## 5. Categories are custom

There is no category list in the code. They come from the API, per project.

- **While adding or editing an item**, type in Category and Subcategory. A
  matching name (case-insensitive) is reused, anything else is created on save.
  The subcategory field is disabled until a category is typed.
- **`handleSave` in `page.tsx`** does the find-or-create (location, category,
  subcategory), then sends ids to the API. `createItemWithNames` in
  `planApi.ts` is a copy of the same logic for the plans flow. **If you change
  one, change both.**
- **Categories dialog** (editors only) renames and deletes. Renaming keeps items
  attached. Delete warns how many items lose their category or subcategory.
- **Filters**: the subcategory dropdown appears once a category is chosen.
  "Uncategorised" filters to items with no category.

---

## 6. Permissions in the UI

`GET /inventory/my-projects/` returns `can_edit` for each project.

- `can_edit = false`: shows a "View only" badge, plain condition text instead of
  the dropdown, and no Categories / Import / Paste JSON / Add / Edit / Delete /
  custodian Edit controls. The Plans button stays.
- The dialogs only mount when `canEdit` is true.
- On the plan screen, **Add to inventory** and the Finish option to add bought
  items appear only when the user can edit at least one project
  (`editableProjects`).
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

## 8. Plans

A **plan** is a checklist for a trip, tour, home change or event. It belongs to
the user, not to a project, so it can use items from every project the user can
view, in any of their organisations. Planning only reads other inventories.

### Screens

- **`/inventory/plans`**: cards with name, type, dates, "N of M ready", the
  estimated buying cost and a progress bar. **New plan** asks for name, type,
  dates and "My own organisation". Delete removes the plan only, never
  inventory.
- **`/inventory/plans/[id]`**: two columns.
  - **Pick from my stuff** (left): an inventory dropdown grouped by
    organisation, category filter, search, **Add** per row, or tick several and
    **Add selected**. Items already in the plan show "In plan".
  - **Taking** (right): lines from inventory with a Packed checkbox, editable
    quantity and Remove.
  - **To buy** (right): lines you have to buy or get, with a Bought checkbox,
    quantity, price, and a quick-add row (name, quantity, unit, rate). Shows the
    estimated total.
- **Finish plan**: marks the plan Done. Optionally adds the remaining bought
  lines to a project (name, quantity and price only) and removes the lines never
  bought. Stock of items you took is never changed.

### Line labels

| Label | Meaning |
|---|---|
| `Borrowed, return it` | The item's organisation is not the plan's own organisation (set when the plan was created). Not shown if the plan's organisation is "Not set" |
| `Only N in stock` | The planned quantity is more than the item's `qty_have` |
| `Just added to inventory` | A bought line that was turned into a real item |
| `This item was deleted from inventory` | The inventory item no longer exists; the line keeps its name |
| `extra for 059` | A shortfall line (see below) and the Taking line it tops up |

### Bought items: add to inventory or keep temporary

1. Tick a To buy line as **Bought**. If the user can edit any project, an **Add
   to inventory** button appears.
2. The button opens `AddToInventoryFlow`, a confirmation. **Cancel** is the
   right choice for rented, borrowed or temporary things: the line stays in To
   buy, ticked, and inventory is untouched.
3. **Continue** opens `ItemForm` prefilled with the line's name, unit, quantity
   and rate, so category, subcategory, location, color and so on can be filled
   in. The form uses the chosen project's own locations, categories and people.
4. On save, `createItemWithNames` creates the item and `linkItem` tells the
   server to turn the line into a Taking line for it. The picker reloads, so
   the new item appears there too. If linking fails after the item was created,
   a retry reuses the created item instead of making a second one.

### Taking more than you have (shortfall)

When a Taking quantity is above the item's stock, `askShortfall` opens a
`ConfirmDialog`:

| Situation | Prompt |
|---|---|
| Short and no shortfall line yet | "Add to the To buy list?" for the missing amount. Creates a BUY line with `for_line` set and the item's rate as `est_rate` |
| Short, and a shortfall line exists with a different quantity | "Update the To buy list?" |
| No longer short, shortfall line exists | "Remove from the To buy list?" |

Cancelling leaves an inline **Add N to To buy** link under the warning. Removing
the Taking line removes its shortfall line.

When a **shortfall line** is bought and added to inventory, the flow offers two
choices (when the original item's project is editable):

- **Add to the stock of the original item** (the default): its stock goes up,
  the To buy line disappears, and the Taking line is now fully covered.
- **Save as a separate new item**: the form opens as above, and the Taking line
  is cut back to what was already in stock.

### Plan screen state

| Concern | State |
|---|---|
| Data | `plan`, `projects`, `error`, `notice` |
| Picker | `pickProject`, `pickTick` (bump to reload), `pickItems`, `pickCats`, `pickLoading`, `search`, `catId`, `chosen` |
| Quick-add | `bName`, `bQty`, `bUnit`, `bRate` |
| Dialogs | `finishOpen`, `pending` (a `ConfirmDialog` to show), `addInvLine` (line in the add-to-inventory flow) |

`refresh()` re-fetches the plan and returns it. Checkbox ticks update the line
optimistically and then refresh. Quantity boxes save on blur.

---

## 9. Conventions

- `inventoryApi.ts` copies the client setup from `productApi.ts`:
  `NEXT_PUBLIC_HOST` plus `/api`, token from `localStorage` / `sessionStorage`,
  `withCredentials`, and a 401 redirect to `/auth/login?next=…`. If you change
  that setup, change both files. `apiClient` is exported because `planApi.ts`
  uses it.
- `getApiErrorMessage(err, fallback)` has the same shape as in `productApi.ts`.
  Plain `Error`s thrown in `handleSave` show their message directly.
- `STATUSES`, `CONDITIONS`, `ACTIONS` and `UNITS` mirror `inventory/models.py`.
  `KINDS` and `PLAN_STATUSES` in `planApi.ts` mirror `Plan.Kind` and
  `Plan.Status`. Edit both sides.
- Dialogs close on Escape, and form fields have visible focus rings.
- Plan screens reuse the same Tailwind classes as `page.tsx`, exported from
  `planApi.ts` as `field`, `ghostBtn` and `primaryBtn`.

---

## 10. Extension checklist

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

**A new plan field**

1. Add it to the `Plan` / `PlanLine` interface (and `PlanInput` if it is typed in
   when creating) in `planApi.ts`. The backend serializer must send it.
2. Add the input to `NewPlanDialog` or the line UI in `plans/[id]/page.tsx`.

**A new plan type**

Add it to `KINDS` in `planApi.ts` and to `Plan.Kind` on the backend.

---

## 11. Known caveats

- All filtering is client-side. This is fine for hundreds of rows. If an
  inventory grows past a few thousand, move filters to the API (it already
  supports them).
- Categories are per project, so each inventory builds its own list.
- There is no way to move a subcategory to another category or merge two
  categories. Rename or recreate, then re-pick on the items.
- The condition dropdown saves immediately with no undo. Failures reload the
  list and show the error.
- Changing an item's unit does not convert its quantities or rate.
- Colors are a plain hex string. Names are only shown for the standard presets.
- JSON bulk edit cannot delete items or change an item's project. Use the table's Delete.
- Plans are personal. There is no sharing with a project yet.
- A plan's organisation is chosen when it is created and cannot be edited, so
  "Borrowed" marking depends on it.
- The plan picker shows one inventory at a time. Switch the dropdown to browse
  another project or organisation.
- Taking an item does not reserve or reduce its stock. Two plans can use the
  same item at the same time.
- Shortfall prompts only fire when a Taking quantity is edited, not when an item
  with stock 0 is first added. For that case use the inline **Add N to To buy**
  link.
- Finish's "add bought items to inventory" saves name, quantity and price only.
  Use each line's **Add to inventory** button for full details.