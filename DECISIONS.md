# DECISIONS.md

---

## SAP: Which export format did I use?

**Options I looked at:** IDoc (XML), BAPI (function call), OData service, plain CSV file.

**What I chose:** A flat CSV file export from SAP — specifically the EKKO table (purchase order headers) joined with EKPO (purchase order line items).

**Why I chose this:**

When a sustainability analyst at a real company asks the SAP team for procurement data, what they actually get is a CSV file. The other options sound more technical:
- **IDoc** needs the SAP infrastructure team to configure a special outbound port. The sustainability team can't do this themselves.
- **BAPI / OData** need server credentials and network access that the sustainability team doesn't control.

The flat file is realistically. It's also why the assignment specifically mentions "German column headers" those come from SAP's built-in export screens (SE16, ME2M), which is exactly how people export data in practice.

**What I included:**
- From EKKO: PO number (`EBELN`), company code (`BUKRS`), vendor number (`LIFNR`), document date (`AEDAT`)
- From EKPO: line item number (`EBELP`), description (`TXZ01`), plant (`WERKS`), quantity (`MENGE`), unit (`MEINS`), net value (`NETWR`)
- The two tables are joined using the PO number (`EBELN`)

**What I skipped and why:**
- **Material master (MARA/MARC):** This is a separate reference table. It would need a third file upload just to look up material details.
- **GL account codes:** These aren't included in a standard ME2M export, so I can't reliably map them.
- **Currency conversion:** I assumed USD for now and added a warning when the currency field is unclear.
- **Multiple company codes:** I handled one company code at a time. Consolidating across entities is a separate problem.

**Questions I would ask the PM:**
- Will the client always send EKKO and EKPO as two separate files, or can they export a joined view?
- Is the vendor number (`LIFNR`) enough to identify suppliers, or do we need a vendor name file too?
- Are all quantities in metric units, or do some plants use imperial?

---

## Utility Bills: How did I ingest them?

**Options I looked at:** Parsing PDF bills, CSV export from the utility's web portal, utility API.

**What I chose:** CSV export from the utility portal.

**Why I chose this:**

This is how a real facilities manager actually gets their data. They log into their electricity provider's website, select a date range, click "Export to CSV", and send that file.

The other options have real problems:
- **PDF parsing** is extremely fragile. Every utility formats their bills differently, and building a PDF reader that handles dozens of layouts is a full project by itself.
- **Utility APIs** (like Green Button) only exist for some US utilities. Each one requires a separate OAuth setup per provider, per client.

One challenge: different utility providers use different column names for the same data. I solved this with an alias map that recognises about 10 common variations for each field (e.g. "kWh Used", "Usage (kWh)", "Consumption" all map to the same field). This means the system works with PG&E, ConEd, and LADWP exports without any code changes.

**What I included:**
Account number, meter ID, service type, billing period start/end, invoice date, invoice number, provider name, energy usage in kWh, billed amount, and currency.

**What I skipped and why:**
- **Tiered pricing / rate tiers:** I capture the total billed amount, not the breakdown by rate tier, because that detail isn't needed for carbon calculation.
- **Multi-meter rollups:** Each meter row is treated as its own record. Grouping across meters is a reporting concern.
- **PDF bills:** too much complexity for too little reliability.

**Questions I would ask the PM:**
- Do clients typically have one utility provider or many? More providers means the alias map needs to cover more column name variants.
- Do we need the grid region for location-based Scope 2 accounting, or is market-based accounting enough for now?

---

## Navan (Travel Data): How did I ingest it?

**Options I looked at:** Navan REST API, CSV export from the Navan portal, JSON file upload.

**What I chose:** JSON file upload, designed to match the shape of Navan's actual API response.

**Why I chose this:**

Navan does have a real API. But connecting to it requires OAuth credentials, which requires Navan admin access at the client's company. Setting that up for every new client is an integration project, not a 4-day prototype feature.

In practice, the client's travel admin either exports the bookings from the Navan portal, or a developer runs a quick script against the API and saves the output as a JSON file. Either way, a file ends up on the analyst's desk. By accepting JSON that matches Navan's API response format, my system works for both cases manual export or automated pull.

I also made the parser handle three different shapes Navan returns data in: a plain list, a `{"bookings": [...]}` wrapper, and a `{"data": [...]}` wrapper. These cover the formats I found when reading Navan's documentation.

**What I included:**
Trip ID, travel type (flight / car / hotel / rail), traveler name and email, booking date, travel dates, origin/destination, vendor, amount, currency, and whether the booking was policy-compliant.

**What I skipped and why:**
- **Real flight distances:** Calculating exact distance from airport codes requires either an IATA route database or a great circle formula plus timezone logic. I defaulted to 1,500 km per flight and flagged this clearly. It's an overestimate for short-haul and underestimate for long-haul.
- **Multi-leg trip breakdowns:** A London → Dubai → Singapore trip is treated as one record. Per-leg breakdown would require restructuring the data model.
- **Hotel emission factors by brand/location:** Different hotel chains have very different per-night carbon figures. I used a flat default. Accurate hotel emissions would need a separate reference dataset (e.g. HCMI data).
- **Carbon offsets in Navan:** Navan lets companies purchase offsets through the platform. I didn't capture these — they'd need to be handled as a separate offset credit, not mixed into the activity data.

**Questions I would ask the PM:**
- Can the client set up a recurring automated export (or webhook), or will this always be a manual upload?
- Are hotel stays a big slice of this client's emissions? If yes, we need per-property factors the default will be too inaccurate.
- Do we need to track cost center or department per traveler for internal carbon allocation?

---

## Review Workflow: Why these statuses?

**Statuses I used:** `flagged` → `approved` (or `rejected`)

**Why `flagged` exists:**

In a real audit workflow,not being sure is a valid state. An analyst might notice that a flight booking looks unusually high in emissions, but they need to check with the traveler before they can approve or reject it. `flagged` lets them mark it for follow-up without making a final call. The `review_notes` field stores whatever they wrote so context isn't lost.

Without `flagged`, analysts would either approve uncertain records (bad for audit quality) or reject them (losing valid data). A three-state system is closer to how real review workflows actually operate.

**Why `reviewed_by` can be empty (`null`):**

A record starts with no reviewer. The field only gets filled in once someone takes an action. If a reviewer's account is deleted later, I used `SET_NULL` instead of cascading the delete — this means the audit trail stays intact even if the user no longer exists.

---

## CO2e Calculation: Calculated Once at Upload, Not Every Time You View

**What I decided:** Calculate `co2e_kg` once when the record is ingested, and store it in the database.

**Why not calculate it on-the-fly when loading the dashboard?**

Two reasons:
1. **Performance:** Running emission factor lookups on every dashboard load, for every row, would be slow.
2. **Audit integrity:** The number an analyst approved should be the same number that went to the auditor. If I recalculated on read and an emission factor changed in between, the analyst would have approved a different number than what's now showing. That's a problem in an audit context.

**The trade-off I accepted:**

If DEFRA (or another emissions factor source) updates their factors mid-year, existing records won't automatically reflect the new factors. That's intentional — historical records should be stable. To update them, you'd re-ingest the data with the new factors. This is the right behaviour for an audit trail.

---

## Multi-Tenancy: How I Kept Clients' Data Separate

**What I decided:** Add a `client` field (foreign key) to every data model, and enforce it in the API layer using a mixin called `ClientScopedMixin`.

**Why not use Postgres Row-Level Security (RLS)?**

RLS at the database level is theoretically more airtight, but it's harder to set up with Django. It requires switching database roles per request or using session variables, which doesn't play well with Django's shared connection pool. The FK + API layer approach is simpler, easier to read and audit in the code, and is completely sufficient for a prototype. If this were going to production with many clients and a larger team, I would add a custom queryset manager as an additional safety net.

---

## Authentication: Token-Based, Not Session-Based

**What I decided:** Use token authentication as the primary method, with session authentication as a fallback for the Django admin panel.

**Why tokens?**

The frontend is a React app — a separate process from the Django backend. Session cookies don't work cleanly across origins. Tokens are stateless: the React app sends a token in the header with each request, and the backend validates it. Simple and standard.

Session auth is kept only for the Django admin UI, which runs on the same origin and benefits from browser session handling.
