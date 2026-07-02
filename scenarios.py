from fastapi import APIRouter, HTTPException
from typing import Any, Dict

from ..models.schemas import ScenarioCreate, ScenarioUpdate
from .. import db
from ..engine import baseline_data as B
from ..engine.simulator import MDSEngine

router = APIRouter()


@router.get("/baseline")
def get_baseline():
    return {
        "lines": B.LINES,
        "line_labels": B.LINE_LABEL,
        "months": B.MONTH_KEYS,
        "sim_defaults": B.SIMULATION_DEFAULTS,
        "lr_share_control_points": {line: B.default_lr_share_control_points(line) for line in B.LINES},
        "dot_annual_default": B.DOT_ANNUAL_DEFAULT,
    }


@router.get("/scenarios")
def list_scenarios():
    return db.list_scenarios()


@router.post("/scenarios")
def create_scenario(payload: ScenarioCreate):
    return db.create_scenario(payload.name, payload.description or "", payload.assumptions_override or {})


@router.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: int):
    s = db.get_scenario(scenario_id)
    if not s:
        raise HTTPException(404, "Scenario not found")
    return s


@router.put("/scenarios/{scenario_id}")
def update_scenario(scenario_id: int, payload: ScenarioUpdate):
    s = db.update_scenario(
        scenario_id,
        name=payload.name,
        description=payload.description,
        assumptions_override=payload.assumptions_override,
    )
    if not s:
        raise HTTPException(404, "Scenario not found")
    return s


@router.delete("/scenarios/{scenario_id}")
def delete_scenario(scenario_id: int):
    s = db.get_scenario(scenario_id)
    if not s:
        raise HTTPException(404, "Scenario not found")
    db.delete_scenario(scenario_id)
    return {"ok": True}


@router.post("/scenarios/{scenario_id}/duplicate")
def duplicate_scenario(scenario_id: int, payload: Dict[str, Any] = None):
    s = db.get_scenario(scenario_id)
    if not s:
        raise HTTPException(404, "Scenario not found")
    new_name = (payload or {}).get("name") or f"{s['name']} (copy)"
    return db.create_scenario(new_name, s["description"], s["assumptions_override"])


def _run(assumptions_override: dict):
    engine = MDSEngine(assumptions_override)
    return engine.run()


@router.post("/simulate")
def simulate_ad_hoc(assumptions_override: Dict[str, Any] = None):
    try:
        return _run(assumptions_override or {})
    except Exception as e:
        raise HTTPException(400, f"Simulation error: {e}")


@router.get("/scenarios/{scenario_id}/results")
def get_scenario_results(scenario_id: int):
    s = db.get_scenario(scenario_id)
    if not s:
        raise HTTPException(404, "Scenario not found")
    try:
        return _run(s["assumptions_override"])
    except Exception as e:
        raise HTTPException(400, f"Simulation error: {e}")


@router.get("/scenarios/{scenario_id}/dot-curve")
def get_dot_curve(scenario_id: int, line: str, year: int):
    s = db.get_scenario(scenario_id)
    if not s:
        raise HTTPException(404, "Scenario not found")
    if line not in B.LINES:
        raise HTTPException(400, f"line must be one of {B.LINES}")
    try:
        engine = MDSEngine(s["assumptions_override"])
        curve = engine.dot_curve(line, year)
        return {"line": line, "year": year, "months": list(range(1, 49)), "curve": curve, "total_dot": sum(curve)}
    except Exception as e:
        raise HTTPException(400, f"Error computing curve: {e}")
