#!/usr/bin/env python3
"""Export sample calculation results to CSV using the synthetic data."""

from __future__ import annotations

import csv
from pathlib import Path

from calculate_rent import DATA_DIR, calculate, load_json


OUTPUT = DATA_DIR / "resultados_calculo.csv"


def main() -> None:
    viviendas = load_json("viviendas.json")
    rows = [calculate(item["id"], 2026, 8.0) for item in viviendas]

    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f"Exported {OUTPUT}")


if __name__ == "__main__":
    main()

