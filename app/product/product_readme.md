# Fixture & Product Assignment — dev reference

Covers the `product` Django app (models/serializers/views) and the Next.js
`product` page (`page.tsx` + `productApi.ts` + `ProductListPrint.tsx`).
This is the module where clients and architects pick fixtures/products
(sinks, mixers, lights, etc.) for each room ("space") of a project, negotiate
via propose/confirm/decline, and export the result as a PDF.

---

## 1. Domain model

```
Organisation
  └─ Project
       ├─ Space              (a room: "Kitchen", "Bed2 Toilet", …)
       │    └─ required_categories: [IFC category codes]  — what that room needs
       └─ ProductAssignment  (a product proposed for one Space)
              ├─ product        → Product
              ├─ proposed_by    'client' | 'architect'
              ├─ proposer_note  free text, written by the proposer only
              ├─ client_confirmed / architect_confirmed
              └─ declined / declined_by / declined_at / declined_note

Product                       (catalog entry — a specific SKU)
  ├─ category (IFC_CATEGORY_CHOICES)
  ├─ status: pending | approved | rejected   (client suggestions start pending)
  ├─ organisation                            (who must review a suggestion)
  ├─ base_price / currency, cost_price
  ├─ pricing overrides: ClientPricing, ProjectPricing, OrganisationPricing, DiscountTier
  ├─ ifc_model (IFCModelFile), additional_documents
  └─ get_effective_price(user, project, organisation, quantity)
       priority: per-client > per-project > per-organisation > quantity tier > base_price
```

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
create/approve/reject Products.

---

## 2. The propose → confirm/decline lifecycle

```
                 propose (with optional proposer_note)
                          │
                          ▼
              ┌───────────────────────┐
              │  awaiting confirmation │
              └───────────────────────┘
              /            |            \
   other side confirms   other side declines   proposer removes
   (client_confirmed &&   (declined=true,       (hard delete —
    architect_confirmed)   declined_by, ...)      only if still
              │                   │                unconfirmed by
              ▼                   ▼                 the other side)
          Confirmed         declined party can
                             undecline → back to
                             "awaiting confirmation"
```

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
relax the generic PATCH.

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
- `ClientPricing` / `ProjectPricing` / `OrganisationPricing` / `DiscountTier`
  — the four pricing-override tables `get_effective_price` checks in order.
- `IFCModelFile`, `AdditionalDocument` — files hung off a `Product`.
- `Space` — a room, with `required_categories` (JSON list of IFC category
  codes) driving the "What {space} needs" chips in the UI.
- `ProductAssignment` — see lifecycle above. `proposer_note` and
  `declined_note` are both `TextField(null=True, blank=True)` — no migration
  headaches when adding either to a table with existing rows.

### `serializers.py`
- `ProductSerializer` — `fields = '__all__'`; nests pricing rules, IFC file,
  documents, and computes `effective_price` via
  `get_serializer_context()['price_project'/'price_organisation']`
  (set by `ProductViewSet.catalog`).
- `ProductSuggestionSerializer` — the restricted field set a *client* can
  set when suggesting a brand-new catalog product (`POST
  /products/suggest/`). `status`/`uploaded_by`/`reviewed_*` are forced
  server-side, never trusted from the payload.
- `ProductAssignmentSerializer` — `fields = '__all__'` too. This is safe
  *only* because `CanModifyAssignment` blocks generic PATCH/PUT — the
  serializer alone would happily let anyone rewrite any field.

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
- **`IsProductOrgAdmin`** — governs pricing overrides / IFC files / docs
  hung off a Product. Has an "orphan" escape hatch: if the parent Product
  has no `organisation` set, *any* org admin may fix it up.
- **`CanModifyAssignment`** — see the lifecycle table above. **This is the
  one to read closely before adding any new assignment-mutating action.**

### Notable endpoints (`ProductViewSet` / `ProductAssignmentViewSet`)

```
GET  /product/products/catalog/?category=&project=&search=   priced, project-scoped
GET  /product/products/admin_list/?search=                    all statuses, org-scoped, admin only
POST /product/products/suggest/                                client suggests a new product
GET  /product/products/pending/                                admin's review queue
POST /product/products/{id}/approve/ | /reject/                admin only

POST /product/assignments/                                     propose (proposer_note optional)
POST /product/assignments/{id}/confirm/        body: {role}
POST /product/assignments/{id}/decline/        body: {note?}   non-proposer only
POST /product/assignments/{id}/undecline/                      decliner only
POST /product/assignments/{id}/edit_note/      body: {note}    proposer only
DEL  /product/assignments/{id}/                                proposer only, before other side confirms

GET  /product/my-context/     projects the user can act on + role + assignment counts
GET  /product/admin-scope/    orgs/projects the user administers (pricing dropdowns)
```

`perform_create` / `perform_update` on `ProductViewSet` always re-derive the
organisation from the caller's actual admin memberships — the `organisation`
field in the request payload is a hint, never trusted outright.

---

## 4. Frontend — `product/` page

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
manufacturer/model, "Proposed by …", price (via `<PriceBlock>`, which shows
the effective price plus a struck-through MRP + %-diff badge when a pricing
override applies), product link, status pill, and the action buttons
described in §2. Both `proposer_note` and `declined_note` render as their
own callout blocks directly under the row when present.

`ProductListPrintButton` next to the list header exports **exactly what's
currently filtered** — same rows, same totals, same scope label — as a PDF.

### Catalog grid

Independent of the filters above — always scoped to the single `spaceId`
pill selection (`selectedCountsForSpace`, "Added ×N" badge) and `categoryId`
+ `searchTerm`. Clicking the action button doesn't propose immediately: it
opens an inline note box (`proposingNoteId`) so the proposer can attach
their `proposer_note` before the assignment is created (or skip it and hit
"Add" with it blank).

---

## 5. PDF export (`ProductListPrint.tsx`)

`generateProductListPdf(props)` builds a landscape A4 doc with `jspdf` +
`autoTable`:

- **Images**: `loadImageForPdf()` tries a direct `<img crossOrigin>` canvas
  read first, falls back to an `allorigins.win` CORS proxy if that's
  blocked. Both resize to ≤300px longest side and flatten onto a white
  background before `canvas.toDataURL('image/png')`.
- **Columns**: Space (if any row has one) → Image → Item →
  Manufacturer/Model → Price → Status → Proposed By → **Notes** → Product
  Link (if any row has one).
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

## 6. Extension checklist

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