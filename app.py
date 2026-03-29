from __future__ import annotations

import os
import re
import unicodedata
from typing import Any

import psycopg
from psycopg.rows import dict_row
from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("La variable d'environnement DATABASE_URL est obligatoire.")


def get_db_connection() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "sn": row["sn"],
        "sujet": row["sujet"],
        "mots_cles": row["mots_cles"],
        "description": row["description"],
        "source": row["source"],
        "plantes": row["plantes"],
        "icone": row["icone"],
        "masquer_icone": row["masquer_icone"],
    }


SEARCH_FIELDS = [
    "sn",
    "sujet",
    "mots_cles",
    "description",
    "source",
    "plantes",
]


def normalize_text(value: str | None) -> str:
    if value is None:
        return ""

    value = str(value).strip().lower()

    value = unicodedata.normalize("NFD", value)
    value = "".join(char for char in value if unicodedata.category(char) != "Mn")

    return value


def tokenize_query(query: str) -> list[str]:
    normalized = normalize_text(query)
    tokens = re.split(r"\s+", normalized)
    return [token for token in tokens if token]


def build_searchable_text(row: dict[str, Any]) -> str:
    parts = []

    for field in SEARCH_FIELDS:
        parts.append(normalize_text(row.get(field)))

    return " ".join(parts)


def matches_tokens(row: dict[str, Any], tokens: list[str]) -> bool:
    searchable_text = build_searchable_text(row)
    return all(token in searchable_text for token in tokens)


def validate_payload(data: dict[str, Any], partial: bool = False) -> tuple[bool, str | None]:
    allowed_fields = {
        "sn",
        "sujet",
        "mots_cles",
        "description",
        "source",
        "plantes",
        "icone",
        "masquer_icone",
    }

    for key in data.keys():
        if key not in allowed_fields:
            return False, f"Champ non autorisé : {key}"

    if not partial and "sn" not in data:
        return False, "Le champ 'sn' est obligatoire."

    return True, None


@app.route("/health", methods=["GET"])
def health() -> tuple[dict[str, str], int]:
    return {"status": "ok"}, 200


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/sequences", methods=["GET"])
def get_sequences():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, sn, sujet, mots_cles, description, source, plantes, icone, masquer_icone
                    FROM sequences
                    ORDER BY sujet ASC
                    """
                )
                rows = cur.fetchall()

        return jsonify([row_to_dict(row) for row in rows]), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sequences/<int:sequence_id>", methods=["GET"])
def get_sequence(sequence_id: int):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, sn, sujet, mots_cles, description, source, plantes, icone, masquer_icone
                    FROM sequences
                    WHERE id = %s
                    """,
                    (sequence_id,),
                )
                row = cur.fetchone()

        if row is None:
            return jsonify({"error": "Séquence introuvable"}), 404

        return jsonify(row_to_dict(row)), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sequences", methods=["POST"])
def create_sequence():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Le body JSON est invalide."}), 400

    is_valid, error_message = validate_payload(data, partial=False)
    if not is_valid:
        return jsonify({"error": error_message}), 400

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO sequences (
                        sn, sujet, mots_cles, description, source, plantes, icone, masquer_icone
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        data.get("sn"),
                        data.get("sujet"),
                        data.get("mots_cles"),
                        data.get("description"),
                        data.get("source"),
                        data.get("plantes"),
                        data.get("icone"),
                        data.get("masquer_icone"),
                    ),
                )
                new_id = cur.fetchone()["id"]

            conn.commit()

            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, sn, sujet, mots_cles, description, source, plantes, icone, masquer_icone
                    FROM sequences
                    WHERE id = %s
                    """,
                    (new_id,),
                )
                row = cur.fetchone()

        return jsonify(row_to_dict(row)), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sequences/<int:sequence_id>", methods=["PUT"])
def update_sequence(sequence_id: int):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Le body JSON est invalide."}), 400

    is_valid, error_message = validate_payload(data, partial=True)
    if not is_valid:
        return jsonify({"error": error_message}), 400

    if not data:
        return jsonify({"error": "Aucune donnée à mettre à jour."}), 400

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT id FROM sequences WHERE id = %s',
                    (sequence_id,),
                )
                existing = cur.fetchone()

                if existing is None:
                    return jsonify({"error": "Séquence introuvable"}), 404

                fields = []
                values = []

                for field in [
                    "sn",
                    "sujet",
                    "mots_cles",
                    "description",
                    "source",
                    "plantes",
                    "icone",
                    "masquer_icone",
                ]:
                    if field in data:
                        fields.append(f'"{field}" = %s')
                        values.append(data[field])

                values.append(sequence_id)

                query = f"""
                    UPDATE sequences
                    SET {", ".join(fields)}
                    WHERE id = %s
                """

                cur.execute(query, values)
                conn.commit()

                cur.execute(
                    """
                    SELECT id, sn, sujet, mots_cles, description, source, plantes, icone, masquer_icone
                    FROM sequences
                    WHERE id = %s
                    """,
                    (sequence_id,),
                )
                row = cur.fetchone()

        return jsonify(row_to_dict(row)), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sequences/<int:sequence_id>", methods=["DELETE"])
def delete_sequence(sequence_id: int):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT id FROM sequences WHERE id = %s',
                    (sequence_id,),
                )
                existing = cur.fetchone()

                if existing is None:
                    return jsonify({"error": "Séquence introuvable"}), 404

                cur.execute(
                    'DELETE FROM sequences WHERE id = %s',
                    (sequence_id,),
                )
                conn.commit()

        return jsonify({"message": f"Séquence {sequence_id} supprimée avec succès."}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sequences/search", methods=["GET"])
def search_sequences():
    query = request.args.get("q", "").strip()

    if not query:
        return jsonify({
            "query": query,
            "count": 0,
            "results": []
        }), 200

    tokens = tokenize_query(query)

    if not tokens:
        return jsonify({
            "query": query,
            "count": 0,
            "results": []
        }), 200

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, sn, sujet, mots_cles, description, source, plantes, icone, masquer_icone
                    FROM sequences
                    ORDER BY id DESC
                    """
                )
                rows = cur.fetchall()

        matched_rows = [row for row in rows if matches_tokens(row, tokens)]
        results = [row_to_dict(row) for row in matched_rows]

        return jsonify({
            "query": query,
            "tokens": tokens,
            "count": len(results),
            "results": results
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)