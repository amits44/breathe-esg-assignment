"""
ingestion/scope_classifier.py

GHG Protocol Scope classification for the three data sources.

Scope 1 — Direct emissions (company owns/controls the source)
  - Diesel fuel, petrol, motor oil consumed in company vehicles or generators
  - Natural gas combustion on-site

Scope 2 — Indirect emissions from purchased energy
  - Electricity purchased from the grid
  - Steam/heat purchased from utilities

Scope 3 — All other indirect emissions (value chain)
  - Business travel (flights, hotels, car hire, rail)
  - Purchased goods and services (SAP procurement)
  - Water, waste, sewer (minor utilities)

Emission factors are simplified defaults (kgCO2e per unit).
Real projects use DEFRA, EPA eGRID, or IPCC AR6 factors.
"""

from decimal import Decimal


# Fuel: kgCO2e per litre (DEFRA 2023 approximations)
_FUEL_FACTORS_KG_PER_L = {
    "diesel":   Decimal("2.68"),
    "petrol":   Decimal("2.31"),
    "motor oil": Decimal("2.50"),
}

# Fuel: kgCO2e per gallon (US)
_FUEL_FACTORS_KG_PER_GAL = {
    "diesel":   Decimal("10.15"),
    "petrol":   Decimal("8.74"),
}

# Electricity: kgCO2e per kWh (UK grid average, DEFRA 2023)
_ELECTRICITY_KG_PER_KWH = Decimal("0.207")

# Travel: kgCO2e per passenger-km (DEFRA 2023)
_TRAVEL_FACTORS = {
    "flight":  Decimal("0.255"),   # economy short-haul average
    "hotel":   Decimal("0.0"),     # per night — needs separate factor, skip for now
    "car":     Decimal("0.171"),   # average car
    "rail":    Decimal("0.041"),   # national rail
}

# Average distances for flights without lat/lng (rough defaults)
_DEFAULT_FLIGHT_KM = Decimal("1500")   # short-haul default
_DEFAULT_CAR_KM    = Decimal("300")

_DIESEL_KG_PER_L   = Decimal("2.68")   # DEFRA 2023
_PETROL_KG_PER_L   = Decimal("2.31")   # DEFRA 2023
_MOTOROIL_KG_PER_L = Decimal("2.50")
_L_PER_GAL         = Decimal("3.78541")  # US gallon to litres

def _classify_sap(description: str, material_group: str, record=None) -> tuple[int, Decimal, list[str]]:
    desc_lower = (description or "").lower()
    warnings   = []

    # Detect fuel type
    if "diesel" in desc_lower:
        factor = _DIESEL_KG_PER_L
        fuel   = "diesel"
    elif "petrol" in desc_lower or "unleaded" in desc_lower:
        factor = _PETROL_KG_PER_L
        fuel   = "petrol"
    elif "motor oil" in desc_lower:
        factor = _MOTOROIL_KG_PER_L
        fuel   = "motor oil"
    else:
        warnings.append("Scope 3: purchased goods/services. No CO2e factor applied.")
        return 3, Decimal("0"), warnings

    # Try to get quantity and unit from temp attributes set by normalizer
    quantity_raw = getattr(record, '_quantity', '') or ''
    unit_raw     = (getattr(record, '_unit', '') or '').upper().strip()

    if quantity_raw:
        try:
            qty_litres = Decimal(str(quantity_raw).replace(',', ''))
            # Convert gallons to litres
            if unit_raw in ('GAL', 'GALLON', 'GALLONS'):
                qty_litres = qty_litres * _L_PER_GAL
                warnings.append(f"Converted {quantity_raw} GAL → {qty_litres:.2f} L for CO2e calculation.")
            co2e = qty_litres * factor
            warnings.append(
                f"Scope 1: {fuel} — {qty_litres:.2f} L × {factor} kgCO2e/L = {co2e:.2f} kgCO2e (DEFRA 2023)."
            )
            return 1, co2e.quantize(Decimal("0.0001")), warnings
        except Exception:
            pass

    warnings.append(f"Scope 1 {fuel} detected but quantity unavailable — CO2e set to 0.")
    return 1, Decimal("0"), warnings


def _classify_utility(service_type: str, usage_kwh) -> tuple[int, Decimal, list[str]]:
    """
    Utility bills:
      electricity / steam / heat → Scope 2
      gas (combustion on-site)   → Scope 1
      water / sewer / waste      → Scope 3
    Returns (scope, co2e_kg, warnings).
    """
    stype    = (service_type or "").lower()
    warnings = []

    if stype in ("electricity",):
        co2e = Decimal("0")
        if usage_kwh:
            co2e = Decimal(str(usage_kwh)) * _ELECTRICITY_KG_PER_KWH
            warnings.append(f"Scope 2: {usage_kwh} kWh × {_ELECTRICITY_KG_PER_KWH} kgCO2e/kWh = {co2e:.2f} kgCO2e")
        else:
            warnings.append("Scope 2: no kWh usage available — CO2e set to 0. Add usage_kwh for accurate calculation.")
        return 2, co2e, warnings

    elif stype in ("steam", "heat", "district heat"):
        warnings.append("Scope 2: purchased heat/steam. CO2e factor not applied — provider-specific factor needed.")
        return 2, Decimal("0"), warnings

    elif stype in ("gas", "natural gas"):
        warnings.append("Scope 1: natural gas combustion. CO2e factor not applied — volume in m³ or kWh needed.")
        return 1, Decimal("0"), warnings

    else:
        # water, sewer, waste
        warnings.append(f"Scope 3: {stype} utility. Minor emissions — no CO2e factor applied.")
        return 3, Decimal("0"), warnings


def _classify_navan(travel_type: str, origin: str, destination: str) -> tuple[int, Decimal, list[str]]:
    """
    All business travel → Scope 3, Category 6.
    Returns (scope, co2e_kg, warnings).
    """
    ttype    = (travel_type or "").lower()
    ttype = ttype.replace("train", "rail")
    warnings = []

    factor = _TRAVEL_FACTORS.get(ttype, Decimal("0"))

    if ttype == "flight":
        distance_km = _DEFAULT_FLIGHT_KM
        co2e = distance_km * factor
        warnings.append(
            f"Scope 3 Cat.6: flight {origin or '?'}→{destination or '?'}. "
            f"Estimated {distance_km} km × {factor} = {co2e:.1f} kgCO2e. "
            f"Use actual distance for accuracy."
        )
        return 3, co2e, warnings

    elif ttype == "car":
        distance_km = _DEFAULT_CAR_KM
        co2e = distance_km * factor
        warnings.append(
            f"Scope 3 Cat.6: car hire. Estimated {distance_km} km × {factor} = {co2e:.1f} kgCO2e."
        )
        return 3, co2e, warnings

    elif ttype == "rail":
        distance_km = _DEFAULT_FLIGHT_KM
        co2e = distance_km * factor
        warnings.append(
            f"Scope 3 Cat.6: rail. Estimated {distance_km} km × {factor} = {co2e:.1f} kgCO2e."
        )
        return 3, co2e, warnings

    elif ttype == "hotel":
        warnings.append("Scope 3 Cat.6: hotel stay. Per-night CO2e factor not applied — provider data needed.")
        return 3, Decimal("0"), warnings

    else:
        warnings.append(f"Scope 3 Cat.6: travel type '{ttype}' — no CO2e factor applied.")
        return 3, Decimal("0"), warnings


def classify_record(record) -> tuple[int, Decimal, list[str]]:
    """
    Main entry point. Takes a NormalizedRecord (unsaved is fine),
    returns (scope: int, co2e_kg: Decimal, new_warnings: list[str]).
    Call this after normalization, before bulk_create.
    """
    source = (record.source or "").lower()

    if source == "sap":
        return _classify_sap(record.description, record.sap_material_group,record)

    elif source == "utility":
        return _classify_utility(record.utility_service_type, record.utility_usage_kwh)

    elif source == "navan":
        return _classify_navan(record.navan_travel_type, record.navan_origin, record.navan_destination)

    else:
        return 0, Decimal("0"), [f"Unknown source '{source}' — scope not classified."]