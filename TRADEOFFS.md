# TRADEOFFS.md

---

## 1. Calculating real flight distances from airport codes

**What it would look like:**
When a travel record says a flight went from `BOM` (Mumbai) to `LHR` (London), the correct way to calculate emissions is to find the actual distance between those two airports, then multiply it by the right emission factor based on cabin class (economy vs. business) and whether it's a short-haul or long-haul flight.

**What I built instead:**
I used a flat default of 1,500 km for every flight. If a record uses this default, the system writes a visible warning saying "actual distance not calculated — used estimate." The analyst can see this clearly on the review dashboard.

**Why I skipped it:**
Doing this properly requires three things: a database of all ~7,000 IATA airport locations, a distance formula, and separate emission factors for short-haul vs. long-haul flights. That's a meaningful sub-project on its own.

**What I'd build next:**
A static CSV file mapping airport codes to coordinates, a simple distance calculation function, and a lookup table for short-haul vs. long-haul emission factors. No external API needed — fully offline.

---

## 2. Role-based permissions

**What it would look like:**
The system has two user roles — `admin` and `auditor`. In a real deployment, these should have different levels of access. For example: auditors can only review and approve records, while admins can upload files, manage users, and configure settings.

**What I built instead:**
Authentication is required for everything — no one can access any data without logging in, and every user only sees their own client's data. The role field exists in the database and shows up in the admin panel. But right now, both roles can do everything.

**Why I skipped it:**
The right way to build RBAC is to first agree on exactly what each role can and can't do. Can auditors upload files? Can admins see data across all clients? What happens when a user is removed mid-audit? The assignment didn't define these, and guessing wrong means building a permissions model that's painful to change later. The role field is already in the model, so adding the actual restrictions is straightforward once these questions are answered.

**What I'd build next:**
A permission class that checks `request.user.role` before allowing any action. Auditors get read + review. Admins get full access. Anything outside the role's scope returns a 403.

---

## 3. Re-processing a batch after a fix

**What it would look like:**
Say a normalization bug is found after data has already been ingested or DEFRA releases updated emission factors mid-year. There should be a way to re-run the processing on an existing batch and update the calculated values, while keeping a clear record of what changed.

**What I built instead:**
Ingestion is one-way. If you upload the same file again, you get a new batch with new records sitting alongside the old ones. There's no deduplication, no replacement, no diff.

**Why I skipped it:**
Re-processing raises product questions I couldn't answer without a PM. Should re-processing replace records that an analyst already approved, or only pending ones? Should old records be deleted or just archived? Should there be a "before vs. after" view showing what changed? These are real UX decisions, not just engineering ones. The good news is the raw uploaded data is always preserved, so the information needed to re-process is already there — the workflow just needs to be built.

**What I'd build next:**
A `POST /api/v1/batches/<id>/reprocess/` endpoint. It re-runs normalization on all raw records in the batch, archives the old calculated records (soft delete), creates new ones, and logs exactly what changed and when.

---

## 4. Duplicate record detection across uploads

**What it would look like:**
If the same data file is uploaded twice or two files from different sources contain overlapping records (e.g. the same electricity invoice appearing in two different exports) the system should detect this and either block the duplicate or flag it for review.

**What I built instead:**
Each upload creates a new batch and new records unconditionally. There is no check for whether a record already exists. Uploading the same file twice silently doubles all the numbers, which would be a serious problem in an actual emissions report.

**Why I skipped it:**
Deduplication logic depends on what counts as "the same record" for each source — and the answer is different per source. For utility data, the invoice number is the right key. For SAP, it's the PO number plus line item. For travel, it's the trip ID. Getting this wrong (e.g. incorrectly flagging two different invoices as duplicates) is worse than not having it. This also intersects with the re-processing question — if re-ingestion is intentional, the system needs to distinguish "this is a duplicate by mistake" from "this is a deliberate re-upload to replace old data."

**What I'd build next:**
A per-source deduplication key (invoice number for utilities, `EBELN+EBELP` for SAP, trip ID for Navan). At ingestion time, check if a record with that key already exists for the same client. If yes, block it and surface a clear warning: "This record already exists in batch #X. Did you mean to re-upload?"