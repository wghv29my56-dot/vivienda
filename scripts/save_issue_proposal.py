#!/usr/bin/env python3
import csv
import json
import os
import re
from pathlib import Path


MARKER = "vivienda-thinktank-propuesta:v1"
CSV_CONFIG = {
    "desarrollo_urbano": {
        "path": Path("data/propuestas_zonas.csv"),
        "headers": [
            "id",
            "nombre_zona",
            "provincia",
            "municipio",
            "viviendas_estimadas",
            "justificacion",
            "contacto",
            "fecha",
            "aprobado",
            "coordenadas",
        ],
        "numeric_field": "viviendas_estimadas",
    },
    "fiscalidad_mejorada": {
        "path": Path("data/propuestas_fiscalidad.csv"),
        "headers": [
            "id",
            "nombre_zona",
            "provincia",
            "municipio",
            "poblacion",
            "justificacion",
            "contacto",
            "fecha",
            "aprobado",
            "coordenadas",
        ],
        "numeric_field": "poblacion",
    },
}


def main():
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if not event_path:
        raise SystemExit("GITHUB_EVENT_PATH no disponible")

    event = json.loads(Path(event_path).read_text(encoding="utf-8"))
    issue = event.get("issue") or {}
    body = issue.get("body") or ""

    if MARKER not in body:
        print("Issue sin marcador de propuesta. No se hace nada.")
        return

    payload = extract_payload(body)
    proposal_type = (payload.get("tipo") or "").strip()
    if proposal_type not in CSV_CONFIG:
        raise SystemExit(f"Tipo de propuesta no soportado: {proposal_type!r}")

    config = CSV_CONFIG[proposal_type]
    row = build_row(payload, issue, config)
    append_if_missing(config["path"], config["headers"], row)


def extract_payload(body):
    match = re.search(r"```json\s*(\{.*?\})\s*```", body, flags=re.S)
    if not match:
        raise SystemExit("No se encontró bloque JSON en el issue")
    return json.loads(match.group(1))


def build_row(payload, issue, config):
    issue_number = issue.get("number")
    row = {
        "id": f"gh-{issue_number}",
        "nombre_zona": clean(payload.get("nombre_zona")),
        "provincia": clean(payload.get("provincia")),
        "municipio": clean(payload.get("municipio")),
        config["numeric_field"]: clean(payload.get(config["numeric_field"])),
        "justificacion": clean(payload.get("justificacion")),
        "contacto": clean(payload.get("contacto")),
        "fecha": clean(payload.get("fecha") or issue.get("created_at")),
        "aprobado": clean(payload.get("aprobado")),
        "coordenadas": format_coords(payload.get("coordenadas")),
    }
    return row


def clean(value):
    return str(value or "").replace("\r", " ").replace("\n", " ").strip()


def format_coords(value):
    if not value:
        return ""
    if isinstance(value, str):
        return clean(value)
    if isinstance(value, list):
        pairs = []
        for point in value:
            if not isinstance(point, list) or len(point) < 2:
                continue
            try:
                lat = float(point[0])
                lng = float(point[1])
            except (TypeError, ValueError):
                continue
            pairs.append(f"{lat:.6f},{lng:.6f}")
        return "|".join(pairs)
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def append_if_missing(path, headers, row):
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    if path.exists():
        with path.open(newline="", encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))

    if any(existing.get("id") == row["id"] for existing in rows):
        print(f"La propuesta {row['id']} ya existe en {path}.")
        return

    rows.append(row)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Propuesta {row['id']} guardada en {path}.")


if __name__ == "__main__":
    main()
