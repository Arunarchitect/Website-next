markdown
# Fixture & Product Assignment — dev reference

Covers the `product` Django app (models/serializers/views) and the Next.js
`product` page (`page.tsx` + `productApi.ts` + `ProductListPrint.tsx`), plus
the admin-side `product/manage` page (`page.tsx` + `productAdminApi.ts` +
`ProductEditPanel.tsx`). This is the module where clients and architects
pick fixtures/products (sinks, mixers, lights, etc.) for each room ("space")
of a project, negotiate via propose/confirm/decline, and export the result
as a PDF — and where org admins maintain the catalog itself, including
per-size variants, pricing, and IFC models.

---

## 1. Domain model

Organisation
└─ Project
├─ Space (a room: "Kitchen", "Bed2 Toilet", …)
│ └─ required_categories: [IFC category codes] — what that room needs
└─ ProductAssignment (a product proposed for one Space)
├─ product → Product
├─ variant → ProductVariant | null — which size/option was picked
├─ proposed_by 'client' | 'architect'
├─ proposer_note free text, written by the proposer only
├─ client_confirmed / architect_confirmed
└─ declined / declined_by / declined_at / declined_note

Product (catalog entry — a specific manufacturer/model)
├─ category (IFC_CATEGORY_CHOICES)
├─ status: pending | approved | rejected (client suggestions start pending)
├─ organisation (who must review a suggestion)
├─ base_price / currency, cost_price — used directly if the product has no variants
├─ variants: ProductVariant[] — zero or more size/option rows
├─ pricing overrides: ClientPricing, ProjectPricing, OrganisationPricing, DiscountTier
├─ ifc_model (IFCModelFile), additional_documents
└─ get_effective_price(user, project, organisation, quantity, variant=None)
priority: per-client > per-project > per-organisation > quantity tier > base_price

ProductVariant (a specific size/option of a Product, e.g. "1000L")
├─ label, sort_value, sku
├─ base_price / currency / cost_price — nullable; falls back to Product's if unset
├─ variant_image / variant_thumbnail — nullable; falls back to Product's if unset
├─ ifc_model (IFCModelFile) — nullable; falls back to Product's if unset
└─ effective_* properties expose the resolved value — always use these, never the raw field


### 1a. ProductVariant

A `Product` may have zero or more `ProductVariant` rows (a size/option,
e.g. "1000L"). `ProductAssignment.variant` records which one was picked —
nullable, since a product with no variants is assigned directly.

**Everything on a variant is a fallback.** Price, image, and IFC model each
resolve to the parent `Product`'s own value whenever the variant doesn't
set its own — this is done server-side (`effective_price`, `thumbnail_url`
on the serializer), so the frontend never needs to fall back itself.
`product.has_variants` tells you whether to render a size picker before
"Add to space"; if `false`, propose the assignment with `variant: null`
exactly as before variants existed.

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

### Roles

There are 4 raw membership roles (`OrganisationMembership.role` /
`ProjectMembership.role`): `admin`, `manager`, `member`, `client`.
Everywhere in the *product* app they collapse to a **UI role**:

```python
def role_to_ui_role(raw_role):
    return 'client' if raw_role == 'client' else 'architect'
```

`admin` / `manager` / `member` are all "architect" for propose/confirm/decline
purposes. `manager`/`member` are additionally **view-only** in the frontend
(`isViewOnly` in `page.tsx`) — they can see everything but no action buttons
render for them. Only `admin` gets the "Manage catalog" link and can
create/approve/reject Products and manage variants.

---

## 2. The propose → confirm/decline lifecycle
             propose (with optional variant + proposer_note)
                      │
                      ▼
          ┌───────────────────────┐
          │  awaiting confirmation │
          └───────────────────────┘
          /            |            \

other side confirms other side declines proposer removes
(client_confirmed && (declined=true, (hard delete —
architect_confirmed) declined_by, ...) only if still
│ │ unconfirmed by
▼ ▼ the other side)
Confirmed declined party can
undecline → back to
"awaiting confirmation"


Key asymmetry, enforced by `CanModifyAssignment` (views.py):

| Action | Who may do it |
|---|---|
| `destroy` (hard delete) | **only** the original proposer, and only their own proposal |
| `decline` | **only** the non-proposing side |
| `undecline` | **only** whoever declined it (`declined_by`) |
| `edit_note` (proposer_note) | **only** the original proposer |
| generic `PATCH`/`PUT` | **nobody** — always denied |

The last row matters: there is deliberately no generic update endpoint.
Every field mutation on a `ProductAssignment` goes through one of the named
actions above so each field's permission stays scoped. If you need to let
some new field be edited, add a new `@action` + permission branch — don't
relax the generic PATCH. `variant` is set only at propose time
(`POST /assignments/`), same as `product`; there's no dedicated "change
variant" action — if the client wants a different size, the existing
assignment is removed and a new one proposed.

### Notes — who can write what

Two independent free-text fields, never editable by the other party:

- **`proposer_note`** — written by whoever proposed the assignment (client
  *or* architect, whichever side `proposed_by` is). Settable at propose time
  (`POST /assignments/`) or any time after via `POST /assignments/{id}/edit_note/`.
  The non-proposing side never gets a UI control for this field — the
  permission class blocks it server-side too, so it's not just a UI-level
  restriction.
- **`declined_note`** — written by whoever declines (`POST
  /assignments/{id}/decline/`), i.e. always the *other* side from the
  proposer. Cleared automatically on `undecline`.

---

## 3. Backend — `product/` app

### `models.py`
- `Product` — catalog entry + `get_effective_price()` pricing resolution.
- `ProductVariant` — a size/option of a Product. Every field falls back to
  the parent Product via `effective_*` properties when unset.
- `ClientPricing` / `ProjectPricing` / `OrganisationPricing` / `DiscountTier`
  — the four pricing-override tables `get_effective_price` checks in order.
  Each has a nullable `variant` FK: `null` = product-wide, set = scoped to
  that one variant.
- `IFCModelFile` — belongs to exactly one of `product` or `variant`
  (enforced by a `CheckConstraint`).
- `AdditionalDocument` — always tied to a `product`; optionally further
  scoped to one `variant`.
- `Space` — a room, with `required_categories` (JSON list of IFC category
  codes) driving the "What {space} needs" chips in the UI.
- `ProductAssignment` — see lifecycle above. `variant`, `proposer_note` and
  `declined_note` are all nullable/blank — no migration headaches when
  adding any of them to a table with existing rows.

### `serializers.py`
- `ProductSerializer` — `fields = '__all__'`; nests `variants`, pricing
  rules, IFC file, documents, and computes `effective_price` (product-level,
  i.e. no variant chosen) via `get_serializer_context()['price_project'/'price_organisation']`
  (set by `ProductViewSet.catalog`). `has_variants` tells the frontend
  whether to show a size picker.
- `ProductVariantSerializer` — nests the variant's own `ifc_model`, and
  computes `effective_price`/`thumbnail_url` the same way as the product
  serializer, scoped to that variant.
- `ProductSuggestionSerializer` — the restricted field set a *client* can
  set when suggesting a brand-new catalog product (`POST
  /products/suggest/`). `status`/`uploaded_by`/`reviewed_*` are forced
  server-side, never trusted from the payload. Client suggestions can't
  include variants — those are an admin-only refinement after approval.
- `ProductAssignmentSerializer` — `fields = '__all__'` too. This is safe
  *only* because `CanModifyAssignment` blocks generic PATCH/PUT — the
  serializer alone would happily let anyone rewrite any field. `validate()`
  rejects a `variant` that doesn't belong to the assigned `product`.

### `views.py` — permission classes worth knowing

- **`IsStaffOrReadOnly`** — Product catalog default: Django `is_staff` for
  writes. (Superseded per-action below for the app-level admin flows.)
- **`IsOrganisationAdmin`** / **`IsOrgAdminAnywhere`** — "app admin" is an
  `OrganisationMembership.role='admin'` row, **not** Django `is_staff`. Two
  completely separate admin concepts exist in this codebase; don't conflate
  them.
- **`CanEditProduct`** / **`CanDeleteProduct`** — a client may edit/withdraw
  their *own* suggestion only while `status == pending`; once an org admin
  approves it, only an org admin can touch it further.
- **`IsProductOrgAdmin`** — governs pricing overrides / variants / IFC
  files / docs hung off a Product. Resolves the "owning product" generically
  — `obj.product` if present, else `obj.variant.product` — so one
  permission class covers pricing rules, `ProductVariant`, and both
  product- and variant-owned `IFCModelFile` rows. Has an "orphan" escape
  hatch: if the owning Product has no `organisation` set, *any* org admin
  may fix it up.
- **`CanModifyAssignment`** — see the lifecycle table above. **This is the
  one to read closely before adding any new assignment-mutating action.**

### Notable endpoints (`ProductViewSet` / `ProductVariantViewSet` / `ProductAssignmentViewSet`)

GET /product/products/catalog/?category=&project=&search= priced, project-scoped
GET /product/products/admin_list/?search= all statuses, org-scoped, admin only
POST /product/products/suggest/ client suggests a new product
GET /product/products/pending/ admin's review queue
POST /product/products/{id}/approve/ | /reject/ admin only

GET /product/variants/?product=<id> a product's size/option rows
POST /product/variants/ admin only (product org admin)
PATCH/DELETE /product/variants/{id}/

POST /product/assignments/ propose (variant + proposer_note optional)
POST /product/assignments/{id}/confirm/ body: {role}
POST /product/assignments/{id}/decline/ body: {note?} non-proposer only
POST /product/assignments/{id}/undecline/ decliner only
POST /product/assignments/{id}/edit_note/ body: {note} proposer only
DEL /product/assignments/{id}/ proposer only, before other side confirms

GET /product/my-context/ projects the user can act on + role + assignment counts
GET /product/admin-scope/ orgs/projects the user administers (pricing dropdowns)


`perform_create` / `perform_update` on `ProductViewSet` always re-derive the
organisation from the caller's actual admin memberships — the `organisation`
field in the request payload is a hint, never trusted outright.

---

## 4. Frontend — `product/` page (propose/confirm/decline)

### File map
- **`productApi.ts`** — all `axios` calls + shared types (`Assignment`,
  `ProductItem`, `Role`, …) + pure helpers (`formatPrice`, `getPriceInfo`,
  `roleToUiRole`, `groupByOrganisation`).
- **`page.tsx`** — the whole screen: org/project picker, space picker,
  the unified assigned-products list, the catalog grid, the two modals
  (suggest-product, add/edit-space).
- **`ProductListPrint.tsx`** — client-side PDF export via `jspdf` +
  `jspdf-autotable`. Pure function `generateProductListPdf()` + a thin
  `<ProductListPrintButton>` wrapper with a loading state.
- **`product.css`** — all `pf-*` color/spacing tokens. Layout stays in
  Tailwind utility classes in `page.tsx`; this file only owns the palette.

`ProductItem` (in `productApi.ts`) carries `variants?: ProductVariant[]`
and `has_variants?: boolean`; `Assignment` carries `variant?: string | null`
and `variant_detail?: ProductVariant`. When `has_variants` is true, render
a size picker before proposing; `proposeAssignment` takes an optional
`variantId` to include in the POST body.

### Page state, grouped by concern

| Concern | State |
|---|---|
| Org/project/role context | `organisations`, `orgId`, `projectId`, `role`, `rawRole` |
| Space picker (target for **new** proposals) | `spaces`, `spaceId` |
| Catalog browsing | `catalogAll`, `categoryId`, `searchTerm` |
| **Assigned-products filters** (space multi-select, category, search) | `filterSpaceIds`, `filterCategory`, `filterSearch` |
| Propose-time note (new assignment) | `proposingNoteId`, `proposeNoteText` |
| Post-creation note edit (existing assignment) | `editingNoteId`, `editNoteText` |
| Decline note | `decliningNoteId`, `declineNoteText` |
| Per-action busy flags (disable double-clicks) | `busyKeys` + `runExclusive(key, fn)` |

**Two different "space" concepts, don't conflate them:**
- `spaceId` — the *single* space currently selected in the pill row; it's
  the target when you propose a *new* item from the catalog, and drives the
  "What {space} needs" requirement chips.
- `filterSpaceIds` — a *set*, independent of `spaceId`, controlling which
  spaces' assignments show in the "Assigned products" list. Defaults to
  *all* spaces (set from `reloadProjectData`), so a fresh page load shows
  everything for the project, per the "load all products if all selected"
  requirement.

### The unified assigned-products list

Originally this was two separate sections ("Assigned to {space}" +
"All spaces" table). It's now **one** list (`filteredAssignments`), filtered
by:
1. `filterSpaceIds` (checkbox row, "Select all" / "Clear")
2. `filterCategory` (dropdown, `""` = all)
3. `filterSearch`, debounced 250ms, matched against item/manufacturer/model

Each row is a card (not a table row) showing: space badge, image, name,
manufacturer/model, size/variant label if the assignment has one, "Proposed
by …", price (via `<PriceBlock>`, which shows the effective price plus a
struck-through MRP + %-diff badge when a pricing override applies — the
override may be product-wide or variant-specific, `<PriceBlock>` doesn't
need to care which), product link, status pill, and the action buttons
described in §2. Both `proposer_note` and `declined_note` render as their
own callout blocks directly under the row when present.

`ProductListPrintButton` next to the list header exports **exactly what's
currently filtered** — same rows, same totals, same scope label — as a PDF.

### Catalog grid

Independent of the filters above — always scoped to the single `spaceId`
pill selection (`selectedCountsForSpace`, "Added ×N" badge) and `categoryId`
+ `searchTerm`. Clicking the action button doesn't propose immediately: if
the product `has_variants`, a size picker appears first; either way it then
opens an inline note box (`proposingNoteId`) so the proposer can attach
their `proposer_note` before the assignment is created (or skip it and hit
"Add" with it blank).

---

## 5. Frontend — `product/manage` page (catalog admin)

### File map
- **`productAdminApi.ts`** — all admin-side `axios` calls + types
  (`AdminProduct`, `ProductVariant`, `DiscountTier`, `ProjectPricing`,
  `OrganisationPricing`, `IFCModel`, …). `uploadIfcModel` / `addDiscountTier`
  / `addProjectPricing` / `addOrganisationPricing` all take an owner
  target — either a `productId` (product-wide) or a `variantId`
  (scoped to that one variant) — mirroring the backend's nullable
  `variant` FK pattern.
- **`ProductEditPanel.tsx`** — the tabbed edit panel opened when adding or
  editing a product: **Details** (base fields + product image), **Variants**
  (add/edit/delete size options, each with its own optional image + IFC
  file), **Project / Org pricing** (with an "Applies to" scope picker once
  the product has variants), **Organisation note**. Also exports the shared
  `FileChooser` component (four independent paste paths — Ctrl+V, right-click
  menu, mobile long-press, and an explicit Paste button reading the OS
  clipboard — used for every image/file field in this page).
- **`page.tsx`** — catalog table/cards, the pending-suggestions review
  queue, and the pricing modals (which now include the variant-scope
  dropdown when the product being priced has variants).
- **`page.css`** — `pm-*` tokens; includes `pm-variant-*` classes for the
  Variants tab's cards and inline add/edit form.

### Editing a product's variants

Open a product → **Variants** tab. Each row shows the variant's resolved
thumbnail/price (already inherited from the product where unset), plus a
"needs IFC model" badge if `has_distinct_geometry` is true (i.e. the
variant has its own image) but it has no IFC file of its own yet — a
reminder, not a hard block; the two-step create-then-upload flow is
intentional. Expanding a row's "IFC model" link shows the same
`FileChooser`-based upload/remove UI as the product-level one in
`ProductDetailsPanel`, just scoped to `variant` instead of `product`.

Adding a variant only requires a `label` — every other field (`sort_value`,
`sku`, price, currency, image) is optional and, left blank, inherits from
the product. Don't pre-fill price/currency/image on every new variant "to
be safe" — leaving them blank is the correct default for a variant that
doesn't actually differ on that axis.

### Pricing modals with variant scope

`openProjectPricingModal` / `openOrgPricingModal` (in `page.tsx`) read
`existing.variant` when editing a rule, and the modal shows an "Applies to"
`<select>` — **only rendered if the product has variants** — defaulting to
"Whole product (every variant)". `submitProjectPricing` / `submitOrgPricing`
convert the selection to a `variantId` (or `undefined` for whole-product)
and pass it as the extra argument to `addProjectPricing`/`updateProjectPricing`
/`addOrganisationPricing`/`updateOrganisationPricing`. The pricing chip list
in `PricingTab` shows the scope (`variantScopeLabel`) next to each rule so
an admin can tell at a glance which rules are variant-specific.

---

## 6. PDF export (`ProductListPrint.tsx`)

`generateProductListPdf(props)` builds a landscape A4 doc with `jspdf` +
`autoTable`:

- **Images**: `loadImageForPdf()` tries a direct `<img crossOrigin>` canvas
  read first, falls back to an `allorigins.win` CORS proxy if that's
  blocked. Both resize to ≤300px longest side and flatten onto a white
  background before `canvas.toDataURL('image/png')`.
- **Columns**: Space (if any row has one) → Image → Item →
  Manufacturer/Model → Price → Status → Proposed By → **Notes** → Product
  Link (if any row has one). If you want the picked size/variant in the
  export, add a `variantLabel` column the same way — see the extension
  checklist below.
- **Notes column**: combines `proposerNote` (labelled "Client note:" /
  "Architect note:" per `proposed_by`) and `declinedNote` ("Decline note:")
  with a `\n` between them when both are present; `autoTable`'s default
  `overflow: 'linebreak'` wraps it, no custom cell drawing needed.
- **Product Link column**: custom `didDrawCell` — draws real underlined
  blue text *and* calls `doc.link(...)` over the whole cell, so the link is
  clickable in the exported PDF, not just decorative-looking text.
- **Totals**: right-aligned under the table, one line per currency.

If you add a new field that should appear in print, extend `PrintableRow` in
this file **and** the corresponding `filteredPrintRows` mapping in
`page.tsx` — they're two separate places by design (the print component
doesn't know about `Assignment`, only about its own flat row shape).

---

## 7. Extension checklist

Adding a new assignment field that only one side should write (like
`proposer_note`)?

1. **Model**: nullable/blank `TextField` (or similar) — avoids a data
   migration for existing rows.
2. **Migration**: `python manage.py makemigrations <app_label> && python
   manage.py migrate <app_label>`.
3. **Permission**: add a branch to `CanModifyAssignment.has_object_permission`
   keyed on `view.action`, **not** a blanket PATCH allowance.
4. **View**: a dedicated `@action(detail=True, methods=['post'])`, mirroring
   `edit_note`/`decline` — never widen the generic `update`/`partial_update`.
5. **Frontend types**: add the field to `Assignment` in `productApi.ts`, add
   an API function for the new action.
6. **Frontend UI**: gate the write control on the correct side (`isProposer`
   / `!isProposer` as appropriate) — the *button* should be as strict as the
   *permission*, so a stale frontend never even offers an action the backend
   would reject.
7. **Print**: if it should show up in exports, extend `PrintableRow` +
   `filteredPrintRows`.

Adding a brand-new mutating action in general? Put it through the same
`view.action == '...'` pattern in `CanModifyAssignment` rather than
special-casing it in `has_permission` — object-level checks need the actual
`ProductAssignment` instance (its `project`, `proposed_by`, `declined_by`),
which `has_permission` doesn't have.

Adding a new variant-scoped model (something else that can be either
product-wide or variant-specific, like pricing/IFC/documents)?

1. Nullable `variant` FK on the model, alongside the existing `product` FK.
2. `clean()` validating `variant.product_id == product_id`.
3. `IsProductOrgAdmin` already handles permission via its
   `_owning_product` helper — no backend permission changes needed.
4. Frontend: extend the relevant `OwnerTarget`-style function signature in
   `productAdminApi.ts` (see `uploadIfcModel`/`addDiscountTier` for the
   pattern) rather than adding a parallel `addXForVariant` function.