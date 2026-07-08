#!/usr/bin/env python3
"""Calculate a synthetic regulated rent from amortizable assets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "synthetic"


def load_json(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def is_active(asset: dict, year: int) -> bool:
    age = year - int(asset["ano_inicio"])
    return 0 <= age < int(asset["vida_util"])


def annual_amortization(asset: dict, year: int) -> float:
    if not is_active(asset, year):
        return 0.0
    return float(asset["importe"]) / float(asset["vida_util"])


def calculate(vivienda_id: str, year: int, rate: float) -> dict:
    viviendas = {item["id"]: item for item in load_json("viviendas.json")}
    assets = [
        item for item in load_json("activos_amortizables.json")
        if item["vivienda_id"] == vivienda_id
    ]

    if vivienda_id not in viviendas:
        raise SystemExit(f"Vivienda no encontrada: {vivienda_id}")

    active_assets = [asset for asset in assets if is_active(asset, year)]
    expired_assets = [asset for asset in assets if not is_active(asset, year)]
    annual_base = sum(annual_amortization(asset, year) for asset in assets)
    annual_return = annual_base * (rate / 100)
    annual_rent = annual_base + annual_return

    return {
        "vivienda_id": vivienda_id,
        "codigo_publico": viviendas[vivienda_id]["codigo_publico"],
        "ano_calculo": year,
        "rentabilidad": rate,
        "amortizacion_anual_activa": round(annual_base, 2),
        "rentabilidad_anual": round(annual_return, 2),
        "renta_anual": round(annual_rent, 2),
        "renta_mensual": round(annual_rent / 12, 2),
        "activos_activos": len(active_assets),
        "activos_agotados": len(expired_assets),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vivienda", default="viv-001")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--rate", type=float, default=8.0)
    args = parser.parse_args()

    print(json.dumps(calculate(args.vivienda, args.year, args.rate), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

