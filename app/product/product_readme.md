# Fixture & Product Assignment — dev reference

Covers the `product` Django app (models/serializers/views/admin) and the
Next.js `product` page (`page.tsx` + `ProductCatalog.tsx` + `productApi.ts` +
`ProductListPrint.tsx` + `SorExport.tsx`), plus the admin-side
`product/manage` page (`page.tsx` + `productAdminApi.ts` +
`ProductEditPanel.tsx`).

This is the module where clients and architects pick fixtures/products
(sinks, mixers, lights, etc.) for each room ("space") of a project,
negotiate via propose/confirm/decline, and export the result as a PDF or a
Schedule-of-Rates CSV — and where org admins maintain the catalog itself,
including per-size variants, pricing, IFC models, units and org notes.

> Last reviewed against: `models.py`, `admin.py`, `urls.py`, `productApi.ts`,
> `ProductCatalog.tsx`, `ProductListPrint.tsx`, `productAdminApi.ts`,
> `ProductEditPanel.tsx`, admin `page.tsx`/`page.css`, user `page.tsx`.
> `views.py` and `serializers.py` were **not** re-read for this revision —
> sections about them are carried over; see "Verify" notes.

---

## 1. Domain model

```
Organisation
└─ Project
   ├─ Space (a room: "Kitchen", "Bed2 Toilet", …)
   │   └─ required_categories: [IFC category codes] — what that room needs
   └─ ProductAssignment (a product proposed for one Space)
       ├─ product → Product
       ├─ variant → ProductVariant | null — which size/option was picked
       ├─ proposed_by 'client' | 'architect'      (role bucket)
       ├─ proposed_by_user → User | null           (the specific person)
       ├─ proposer_note free text, written by the proposer only
       ├─ client_confirmed / architect_confirmed
       └─ declined / declined_by / declined_at / declined_note

Product (catalog entry — a specific manufacturer/model)
├─ category (IFC_CATEGORY_CHOICES) + predefined_type (scoped to category)
├─ rate_id   auto, unique, editable=False   — Schedule-of-Rates ID, e.g. WB-01
├─ unit      free text — rate unit for the SOR: m2, m3, count, m, lumpsum…
├─ status: pending | approved | rejected (client suggestions start pending)
├─ organisation (who must review a suggestion)
├─ base_price (MRP) / currency
├─ cost_price (the "final price, if discounted"; must be <= base_price)
├─ product_image + auto-generated product_thumbnail (300px JPEG)
├─ variants: ProductVariant[] — zero or more size/option rows
├─ pricing overrides: ClientPricing, ProjectPricing, OrganisationPricing, DiscountTier
├─ ifc_model (IFCModelFile), additional_documents
├─ organisation_notes: OrganisationProductNote[]
└─ get_effective_price(user, project, organisation, quantity, variant=None)
   priority: per-client > per-project > per-organisation > quantity tier
             > cost_price (product-level only, when variant is None) > base_price

ProductVariant (a specific size/option of a Product, e.g. "1000L")
├─ label, sort_value, sku, is_default
├─ base_price / currency / cost_price — nullable; falls back to Product's if unset
├─ variant_image / variant_thumbnail — nullable; falls back to Product's if unset
├─ ifc_model (IFCModelFile) — nullable; falls back to Product's if unset
└─ effective_* properties expose the resolved value — always use these, never the raw field

OrganisationProductNote (one per product + organisation)
└─ org-wide note shown on the product for that org's members; product-family
   level (not per variant). Empty note = cleared (enforced in the view).
```

Notes on fields:

- `Product.space` is a legacy free-text `CharField` (IfcSpace name/GUID). It is
  still required by the suggest form and admin form; it is **not** the same as
  the `Space` model rows used by assignments.
- `Product.clean()` validates that `predefined_type` belongs to `category` and
  that `cost_price <= base_price`.
- The predefined-type lists exist in **two places** that must be kept in sync:
  `Product.IFC_PREDEFINED_TYPES` (models.py) and `IFC_PREDEFINED_TYPES`
  (productApi.ts). The same goes for `CATEGORIES` / `IFC_CATEGORY_CHOICES`.

### 1a. ProductVariant

A `Product` may have zero or more `ProductVariant` rows (a size/option,
e.g. "1000L"). `ProductAssignment.variant` records which one was picked —
nullable, since a product with no variants is assigned directly.

**Everything on a variant is a fallback.** Price, image, and IFC model each
resolve to the parent `Product`'s own value whenever the variant doesn't
set its own — this is done server-side (`effective_price`, `thumbnail_url`
on the serializer), so the frontend never needs to fall back itself.
`product.has_variants` tells you whether to render a size picker before
"Add to space"; if `false`, propose the assignment with `variant: null`.

In the catalog card, the active variant is whatever the person explicitly
picked, else the variant with `is_default = true`, else none — and "none" on a
product that has variants means **a size must be picked before proposing**
(the button reads "Pick a size first").

**Rule of thumb the admin UI enforces with a warning badge:** if a variant
has its own image, it needs its own IFC model too — a differently-shaped
part can't reuse a parametrically-scaled geometry from its siblings. A
variant with no image and no IFC file of its own just inherits the
product's on every axis; that's the common case (same shape, only
capacity/price differs).

Pricing overrides (`ClientPricing`/`ProjectPricing`/`OrganisationPricing`/
`DiscountTier`) can each be scoped to one variant or left product-wide
(`variant: null` = applies to every variant) — the admin pricing modals
expose this as an "Applies to" dropdown once a product has variants.

`GET /product/variants/?product=<id>` lists a product's variants directly;
not needed on the catalog/assignment flow, where variants come pre-nested
on each `ProductItem.variants`.

### 1b. Rate ID and unit (Schedule of Rates)

- `rate_id` is generated in `Product.save()` the first time a product is
  saved. Format `PREFIX-NN`, where the prefix is the first letters of the
  words in `item` (max 3: "Wash Basin" → `WB`; single word "Sink" → `SIN`;
  empty → `PRD`) and `NN` is the next free number for that prefix.
- IDs are **unique across the whole table** (DB `unique=True`). Two different
  items that produce the same prefix (e.g. "Water Boiler" and "Wash Basin" →
  `WB`) simply take the next number — they never share an ID.
- `save()` retries up to 5 times on `IntegrityError` to survive two products
  being created at once.
- IDs are **stable**: renaming `item` later does not change `rate_id`.
- Variants have no ID of their own; the CSV builds one by appending the
  cleaned variant label: `WB-01-1000L`.
- `unit` is blank by default; the CSV falls back to `count`.
- After adding these fields, run the migration **and backfill** existing rows:

```bash
python manage.py makemigrations product && python manage.py migrate product
python manage.py shell -c "from product.models import Product; [p.save() for p in Product.objects.filter(rate_id__isnull=True)]"
```

Without the backfill, old products have `rate_id = null` and the CSV falls
back to `UNID-<first 6 chars of uuid>`.

### Roles

There are 4 raw membership roles (`OrganisationMembership.role` /
`ProjectMembership.role`): `admin`, `manager`, `member`, `client`.
Everywhere in the *product* app they collapse to a **UI role**:

```python
def role_to_ui_role(raw_role):
    return 'client' if raw_role == 'client' else 'architect'
```

`admin` / `manager` / `member` are all "architect" for propose/confirm/decline
purposes. In the frontend, `manager`/`member` are **view-only** (`isViewOnly`
in `page.tsx`): no Confirm / Decline / Undo-decline / Edit-note buttons, and no
"Add space" / "Edit selected". Two exceptions:

- They **can propose** from the catalog (the propose button isn't gated by
  `isViewOnly`), and can **remove their own** proposals (see §2).
- Everyone except `admin` can **suggest a new catalog product**
  (`canSuggestProduct = rawRole !== "admin"`).

Only `admin` gets the "Manage catalog" link, the "Add/Edit org note" control on
catalog cards, and can create/approve/reject Products and manage variants.
`client` has no access to the SOR CSV button.

---

## 2. The propose → confirm/decline lifecycle

```
             propose (with optional variant + proposer_note)
                      │
                      ▼
          ┌───────────────────────┐
          │ awaiting confirmation │
          └───────────────────────┘
          /            |            \
other side confirms  other side      proposer (or admin)
(client_confirmed &&  declines        removes
 architect_confirmed) (declined=true, (hard delete)
        │              declined_by…)
        ▼                  │
    Confirmed         declined party can
                      undecline → back to
                      "awaiting confirmation"
```

Key asymmetry, enforced by `CanModifyAssignment` (views.py):

| Action | Who may do it |
|---|---|
| `destroy` (hard delete) | the specific user who proposed it (`proposed_by_user`), and **admin** (frontend: `rawRole === "admin" \|\| proposed_by_user === currentUserId`) |
| `decline` | **only** the non-proposing side |
| `undecline` | **only** whoever declined it (`declined_by`) |
| `edit_note` (proposer_note) | **only** the original proposer |
| generic `PATCH`/`PUT` | **nobody** — always denied |

> **Verify:** the `destroy` row reflects what `page.tsx` renders
> (`canHardDelete`). Older docs said "only the original proposer". Confirm
> `CanModifyAssignment` allows admin and checks `proposed_by_user`, so the
> button is never stricter or looser than the permission. Rows proposed before
> `proposed_by_user` existed have it `null` — only admin can remove those.

The last row matters: there is deliberately no generic update endpoint.
Every field mutation on a `ProductAssignment` goes through one of the named
actions above so each field's permission stays scoped. If you need to let
some new field be edited, add a new `@action` + permission branch — don't
relax the generic PATCH. `variant` is set only at propose time
(`POST /assignments/`), same as `product`; there's no dedicated "change
variant" action — if the client wants a different size, the existing
assignment is removed and a new one proposed.

### Notes — who can write what

Three independent free-text fields:

- **`proposer_note`** — written by whoever proposed the assignment. Settable at
  propose time (`POST /assignments/`) or later via
  `POST /assignments/{id}/edit_note/`. The non-proposing side never gets a UI
  control for this field — the permission class blocks it server-side too.
- **`declined_note`** — written by whoever declines (`POST
  /assignments/{id}/decline/`), i.e. always the *other* side from the
  proposer. Cleared automatically on `undecline`.
- **Organisation note** — per (product, organisation), written by that org's
  admin via `POST /products/{id}/organisation_note/` `{organisation, note}`.
  Unrelated to any single assignment.

---

## 3. Backend — `product/` app

### `models.py`
- `Product` — catalog entry, `rate_id`/`unit`, thumbnail generation,
  `get_effective_price()` pricing resolution.
- `ProductVariant` — a size/option of a Product. Every field falls back to
  the parent Product via `effective_*` properties when unset.
- `ClientPricing` / `ProjectPricing` / `OrganisationPricing` / `DiscountTier`
  — the four pricing-override tables `get_effective_price` checks in order.
  Each has a nullable `variant` FK: `null` = product-wide, set = scoped to
  that one variant. `unique_together` includes `variant`.
- `IFCModelFile` — belongs to exactly one of `product` or `variant`
  (enforced by a `CheckConstraint`).
- `AdditionalDocument` — always tied to a `product`; optionally further
  scoped to one `variant`.
- `OrganisationProductNote` — see §1.
- `Space` — a room, with `required_categories` (JSON list of IFC category
  codes) driving the "What {space} needs" chips in the UI.
- `ProductAssignment` — see lifecycle above. `variant`, `proposed_by_user`,
  `proposer_note` and `declined_note` are all nullable/blank — no data
  migration needed on tables with existing rows.

### `admin.py`
- `ProductAdmin`: list shows `rate_id`, `unit`, variant count; `unit` is
  `list_editable` for bulk setting; `rate_id` is in `readonly_fields` (it is
  `editable=False`, so it would otherwise not show at all); searchable by
  `rate_id`. Approve/reject actions use `queryset.update()` (skips `save()`,
  which is fine since `rate_id` is assigned at creation).
- Inlines: variants, the four pricing tables, org notes, IFC model, documents.
- `ProductVariantAdmin`, `OrganisationProductNoteAdmin`, `SpaceAdmin`,
  `ProductAssignmentAdmin` (shows `proposed_by_user`, declined fields).

### `serializers.py` *(not re-read — carried over)*
- `ProductSerializer` — `fields = '__all__'`, so `rate_id` and `unit` are
  exposed automatically (no serializer change needed for new Product fields).
  Nests `variants`, pricing rules, IFC file, documents, org note(s) and
  computes `effective_price` (product-level, i.e. no variant chosen) via
  `get_serializer_context()['price_project'/'price_organisation']` (set by
  `ProductViewSet.catalog`). `has_variants` tells the frontend whether to
  show a size picker.
- `ProductVariantSerializer` — nests the variant's own `ifc_model`, and
  computes `effective_price`/`thumbnail_url` scoped to that variant.
- `ProductSuggestionSerializer` — the restricted field set a *client* can
  set when suggesting a brand-new catalog product (`POST
  /products/suggest/`). `status`/`uploaded_by`/`reviewed_*` are forced
  server-side, never trusted from the payload. It does **not** include
  `unit` or `rate_id` (suggested products start with a blank unit; an admin
  sets it later). Client suggestions can't include variants.
- `ProductAssignmentSerializer` — `fields = '__all__'`. Safe *only* because
  `CanModifyAssignment` blocks generic PATCH/PUT. `validate()` rejects a
  `variant` that doesn't belong to the assigned `product`.

> **Verify:** if saving a product with `unit` from the admin page returns 400,
> the serializer used for create/update isn't `'__all__'` — add `unit` there.

### `views.py` — permission classes worth knowing *(not re-read — carried over)*

- **`IsStaffOrReadOnly`** — Product catalog default: Django `is_staff` for
  writes. (Superseded per-action below for the app-level admin flows.)
- **`IsOrganisationAdmin`** / **`IsOrgAdminAnywhere`** — "app admin" is an
  `OrganisationMembership.role='admin'` row, **not** Django `is_staff`. Two
  completely separate admin concepts exist in this codebase; don't conflate
  them.
- **`CanEditProduct`** / **`CanDeleteProduct`** — a user may edit/withdraw
  their *own* suggestion only while `status == pending`; once an org admin
  approves it, only an org admin can touch it further.
- **`IsProductOrgAdmin`** — governs pricing overrides / variants / IFC
  files / docs hung off a Product. Resolves the "owning product" generically
  — `obj.product` if present, else `obj.variant.product`. Has an "orphan"
  escape hatch: if the owning Product has no `organisation` set, *any* org
  admin may fix it up.
- **`CanModifyAssignment`** — see the lifecycle table above. **Read this
  closely before adding any new assignment-mutating action.**

### Routes (`urls.py`)

```
GET  /product/my-context/                 projects the user can act on + role + assignment counts
GET  /product/admin-scope/                orgs/projects the user administers (pricing dropdowns)

/product/products/                        ProductViewSet
  GET  catalog/?category=&predefined_type=&project=&search=&page=&page_size=
                                          priced, project-scoped, paginated (frontend page size 12)
  GET  admin_list/?search=                all statuses, org-scoped, admin only
  POST suggest/                           suggest a new product (anyone but admin)
  GET  pending/                           admin's review queue
  POST {id}/approve/ | {id}/reject/       admin only (reject body: {rejection_reason})
  POST {id}/organisation_note/            body {organisation, note}; admin of that org only
/product/variants/                        ProductVariantViewSet (?product=<id>), product org admin
/product/spaces/                          SpaceViewSet (?project=)
/product/assignments/                     ProductAssignmentViewSet
  POST /                                  propose (variant + proposer_note optional)
  POST {id}/confirm/                      body {role}
  POST {id}/decline/                      body {note?}  non-proposer only
  POST {id}/undecline/                    decliner only
  POST {id}/edit_note/                    body {note}   proposer only
  DEL  {id}/                              proposer or admin
/product/client-pricing/ | project-pricing/ | organisation-pricing/
/product/discount-tiers/ | ifc-models/ | documents/
```

`perform_create` / `perform_update` on `ProductViewSet` always re-derive the
organisation from the caller's actual admin memberships — the `organisation`
field in the request payload is a hint, never trusted outright.

Pending products are returned by the catalog endpoint **only to the person who
suggested them**; the frontend therefore treats `status === "pending"` on a
catalog card as "mine" (shows Edit suggestion / Withdraw).

---

## 4. Frontend — `product/` page (propose/confirm/decline)

### File map
- **`productApi.ts`** — all `axios` calls + shared types (`Assignment`,
  `ProductItem`, `ProductVariant`, `Role`, `MembershipRole`, …), constants
  (`CATEGORIES`, `IFC_PREDEFINED_TYPES`, `CATALOG_PAGE_SIZE`) and pure helpers
  (`formatPrice`, `getPriceInfo`, `getImageSource`, `getVariantImageSource`,
  `getDisplayName`, `roleToUiRole`, `groupByOrganisation`,
  `getApiErrorMessage`). Request interceptor adds the bearer token; a 401
  response redirects to `/auth/login?next=…`.
- **`page.tsx`** — the screen shell: org/project picker, space picker +
  add/edit-space modal, "What {space} needs" chips, the unified
  assigned-products list with filters, totals, Print and SOR CSV buttons.
  Resolves the current user id via `getCurrentUser()` (import path must match
  your tree).
- **`ProductCatalog.tsx`** — the catalog grid (server-side search / category /
  type / pagination), `VariantPicker`, propose-with-note box, org-note editor
  (admin), suggest/edit/withdraw product modal with `ImagePasteField`. Also
  exports `PriceBlock`, `ProductLink` and `useDebounced`, which `page.tsx`
  reuses.
- **`ProductListPrint.tsx`** — client-side PDF export via `jspdf` +
  `jspdf-autotable`. Pure `generateProductListPdf()` + a thin
  `<ProductListPrintButton>` wrapper with a loading state.
- **`SorExport.tsx`** — client-side Schedule-of-Rates CSV (see §6a).
- **`product.css`** — all `pf-*` colour/spacing tokens. Layout stays in
  Tailwind utility classes; this file only owns the palette.

Types worth knowing:

- `ProductItem` carries `rate_id?`, `unit?`, `predefined_type?`,
  `variants?: ProductVariant[]`, `has_variants?`, `organisation_note?`.
- `Assignment` carries `variant: number | null`, `variant_detail?:
  ProductVariant | null`, `proposed_by_user?: number | null`.
- `PricedFields` (`base_price`, `currency`, `effective_price`) is the shared
  shape that both a `ProductItem` and a `ProductVariant` satisfy, so
  `getPriceInfo` / `formatPrice` / `<PriceBlock>` work on either.

### Page state, grouped by concern

| Concern | State |
|---|---|
| Org/project/role context | `organisations`, `orgId`, `projectId`, `role` (UI role), `rawRole`, `currentUserId` |
| Space picker (target for **new** proposals) | `spaces`, `spaceId` |
| Catalog browsing (in `ProductCatalog`) | `categoryId` (lifted to page), `predefinedTypeId`, `searchTerm`, `page`, `pageItems`, `totalCount` |
| **Assigned-products filters** | `filterSpaceIds`, `filterCategory`, `filterPredefinedType`, `filterSearch` (debounced 250 ms) |
| Propose-time note (new assignment) | `proposingNoteId`, `proposeNoteText` (in `ProductCatalog`) |
| Chosen size per product | `selectedVariantByProduct` (in `ProductCatalog`) |
| Post-creation note edit | `editingNoteId`, `editNoteText` |
| Decline note | `decliningNoteId`, `declineNoteText` |
| Per-action busy flags (disable double-clicks) | `busyKeys` + `runExclusive(key, fn)`, passed down to the catalog |

**Two different "space" concepts, don't conflate them:**
- `spaceId` — the *single* space currently selected in the pill row; it's
  the target when you propose a *new* item from the catalog, and drives the
  "What {space} needs" requirement chips.
- `filterSpaceIds` — a *set*, independent of `spaceId`, controlling which
  spaces' assignments show in the "Assigned products" list. Defaults to
  *all* spaces (set from `reloadProjectData`).

The predefined-type dropdowns (both the assigned-list filter and the catalog
filter) depend on the selected category and are cleared whenever it changes.

### The unified assigned-products list

One list (`filteredAssignments`), filtered by:
1. `filterSpaceIds` (checkbox row, "Select all" / "Clear")
2. `filterCategory` and `filterPredefinedType`
3. `filterSearch`, matched against item/manufacturer/model

Each row is a card showing: space badge, image (variant's if picked), name,
manufacturer/model, `Size: <variant label>` if any, "Proposed by …", price
(via `<PriceBlock>`: effective price plus struck-through MRP + %-diff badge
when an override applies), product link, status pill, and the action buttons
described in §2. `proposer_note` and `declined_note` render as callouts under
the row.

Price and image for a row come from `variant_detail` when present, else the
product (`assignmentPriceSource` / `assignmentImageSource`) — both already
carry server-resolved values.

`filteredTotals` sums effective price per currency over the filtered rows.
Both the PDF and the CSV are built from the same assignments, but note:
**the PDF exports exactly the filtered rows; the SOR CSV exports the whole
project** (§6a).

> Caveat: `priceIndex` (used to re-price assignment products) is built from the
> first page of an unfiltered `getProductsByCategory("", projectId)` call, and
> falls back to each assignment's own `product_detail` for anything not on
> that page.

### Catalog grid

Independent of the assigned-list filters — scoped to the single `spaceId`
pill selection (`selectedCountsForSpace`, "Added ×N" badge) and the catalog's
own category/type/search, fetched server-side 12 per page.

Clicking the action button doesn't propose immediately: if the product has
variants a size must already be chosen, then an inline note box opens so the
proposer can attach a `proposer_note` (or skip it) before "Add". Button label
varies by role (client: "Select for this space"; architect side: "Suggest for
this space").

Admin-only on each card: "Add/Edit org note" (inline editor, saved via
`setOrganisationNote`). Pending suggestions show a "Not approved yet — visible
only to you" tag with Edit suggestion / Withdraw.

---

## 5. Frontend — `product/manage` page (catalog admin)

### File map
- **`productAdminApi.ts`** — all admin-side `axios` calls + types
  (`AdminProduct`, `ProductVariant`, `DiscountTier`, `ProjectPricing`,
  `OrganisationPricing`, `IFCModel`, `AdminScope`, …). `uploadIfcModel` /
  `addDiscountTier` take an `OwnerTarget` — either a `productId`
  (product-wide) or a `variantId`. `addProjectPricing` /
  `addOrganisationPricing` (and their update variants) take an optional
  trailing `variantId`.
- **`ProductEditPanel.tsx`** — the tabbed edit panel: **Details**, **Variants**,
  **Project / Org pricing**, **Organisation note**. Also exports `FileChooser`
  (four paste paths — Ctrl+V, right-click, mobile long-press, explicit Paste
  button reading the OS clipboard), `EMPTY_FORM`, `EMPTY_VARIANT_FORM` and
  `inputBase`.
- **`page.tsx`** — Catalog / Pending-suggestions toggle, category + type
  filters, the products table (desktop) / cards (mobile), expandable details
  (variants summary, discount tiers via `prompt()`, product-level IFC file),
  and the project/org pricing modals.
- **`page.css`** — `pm-*` tokens, including `pm-variant-*` and the
  `pm-file-*` / `pm-paste-surface` classes used by `FileChooser`.

### Details tab fields

Space, Category, Type (when the category has types), Item, **Unit (schedule of
rates)** with a datalist (`count`, `m`, `m2`, `m3`, `kg`, `lumpsum`) and the
read-only **Rate ID** hint, Manufacturer, Model, Base price, Currency, Cost
price, Product link, Product image.

`unit` flows: `EMPTY_FORM.unit` → `startEdit` copies `p.unit` into the form →
`buildFormData` appends it on create → `updateProduct` sends every defined
field on update.

Optional: a "Rate ID" column in the products table (`<th>` + `<td>`, and bump
the expanded row's `colSpan` from 8 to 9).

### Catalog tab vs Pending tab

- Catalog shows **approved** products only (filtered client-side from
  `admin_list`), with category/type filters built from the full static lists,
  not just what's loaded.
- Pending shows the review queue from `/products/pending/` with Approve /
  Reject (reject asks for a reason via `prompt()`).

### Editing a product's variants

Open a product → **Variants** tab. Each row shows the variant's resolved
thumbnail/price (inherited from the product where unset), plus a
"needs IFC model" badge if `has_distinct_geometry` is true but there's no IFC
file of its own yet — a reminder, not a hard block; the two-step
create-then-upload flow is intentional. "IFC model" expands the same
`FileChooser` upload/remove UI as the product-level one, scoped to `variant`.

Adding a variant only requires a `label` — every other field is optional and,
left blank, inherits from the product. Don't pre-fill price/currency/image on
every new variant "to be safe".

### Pricing modals with variant scope

`openProjectPricingModal` / `openOrgPricingModal` read `existing.variant` when
editing, and the modal shows an "Applies to" `<select>` — **only rendered if
the product has variants** — defaulting to "Whole product (every variant)".
Submit handlers convert the selection to a `variantId` (or `undefined`) and
pass it as the trailing argument. `PricingTab` shows the scope
(`variantScopeLabel`) next to each rule, and hides rules for projects/orgs the
admin doesn't administer (with a "N more rules exist…" note).

---

## 6. PDF export (`ProductListPrint.tsx`)

`generateProductListPdf(props)` builds a landscape A4 doc with `jspdf` +
`autoTable`:

- **Header/footer**: "Product List", `org · project`, scope label + generated
  time; footer "Modelflick - Fixture & Product Assignment" and "Page i of n".
- **Images**: `loadImageForPdf()` uses `fetch(url, { mode: "cors" })` +
  `FileReader` (the server must send correct CORS headers — see nginx config),
  with a 15 s `AbortController` timeout. It resizes to ≤300 px longest side
  and flattens onto white before `canvas.toDataURL('image/png')`. There is
  **no** proxy fallback. `loadImagesWithLimit` runs **4 at a time** so mobile
  isn't flooded. Failures just leave the cell blank.
- **Columns**: `#` → Space (if any row has one) → Image → Item →
  Manufacturer / Model → **Variant** (if any row has one) → Price → Status →
  Proposed By → **Notes** (if any) → Product Link (if any).
- **Notes column**: `Note (<proposed_by>): <proposerNote>` and
  `Declined: <declinedNote>`, joined by `\n`; `autoTable`'s default
  `overflow: 'linebreak'` wraps it.
- **Product Link column**: custom `didDrawCell` — draws underlined blue text
  *and* calls `doc.link(...)` over the whole cell, so it's clickable.
- **Totals**: right-aligned under the table, one line per currency, or
  "No priced items yet."
- Filename: `product-list-<slugified scope label>.pdf`.

If you add a field that should appear in print, extend `PrintableRow` in this
file **and** the `filteredPrintRows` mapping in `page.tsx` — two separate
places by design.

### 6a. Schedule-of-Rates CSV (`SorExport.tsx`)

Client-side only — **no backend endpoint**. Built from the project's loaded
assignments.

- **Button**: `<SorExportButton>` in the "Assigned products" header, rendered
  only when `rawRole !== "client" && assignments.length > 0`. Disabled with a
  tooltip when there are no rows.
- **Which rows**: assignments for the current project, `declined` excluded,
  **deduplicated per product + variant** (a basin used in three bathrooms is
  one row). It ignores the on-screen filters.
- **Columns**: `Index, Identification, Description, Name, Quantity, Unit,
  Value`.

| Column | Value |
|---|---|
| Index | always `1` |
| Identification | `product.rate_id` (fallback `UNID-<uuid6>`), plus `-<VARIANTLABEL>` for a variant (uppercased, non-alphanumerics stripped) |
| Description | `<item> - <manufacturer> <model_label>` |
| Name | `<item>`, or `<item> (<variant label>)` |
| Quantity | always `1` |
| Unit | `product.unit`, fallback `count` |
| Value | the variant's (else product's) project-effective price — project/org/client overrides apply; blank if no price |

- Rows are sorted by Identification with numeric-aware comparison.
- CSV is CRLF-separated, cells quoted/escaped per RFC 4180, with a UTF-8 BOM so
  Excel opens it correctly. Filename `schedule-of-rates-<project-slug>.csv`.
- Quantity is deliberately a constant `1` (rate list, not a BOQ). There is no
  quantity field on `ProductAssignment`; if real quantities are ever needed,
  add one through a dedicated `@action` + `CanModifyAssignment` branch.

---

## 7. Extension checklist

### Adding a new assignment field that only one side should write (like `proposer_note`)

1. **Model**: nullable/blank field — avoids a data migration for existing rows.
2. **Migration**: `python manage.py makemigrations product && python manage.py migrate product`.
3. **Permission**: add a branch to `CanModifyAssignment.has_object_permission`
   keyed on `view.action`, **not** a blanket PATCH allowance.
4. **View**: a dedicated `@action(detail=True, methods=['post'])`, mirroring
   `edit_note`/`decline` — never widen `update`/`partial_update`.
5. **Frontend types**: add the field to `Assignment` in `productApi.ts` and an
   API function for the new action.
6. **Frontend UI**: gate the write control on the correct side (`isProposer` /
   `!isProposer`) — the *button* should be as strict as the *permission*.
7. **Print / CSV**: extend `PrintableRow` + `filteredPrintRows` (PDF) and/or
   `buildSorRows` (CSV) if it should be exported.

Adding a brand-new mutating action in general? Put it through the same
`view.action == '...'` pattern in `CanModifyAssignment` rather than
special-casing it in `has_permission` — object-level checks need the actual
`ProductAssignment` instance, which `has_permission` doesn't have.

### Adding a new field on `Product` (like `unit`)

1. `models.py`: add the field (blank/default so existing rows are fine) →
   migration.
2. `admin.py`: add to `list_display` / `search_fields` / `readonly_fields` as
   appropriate (`editable=False` fields only show if listed in
   `readonly_fields`).
3. Serializer: nothing if `ProductSerializer` is `'__all__'`; add it to
   `ProductSuggestionSerializer` only if clients may set it.
4. `productApi.ts`: add to `ProductItem` (and `ProductSuggestionInput` +
   `suggestProduct` / `updateProductSuggestion` if clients set it).
5. `productAdminApi.ts`: add to `AdminProduct`, `ProductFormValues` and
   `buildFormData`.
6. `ProductEditPanel.tsx`: add to `EMPTY_FORM` and the Details tab;
   admin `page.tsx`: copy it in `startEdit`.

### Adding a new variant-scoped model (product-wide or variant-specific, like pricing/IFC/documents)

1. Nullable `variant` FK on the model, alongside the existing `product` FK.
2. `clean()` validating `variant.product_id == product_id`.
3. `IsProductOrgAdmin` already handles permission via its `_owning_product`
   helper — no backend permission changes needed.
4. Frontend: extend the relevant `OwnerTarget`-style function signature in
   `productAdminApi.ts` (see `uploadIfcModel`/`addDiscountTier`) rather than
   adding a parallel `addXForVariant` function.

---

## 8. Known caveats

- `Product.space` (legacy free text) vs `Space` model — different things.
- `CATEGORIES` / `IFC_PREDEFINED_TYPES` are duplicated in `models.py` and
  `productApi.ts`; edit both.
- `ProductVariant.clean()` demands an IFC model when the variant has its own
  image, but the admin UI deliberately creates first and uploads second —
  `clean()` is only enforced where something calls `full_clean()`.
- `Product.get_effective_price` returns `cost_price` only when `variant is
  None`; a variant without its own overrides resolves to its own effective
  base price, not the product's `cost_price`.
- SOR CSV ignores the on-screen filters and exports the whole project;
  rows proposed before `proposed_by_user` existed can only be removed by an
  admin.
- Old products need the `rate_id` backfill (§1b) or the CSV shows `UNID-…`.