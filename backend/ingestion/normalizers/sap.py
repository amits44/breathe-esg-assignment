import io
import csv
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Iterator
from ingestion.models import NormalizedRecord, RawRecord

EKKO_FIELDS = {"MANDT", "EBELN", "BUKRS", "LIFNR", "AEDAT"}
EKPO_FIELDS = {"MANDT", "EBELN", "EBELP", "MATNR", "TXZ01", "WERKS", "MENGE", "MEINS", "NETWR"}


def _parse_sap_date(raw: str) -> date | None:
    raw = raw.strip()
    for fmt in ("%Y%m%d", "%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _read_csv(file_content: bytes) -> tuple[list[str], list[dict]]:
    text = file_content.decode("utf-8-sig", errors="replace")
    lines = text.strip().splitlines()

    header_idx = 0
    for i, line in enumerate(lines):
        upper = line.upper()
        if "EBELN" in upper:
            header_idx = i
            break

    sample = lines[header_idx]
    delimiter = "\t" if "\t" in sample else "," if "," in sample else ";"

    reader = csv.DictReader(lines[header_idx:], delimiter=delimiter)
    rows = []
    for row in reader:
        if not any(v.strip() for v in row.values()):
            continue
        if list(row.values())[0].startswith("*"):
            continue
        rows.append({k.strip(): v.strip() for k, v in row.items()})

    headers = [h.strip() for h in (reader.fieldnames or [])]
    return headers, rows


def _is_joined(headers: list[str]) -> bool:
    upper = {h.upper() for h in headers}
    has_ekko = bool(upper & {"BUKRS", "LIFNR", "AEDAT"})
    has_ekpo = bool(upper & {"EBELP", "TXZ01", "MENGE"})
    return has_ekko and has_ekpo


def _join_ekko_ekpo(ekko_rows: list[dict], ekpo_rows: list[dict]) -> list[dict]:
    ekko_index = {row["EBELN"]: row for row in ekko_rows}

    joined = []
    for ekpo_row in ekpo_rows:
        ebeln = ekpo_row.get("EBELN", "")
        ekko_row = ekko_index.get(ebeln, {})

        if not ekko_row:
            ekpo_row["_missing_header"] = True

        merged = {**ekko_row, **ekpo_row}
        joined.append(merged)

    return joined


def parse_sap_csv(file_content: bytes, ekpo_content: bytes | None = None) -> Iterator[dict]:
    headers, rows = _read_csv(file_content)

    if ekpo_content is not None:
        _, ekpo_rows = _read_csv(ekpo_content)
        yield from _join_ekko_ekpo(rows, ekpo_rows)

    elif _is_joined(headers):
        yield from rows

    else:
        has_ekko = bool({h.upper() for h in headers} & {"BUKRS", "LIFNR", "AEDAT"})
        missing = "EKPO" if has_ekko else "EKKO"
        raise ValueError(
            f"SAP file appears to contain only one table. "
            f"Please also upload the {missing} export, or provide a joined view."
        )


def normalize_sap_record(raw: RawRecord) -> NormalizedRecord:
    data = raw.raw_data
    warnings = []

    po_number = data.get("EBELN", "").strip()
    line_item = data.get("EBELP", "").strip()
    transaction_id = f"{po_number}-{line_item}" if line_item else po_number

    raw_date = data.get("AEDAT", "")
    transaction_date = _parse_sap_date(raw_date)
    if raw_date and not transaction_date:
        warnings.append(f"Unrecognized date format: '{raw_date}'")

    vendor_number = data.get("LIFNR", "").strip()
    vendor_name = vendor_number or "Unknown Vendor"
    if not vendor_number:
        warnings.append("LIFNR missing, vendor unknown")

    if data.get("_missing_header"):
        warnings.append(f"PO {po_number} had no matching EKKO header row")

    raw_amount = data.get("NETWR", "").strip()
    if raw_amount:
        try:
            cleaned = raw_amount.replace("\xa0", "").replace(" ", "")
            if "," in cleaned and "." in cleaned:
                if cleaned.index(".") < cleaned.index(","):
                    cleaned = cleaned.replace(".", "").replace(",", ".")
                else:
                    cleaned = cleaned.replace(",", "")
            elif "," in cleaned:
                cleaned = cleaned.replace(",", ".")
            amount = int(Decimal(cleaned) * 100)
        except Exception:
            amount = 0
            warnings.append(f"Could not parse NETWR '{raw_amount}', defaulting to 0")
    else:
        amount = 0
        warnings.append("NETWR missing on this line item")

    description = data.get("TXZ01", "").strip()
    plant = data.get("WERKS", "").strip()
    quantity = data.get("MENGE", "").strip()
    unit = data.get("MEINS", "").strip()

    norm = NormalizedRecord(
        client=raw.client,
        raw_record=raw,
        source=raw.source,
        transaction_id=transaction_id,
        transaction_date=transaction_date,
        vendor_name=vendor_name,
        category="Procurement",
        amount=Decimal(amount),
        currency="USD",
        description=f"{description} | Plant: {plant} | Qty: {quantity} {unit}".strip(" |"),
        sap_po_number=po_number,
        sap_company_code=data.get("BUKRS", "").strip(),
        normalization_warnings=warnings,
    )
    norm._quantity = quantity
    norm._unit = unit
    norm._description_raw = description

    return norm