#!/usr/bin/env python3
"""Calculate a synthetic regulated rent from amortizable assets."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "synthetic"
IPC_FILE = ROOT / "data" / "ipc_espana_anual.csv"
HOUSING_CATEGORY = "vivienda"
HOUSING_RESIDUAL_RATE = 0.15


def load_json(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def load_ipc_series() -> dict[int, float]:
    with IPC_FILE.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return {
            int(row["ano"]): float(row["ipc_anual_pct"])
            for row in reader
            if row.get("ano") and row.get("ipc_anual_pct")
        }


def is_active(asset: dict, year: int) -> bool:
    age = year - int(asset["ano_inicio"])
    return 0 <= age < int(asset["vida_util"])


def is_housing(asset: dict) -> bool:
    return str(asset["categoria"]).lower() == HOUSING_CATEGORY


def inflation_factor(start_year: int, year: int, ipc_series: dict[int, float]) -> float:
    if not ipc_series or year <= start_year:
        return 1.0

    last_available_year = min(year, max(ipc_series))
    factor = 1.0
    for item_year in range(start_year + 1, last_available_year + 1):
        rate = ipc_series.get(item_year)
        if rate is not None:
            factor *= 1 + (rate / 100)

    return factor


def adjusted_amount(asset: dict, year: int, ipc_series: dict[int, float]) -> float:
    amount = float(asset["importe"])
    if not is_housing(asset):
        return amount
    return amount * inflation_factor(int(asset["ano_inicio"]), year, ipc_series)


def residual_value(asset: dict, year: int, ipc_series: dict[int, float]) -> float:
    if not is_housing(asset):
        return 0.0
    return adjusted_amount(asset, year, ipc_series) * HOUSING_RESIDUAL_RATE


def annual_amortization(asset: dict, year: int, ipc_series: dict[int, float]) -> float:
    if not is_active(asset, year):
        return 0.0

    amount = adjusted_amount(asset, year, ipc_series)
    if is_housing(asset):
        amount *= 1 - HOUSING_RESIDUAL_RATE

    return amount / float(asset["vida_util"])


def calculate(vivienda_id: str, year: int, rate: float) -> dict:
    viviendas = {item["id"]: item for item in load_json("viviendas.json")}
    assets = [
        item for item in load_json("activos_amortizables.json")
        if item["vivienda_id"] == vivienda_id
    ]
    ipc_series = load_ipc_series()

    if vivienda_id not in viviendas:
        raise SystemExit(f"Vivienda no encontrada: {vivienda_id}")

    active_assets = [asset for asset in assets if is_active(asset, year)]
    expired_assets = [asset for asset in assets if not is_active(asset, year)]
    annual_base = sum(annual_amortization(asset, year, ipc_series) for asset in assets)
    annual_return = annual_base * (rate / 100)
    annual_rent = annual_base + annual_return
    housing_adjusted = sum(
        adjusted_amount(asset, year, ipc_series)
        for asset in assets
        if is_housing(asset)
    )
    housing_residual = sum(
        residual_value(asset, year, ipc_series)
        for asset in assets
    )
    ipc_years = sorted(ipc_series)

    return {
        "vivienda_id": vivienda_id,
        "codigo_publico": viviendas[vivienda_id]["codigo_publico"],
        "ano_calculo": year,
        "rentabilidad": rate,
        "ipc_serie_desde": ipc_years[0],
        "ipc_serie_hasta": ipc_years[-1],
        "amortizacion_anual_activa": round(annual_base, 2),
        "rentabilidad_anual": round(annual_return, 2),
        "renta_anual": round(annual_rent, 2),
        "renta_mensual": round(annual_rent / 12, 2),
        "valor_vivienda_actualizado_ipc": round(housing_adjusted, 2),
        "valor_residual_vivienda": round(housing_residual, 2),
        "activos_activos": len(active_assets),
        "activos_agotados": len(expired_assets),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vivienda", default="viv-001")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--rate", type=float, default=8.0)
    args = parser.parse_args()

    print(json.dumps(
        calculate(args.vivienda, args.year, args.rate),
        indent=2,
        ensure_ascii=False,
    ))


if __name__ == "__main__":
    main()
