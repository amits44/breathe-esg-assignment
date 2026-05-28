from datetime import datetime, date
from typing import Iterator
from decimal import Decimal

from ingestion.models import RawRecord, NormalizedRecord


def _parse_date(raw: str | None) -> date | None:
    if not raw:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw[:19], fmt[:len(raw[:19])]).date()
        except (ValueError, TypeError):
            continue
    return None


def normalize_navan_record(raw: RawRecord) -> NormalizedRecord:
    data = raw.raw_data
    warnings = []

    trip_id = data.get("id", "").strip()
    travel_type = data.get("type", "").lower()

    traveler = data.get("traveler", {})
    traveler_name = traveler.get("name", "Unknown Traveler")
    traveler_email = traveler.get("email", "")

    booking_date = _parse_date(data.get("booking_date"))
    travel_dates = data.get("travel_dates", {})
    departure_date = _parse_date(travel_dates.get("departure"))
    return_date = _parse_date(travel_dates.get("return"))

    transaction_date = booking_date or departure_date

    amount_data = data.get("amount", {})
    try:
        total = float(amount_data.get("total", 0))
        amount = int(total * 100)
    except (TypeError, ValueError):
        amount = 0
        warnings.append(f"Could not parse amount: {amount_data}")

    currency = (amount_data.get("currency") or "USD").upper()

    vendor = data.get("vendor", "").strip()
    if not vendor:
        vendor = f"Navan {travel_type.title()}"
        warnings.append("vendor missing, using type as fallback")

    policy = data.get("policy", {})
    is_compliant = policy.get("compliant")
    out_of_policy = policy.get("out_of_policy_reason") or ""

    if is_compliant is False and not out_of_policy:
        warnings.append("Out-of-policy booking with no reason provided")

    status = data.get("status", "").lower()
    if status == "cancelled":
        warnings.append("Booking is cancelled — verify if charge was reversed")

    description_parts = [
        travel_type.title(),
        data.get("purpose", ""),
    ]
    description = " — ".join(p for p in description_parts if p)

    return NormalizedRecord(
        client=raw.client,
        raw_record=raw,
        source=raw.source,
        transaction_id=trip_id,
        transaction_date=transaction_date,
        vendor_name=vendor,
        category="Travel",
        amount=Decimal(amount),
        currency=currency,
        description=description,
        navan_trip_id=trip_id,
        navan_traveler_name=traveler_name,
        navan_traveler_email=traveler_email,
        navan_travel_type=travel_type,
        navan_departure_date=departure_date,
        navan_return_date=return_date,
        navan_origin=data.get("origin", "").strip(),
        navan_destination=data.get("destination", "").strip(),
        navan_policy_compliant=is_compliant,
        navan_out_of_policy_reason=out_of_policy,
        normalization_warnings=warnings,
    )


def parse_navan_response(api_response: dict) -> Iterator[dict]:
    if isinstance(api_response, list):
        yield from api_response
    elif "bookings" in api_response:
        yield from api_response["bookings"]
    elif "data" in api_response:
        yield from api_response["data"]
    elif "id" in api_response:
        yield api_response
    else:
        raise ValueError(f"Unrecognized Navan API response shape: {list(api_response.keys())}")