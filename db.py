import sqlite3
import json
import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "scenarios.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            assumptions_override TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def _row_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"] or "",
        "assumptions_override": json.loads(row["assumptions_override"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def create_scenario(name: str, description: str, assumptions_override: dict):
    now = datetime.datetime.utcnow().isoformat()
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO scenarios (name, description, assumptions_override, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (name, description, json.dumps(assumptions_override), now, now),
    )
    conn.commit()
    scenario_id = cur.lastrowid
    conn.close()
    return get_scenario(scenario_id)


def list_scenarios():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM scenarios ORDER BY id ASC").fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_scenario(scenario_id: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,)).fetchone()
    conn.close()
    return _row_to_dict(row) if row else None


def update_scenario(scenario_id: int, name=None, description=None, assumptions_override=None):
    existing = get_scenario(scenario_id)
    if not existing:
        return None
    now = datetime.datetime.utcnow().isoformat()
    new_name = name if name is not None else existing["name"]
    new_desc = description if description is not None else existing["description"]
    new_ov = assumptions_override if assumptions_override is not None else existing["assumptions_override"]
    conn = get_conn()
    conn.execute(
        "UPDATE scenarios SET name = ?, description = ?, assumptions_override = ?, updated_at = ? WHERE id = ?",
        (new_name, new_desc, json.dumps(new_ov), now, scenario_id),
    )
    conn.commit()
    conn.close()
    return get_scenario(scenario_id)


def delete_scenario(scenario_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM scenarios WHERE id = ?", (scenario_id,))
    conn.commit()
    conn.close()
