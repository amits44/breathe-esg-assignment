# BreatheESG — Emissions Data Ingestion Prototype

A Django + React app that ingests procurement, utility, and travel data, normalises it into CO2e figures, and lets analysts review and approve records before they go to auditors.

---

## Live App

**URL:** https://breathe-esg-assignment-j2v5.onrender.com/

---

## Sample Data

All sample files are in the `data/` folder at the root of the repo. Upload them through the app's file upload screen to see the full pipeline in action.

| File | Source | What it tests |
|------|--------|---------------|
| `data/sap_ekko.csv` | SAP purchase order headers | German column names, mixed date formats |
| `data/sap_ekpo.csv` | SAP purchase order line items | Missing price fields, Scope 1 diesel row |
| `data/utility_bills.csv` | Utility portal CSV export | Two providers with different column names, Scope 1/2/3 rows |
| `data/navan_bookings.json` | Navan travel export | Flights, hotels, car rentals; IATA airport codes |

### How to use them

1. Log in to the app
2. Go to **Upload** and select the source type (SAP / Utility / Travel)
3. Upload the matching file from the `data/` folder
4. Go to **Review Dashboard** to see the normalised records and approve or flag them

> The SAP source expects two files — upload `sap_ekko.csv` and `sap_ekpo.csv` separately. The app joins them on the PO number.

---
