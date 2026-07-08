#!/usr/bin/env python3
"""Run lightweight integrity checks over the synthetic dataset."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "synthetic"


def load_json(name: str):
    path = DATA_DIR / name
    return json.loads(path.read_text(encoding="utf-8"))


def require_unique(items: list[dict], entity: str) -> None:
    seen: set[str] = set()
    for item in items:
        item_id = item.get("id")
        if not item_id:
            raise AssertionError(f"{entity} sin id")
        if item_id in seen:
            raise AssertionError(f"{entity} duplicado: {item_id}")
        seen.add(item_id)


def main() -> None:
    barrios = load_json("barrios.json")
    viviendas = load_json("viviendas.json")
    activos = load_json("activos_amortizables.json")
    escenarios = load_json("escenarios_regulatorios.json")
    zonas = load_json("zonas_suelo.json")

    for name, items in [
        ("barrio", barrios),
        ("vivienda", viviendas),
        ("activo", activos),
        ("escenario", escenarios),
        ("zona_suelo", zonas),
    ]:
        require_unique(items, name)

    barrio_ids = {item["id"] for item in barrios}
    vivienda_ids = {item["id"] for item in viviendas}

    for vivienda in viviendas:
        if vivienda["barrio_id"] not in barrio_ids:
            raise AssertionError(f"Vivienda con barrio inexistente: {vivienda['id']}")

    for activo in activos:
        if activo["vivienda_id"] not in vivienda_ids:
            raise AssertionError(f"Activo con vivienda inexistente: {activo['id']}")
        if activo["importe"] < 0 or activo["vida_util"] <= 0:
            raise AssertionError(f"Activo invalido: {activo['id']}")

    for zona in zonas:
        if zona["barrio_id"] not in barrio_ids:
            raise AssertionError(f"Zona de suelo con barrio inexistente: {zona['id']}")

    print("Synthetic data OK")


if __name__ == "__main__":
    main()

