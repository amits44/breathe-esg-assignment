# MODEL.md — Data Model


1. **Multi-tenancy** — multiple client companies using the same app, with their data kept completely separate
2. **Scope 1/2/3 categorization** — tagging each emission record with the right GHG Protocol scope
3. **Source-of-truth tracking** — always being able to answer "where did this row come from, and what did it look like when it arrived?"
4. **Audit trail** — a log of every action anyone took, so nothing is a black box

Everything in the data model is designed around these four requirements. I'll explain each decision in plain terms below.

---

## How the tables relate to each other

```
Client
  └── User (belongs to a Client)
  └── Ingestion  (one per file upload — belongs to Client + User)
        └── RawRecord  (one per row in the file — belongs to Ingestion + Client)
              └── NormalizedRecord  (one per RawRecord — the cleaned version)
  └── Audit_log  (a running log of every action — belongs to Client + User)
```

Think of it like this: a **Client** is a company. That company has **Users**. When a user uploads a file, that creates one **Ingestion** (the upload event). Every row in that file becomes a **RawRecord** (stored exactly as-is). Each raw row is then cleaned up and stored as a **NormalizedRecord** (the version analysts actually look at). Every meaningful action along the way gets written to **Audit_log**.

---

## Multi-Tenancy

### The problem it solves

If two companies — say Acme Corp and Beta Inc — both use this platform, Acme's data must never appear in Beta's dashboard and vice versa. This needs to be enforced at the database query level, not just the UI level.

### How I implemented it

Every table that holds business data (`Ingestion`, `RawRecord`, `NormalizedRecord`, `Audit_log`) has a direct foreign key to `Client`. In `views.py`, there's a mixin called `ClientScopedMixin` that every API view inherits. It reads the logged-in user's client and automatically adds `.filter(client=client)` to every database query.

```python
def get_client(self):
    client = getattr(self.request.user, 'client', None)
    if not client:
        raise PermissionDenied("User is not associated with a client.")
    return client
```

This means there is no way to write a view and forget to scope it — the mixin handles it automatically. No query ever runs without a client filter attached.

### Why `RawRecord` has its own `client` FK even though it belongs to an `Ingestion`

You could technically figure out which client owns a `RawRecord` by joining through `Ingestion`. But if you're filtering thousands of raw records, that join adds cost. By storing the client FK directly on `RawRecord`, the filter is a simple indexed lookup on a single table. It's a small redundancy that buys real query performance.

---

## Source-of-Truth Tracking

### The core idea: store everything twice

Every row that enters the system is stored in two places:

- **`RawRecord`** — the original, untouched row exactly as it came in. If SAP sends German column headers, that's what's stored. If the date format is DD.MM.YYYY, it's stored as DD.MM.YYYY. This record is never modified after creation.

- **`NormalizedRecord`** — the cleaned, standardized version. German headers are mapped to English field names, dates are converted to ISO format, amounts are in consistent units. This is what analysts see.

### Why two tables instead of one?

The most important reason: **if there's ever a bug in the normalization logic, the original data is still intact**. For example, if I later discovered that my fuel unit conversion was wrong (converting US gallons to litres incorrectly), I can go back to the `RawRecord`, fix the conversion logic, and re-run normalization. If I only stored the normalized version, the original data is gone and the correction is impossible.

### The link between them

`NormalizedRecord` links to `RawRecord` via a **OneToOne field** (not a regular foreign key). This enforces that each raw row produces exactly one normalized row — no duplicates, no missing records. It also makes traceability clean: any normalized record points to exactly one raw record, which points to one ingestion batch, which has the filename, the uploading user, and the upload timestamp.

### What "source-of-truth" means in practice

Given any `NormalizedRecord`, I can always answer:
- Which company does this belong to? (`client`)
- Which upload batch did it come from? (`ingestion`)
- Which file was uploaded? (`original_filename` on `Ingestion`)
- Which row in that file? (`row_index` on `RawRecord`, 0-based)
- What did that row look like when it arrived? (`raw_data` on `RawRecord`)
- Which source system is it from? (`source` — `sap`, `utility`, or `navan`)

---

## Scope 1/2/3 Categorization

Scope assignment happens in `scope_classifier.py`. It runs after normalization and before the records are saved to the database. It returns three things: the scope number (1, 2, or 3), the CO2e in kg, and a list of any warnings.

### How I decided which scope to assign

I followed the GHG Protocol. The rules are:

| Where the data comes from | Condition | Scope |
|--------------------------|-----------|-------|
| SAP (procurement) | Description mentions diesel, petrol, or motor oil | 1 — direct combustion by the company |
| SAP (procurement) | Everything else | 3 — purchased goods and services |
| Utility bill | Electricity | 2 — purchased energy |
| Utility bill | Steam or heat | 2 — purchased energy |
| Utility bill | Gas or natural gas | 1 — on-site combustion |
| Utility bill | Water, sewer, or waste | 3 — minor value chain activity |
| Navan (travel) | All travel types | 3 — GHG Protocol Category 6, business travel |

### How CO2e is calculated

I used DEFRA 2023 emission factors as approximations:

| Activity | Factor |
|----------|--------|
| Diesel | 2.68 kg CO2e per litre |
| Petrol | 2.31 kg CO2e per litre |
| Motor oil | 2.50 kg CO2e per litre |
| Electricity | 0.207 kg CO2e per kWh (UK grid average) |
| Flight (economy) | 0.255 kg CO2e per passenger-km |
| Car hire | 0.171 kg CO2e per km |
| Rail | 0.041 kg CO2e per km |

### What happens when the data is incomplete

If a record is missing the quantity needed to calculate CO2e (e.g. a fuel purchase with no volume listed), the system sets `co2e_kg` to `0` and writes a human-readable warning into the `normalization_warnings` field. I deliberately chose a visible `0` with a warning over silently skipping the record or guessing — an analyst can see it needs attention.

### Fuel unit handling

SAP sometimes records fuel in US gallons. The classifier checks the unit field for `GAL`, `GALLON`, or `GALLONS` and converts to litres (1 US gallon = 3.78541 litres) before applying the emission factor. The conversion is noted in warnings so there's no confusion about where the number came from.

### Flight distance

Navan gives airport codes (e.g. `LHR` → `JFK`) but not distances. I use a default of 1,500 km per leg (a rough short-haul average) and flag every flight record with a warning. In a production system, you'd look up actual geodesic distances between airport coordinates.

---

## Audit Trail

The `Audit_log` table records every meaningful action taken in the system. It is append-only — rows are only ever created, never updated or deleted.

### What gets logged

| What triggers it | Action recorded | Extra info stored |
|-----------------|----------------|------------------|
| A file is uploaded | `upload` | source type, filename |
| Normalization finishes | `normalize` | total rows, error count |
| Analyst flags a record | `flag` | analyst's notes |
| Analyst approves a record | `approve` | analyst's notes |
| Analyst rejects a record | `reject` | analyst's notes |

### The structure

```
Audit_log
  - user         → who did it
  - client       → which company
  - action       → what happened (upload / normalize / flag / approve / reject)
  - entity_type  → which type of object was involved (e.g. "NormalizedRecord")
  - entity_id    → the UUID of that specific object, stored as a string
  - details      → a JSON field with extra context (row counts, filenames, notes)
  - timestamp    → auto-set when the row is created
```

### Why `entity_id` is a string and not a real foreign key

The audit log needs to reference objects from multiple different tables (`Ingestion`, `NormalizedRecord`, etc.). A proper polymorphic FK in Django (using `contenttypes`) adds a lot of complexity for a prototype. Storing the UUID as a string and combining it with `entity_type` achieves the same traceability — you can always look up the referenced object — without the overhead.

### Atomicity on review actions

When an analyst approves, rejects, or flags a record, the status update on `NormalizedRecord` and the `Audit_log` entry are written inside a `transaction.atomic()` block. If either fails, both are rolled back. This ensures the log always reflects what actually happened — you'll never have an approved record with no log entry, or a log entry pointing to a record that wasn't actually updated.

---

## The Tables in Detail

### `Client`

The top-level anchor for multi-tenancy. Every piece of data belongs to a client.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID (primary key) | Auto-generated |
| `name` | Text | The company's name |
| `created_at` | Datetime | Auto-set on creation |

---

### `User`

Extends Django's built-in user model. Two roles: `admin` and `auditor`. The link to `Client` is nullable so Django superusers (used for administration) can exist without being tied to a specific company.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID (primary key) | |
| `username` | Text (unique) | |
| `client` | Foreign key → Client | Nullable for superusers |
| `role` | Text | `admin` or `auditor` |

---

### `Ingestion`

One record per file upload. It's the "envelope" that wraps everything from a single upload event.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `client` | Foreign key → Client | |
| `uploaded_by` | Foreign key → User | |
| `source` | Text | `sap`, `utility`, or `navan` |
| `status` | Text | Moves through: `pending → processing → completed / failed` |
| `file` | File | Stored at `ingestion_files/` |
| `original_filename` | Text | The filename as the user uploaded it |
| `row_count` | Integer | Total rows in the file |
| `error_count` | Integer | Rows that failed normalization individually |
| `error_message` | Text | Only set if the entire batch failed (e.g. unreadable file) |
| `created_at` / `updated_at` | Datetime | |

**Why `error_count` is separate from `status`:** A batch can be `status = completed` and still have `error_count > 0`. This means most rows processed fine but a few failed individually. If I marked the whole batch `failed` just because a handful of rows were bad, the analyst would lose visibility into all the rows that succeeded. Keeping them separate lets analysts review what worked while investigating the failures.

**Database index on:** `(client, source, status)` — this matches the most common filter on the upload dashboard.

---

### `RawRecord`

Immutable. One record per row in the source file. Never changed after creation.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `ingestion` | Foreign key → Ingestion | Which upload batch this came from |
| `client` | Foreign key → Client | Denormalized for fast filtering |
| `source` | Text | `sap`, `utility`, or `navan` |
| `row_index` | Integer | Row's position in the file (0-based) |
| `raw_data` | JSON | The original key-value payload, unchanged |
| `created_at` | Datetime | |

**Database indexes on:** `(client, source)` and `(ingestion, row_index)`.

---

### `NormalizedRecord`

The cleaned, analyst-reviewable version of each row. All sources share the same table.

**Fields shared by all sources:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `client` | Foreign key → Client | |
| `raw_record` | OneToOne → RawRecord | The traceability link back to the original row |
| `source` | Text | `sap`, `utility`, or `navan` |
| `emission_scope` | Integer | 1, 2, or 3 — assigned by scope_classifier.py |
| `co2e_kg` | Decimal (12,4) | CO2 equivalent in kg. `0` if quantity unavailable |
| `transaction_id` | Text | Standardized ID — each source maps its own ID field to this |
| `transaction_date` | Date | |
| `vendor_name` | Text | |
| `category` | Text | |
| `amount` | Decimal (10,2) | Stored in minor units (e.g. cents) |
| `currency` | Text (3 chars) | ISO 4217 (e.g. `USD`, `GBP`) |
| `description` | Text | Human-readable summary of the transaction |
| `status` | Text | `pending → flagged / approved / rejected` |
| `review_notes` | Text | Analyst's comments |
| `reviewed_by` | Foreign key → User (nullable) | Set when an analyst takes action |
| `reviewed_at` | Datetime (nullable) | |
| `normalization_warnings` | JSON (list of strings) | Anything unusual that happened during normalization |

**SAP-specific fields** (empty for other sources): `sap_po_number`, `sap_cost_center`, `sap_gl_account`, `sap_company_code`, `sap_material_group`

**Utility-specific fields** (empty for other sources): `utility_account_number`, `utility_meter_id`, `utility_service_type`, `utility_usage_kwh`, `utility_billing_period_start`, `utility_billing_period_end`

**Navan-specific fields** (empty for other sources): `navan_trip_id`, `navan_traveler_name`, `navan_traveler_email`, `navan_travel_type`, `navan_departure_date`, `navan_return_date`, `navan_origin`, `navan_destination`, `navan_policy_compliant`, `navan_out_of_policy_reason`

**Why all three sources share one table:** A single table means the analyst review dashboard can load all records with one query and no joins. The downside is a wide table with many nullable columns, but at prototype scale (thousands to a few million rows) that's a fair trade. If the source schemas diverged significantly in production, splitting into per-source tables would make more sense.

**Database indexes on:** `(client, source, status)`, `(client, transaction_date)`, `(client, vendor_name)`.

---

### `Audit_log`

Append-only log of every meaningful action. Never updated or deleted.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | |
| `user` | Foreign key → User | Who did it |
| `client` | Foreign key → Client | Which company |
| `action` | Text | `upload`, `normalize`, `flag`, `approve`, or `reject` |
| `entity_type` | Text | Which model type (e.g. `"NormalizedRecord"`) |
| `entity_id` | Text | UUID of the specific object, stored as a string |
| `details` | JSON | Extra context: row counts, filenames, analyst notes |
| `timestamp` | Datetime | Auto-set on creation |

**Database indexes on:** `(client, timestamp)` and `(entity_type, entity_id)`.