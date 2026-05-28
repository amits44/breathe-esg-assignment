# SOURCES.md — Data Sources & How I Built the Pipeline

## 1. SAP Procurement (EKKO & EKPO Tables)

SAP is enterprise software used by large companies to manage purchases. When a company buys something, SAP records it across two tables:
- **EKKO** — the purchase order header (who bought from whom, on what date)
- **EKPO** — the line items (what exactly was bought, how much, at what cost)

### What the Real Data Looks Like
SAP exports are messy by design. The column names are in German technical shorthand — for example, `LIFNR` means Vendor, `EBELN` means Purchase Order Number, `BUKRS` means Company Code. The files also often have junk rows at the top (timestamps, dividers) before the actual data starts.

To make the sample data realistic, I:
- Used the actual SAP field names (`LIFNR`, `EBELN`, `TXZ01`, etc.) instead of clean English labels
- Mixed two date formats in the same column (`20230415` and `15.04.2023`) to test that the parser handles both
- Added a row with a missing price field to test that the system doesn't crash on incomplete data
- Added a diesel purchase line to test whether the system correctly classifies it as a direct emission (Scope 1)

### Sources
- https://leanx.eu/sap/table/ekko/
- https://leanx.eu/sap/table/ekpo/

### Known Limitations
- SAP stores vendor numbers, not vendor names. A real system would need a separate lookup table (`LFA1`) to show readable supplier names. This prototype flags those as "Unresolved Supplier."
- Real SAP data can have mixed currencies per company. This prototype assumes USD throughout.

---

## 2. Utility Bills (Electricity, Gas, Water)

Utility providers give businesses monthly bills. For carbon accounting, we need the consumption amount and the billing date.

### The Problem with Utility Data
Every utility provider formats their CSV differently. One might call a column "Usage (kWh)", another calls it "Consumption", another calls it "Net Volume" — but they all mean the same thing. There's no standard.

To handle this, I built an aliasing system — a dictionary that maps all known variations of a column name down to one internal name the system understands.

To make the sample data realistic, I:
- Used two different providers with completely different column names to test the aliasing logic
- Included electricity (Scope 2), natural gas (Scope 1), and water (Scope 3) rows to test all three emission categories
- Added a row with a blank consumption value to test that the system handles missing data gracefully

### Sources
- https://www.energycap.com/ebooks/utility-bill-data-and-processing/
- https://support.measurabl.com/hc/en-us/articles/17557177094541

### Known Limitations
- The system uses a single national average emission factor for electricity. A real system would use region-specific factors (e.g., different states or countries have different grid emissions).
- Many real utility bills come as PDFs, not CSVs. This prototype only handles CSV uploads.

---

## 3. Navan (Corporate Travel)

Navan is a corporate travel booking platform. Companies use it to book flights, hotels, and car rentals for employees. It provides a JSON API with structured booking data.

### What the Data Looks Like
The JSON from Navan contains bookings with fields like travel type (flight, hotel, car), traveler name, dates, cost, and booking status. Flights use IATA airport codes (e.g., `BOM` for Mumbai, `LHR` for London) but don't include the actual flight distance.

To make the sample data realistic, I:
- Included all three travel types (flights, hotels, car rentals) to test each normalization path
- Added an out-of-policy booking to test that the system captures the reason string
- Added a cancelled booking to test that the system excludes it from emission totals

### Sources
- https://app.navan.com/app/helpcenter/articles/travel/admin/other-integrations/navan-tmc-api-integration-documentation

### Known Limitations
- Flight distance is estimated using a flat 1,500 km default per leg since calculating real geodesic distances between all airport pairs would require a heavy lookup library. The system flags these records as estimated.
- If a flight has connecting stops, the data often only shows origin and final destination, so the intermediate leg distance is missed.