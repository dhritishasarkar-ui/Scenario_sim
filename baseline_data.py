"""
Baseline data for the v3 engine, ported from Reb_lean_model_v1.xlsx.

Sheets and how each maps in:
  - `Input sheet`: all static (yellow) assumptions.
      Module 1 (treatable pool)  -> lean_epi_denom.json   (monthly denominator, by line/segment)
      Module 2 (patient shares)  -> lean_shares.json       (monthly Lusp+NTD combined share, by line/segment)
      Other inputs (compliance, dose, price, GTN, forecast
        factors, mg-split)       -> lean_other_inputs.json
      Others+MF / Bthal mg volumes (Demand & OM tiers)
                                  -> lean_bt_mg.json
  - `Calculation` tab: Bolus patient counts (yellow/static; rows 37-40)
    and Bthal/Others TRx (row 48, static) -> lean_bolus.json
  - `Summary` tab: BT/Others/MF Gross & Net Revenue (rows 13-15, 23-25;
    static)                       -> lean_bt_others_mf.json
  - `DoT - Luspatercept`: Annual Avg DoT (rows 9-11, 2020-2028) -> hardcoded below,
    same as prior extraction.

WHAT THE ENGINE COMPUTES -- Total Patients (the active-patient stock):
  In the workbook, `Total Patients` per line (Calculation rows 31-33) is a
  frozen static snapshot -- it was originally produced by a VBA macro
  (`CalPersistancy`) that convolves New Patients against a 48-month
  persistency curve (from the DoT tab), then frozen/pasted as static values,
  disconnected from the live Module-2 share inputs.

  We replicate `CalPersistancy` exactly rather than approximating it:
    Total Patients(line, t) = sum over age=1..48 of
        New Patients(line, t-age+1) x Shape(line, age) x DOT(line, t-age+1)
  where `Shape` is the workbook's own 48-point curve (confirmed identical
  across every cohort-start-month column in the DoT tab, i.e. one shape per
  line, not a shape-per-vintage matrix) normalized to sum to 1.0, and `DOT`
  is the average-DOT-by-year assumption in effect for the month a cohort
  *started* (its vintage) -- exactly matching your instruction that an
  alternate-scenario DOT change should reuse the baseline curve's shape and
  only rescale its height.

  For lines/scenarios where you haven't touched shares or DOT at all, we use
  the workbook's static Total Patients snapshot verbatim instead of
  recomputing it -- so the Baseline scenario is an exact reproduction, not
  an approximation. The convolution above only kicks in for a line once you
  actually edit that line's share or DOT assumptions (since at that point
  there's no "ground truth" to fall back on -- you're asking about a
  hypothetical the workbook itself never computed).

SHARE DECOMPOSITION RULE (per your instruction):
  ND5Q MDS-RS ("RS+") has already hit peak share in both 1L and 2L, so it's
  held at its baseline trajectory rather than exposed as an editable lever.
  D5Q and Higher Risk are also held at baseline. When you set a target LR
  exit share by year, the ND5Q RS- segment absorbs the entire delta needed
  to hit that blended target:

    share_RS-(t) = [Target_LR(t) x (denom_MDSRS+denom_RSneg+denom_D5Q)(t)
                    - share_MDSRS(t) x denom_MDSRS(t)
                    - share_D5Q(t)  x denom_D5Q(t)] / denom_RSneg(t)

  Applied identically for 1L, 2L, and 3L+.
"""
import json
import os

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def _load(name):
    with open(os.path.join(_DATA_DIR, name)) as f:
        return json.load(f)


EPI_DENOM = _load("lean_epi_denom.json")          # {line: {segment: {month: val}}}
BASE_SHARES = _load("lean_shares.json")            # {line: {segment: {month: val}}} (Lusp+NTD combined)
OTHER_INPUTS = _load("lean_other_inputs.json")     # {field: {month: val}}
BOLUS = _load("lean_bolus.json")                   # {field: {month: val}}
BT_OTHERS_MF = _load("lean_bt_others_mf.json")     # {field: {month: val}}  (static $ Gross/Net)
BT_MG = _load("lean_bt_mg.json")                   # {field: {month: val}}  (static mg volumes, Demand/OM tiers)
TOTAL_PATIENTS_STATIC = _load("lean_total_patients_static.json")  # {line: {month: val}} -- the workbook's own frozen snapshot
DOT_CURVES = _load("dot_curves.json")              # {line: [48 values]} -- the persistency curve, confirmed uniform across cohort-start vintages
DOT_CURVE_SHAPE = {line: [v / sum(curve) for v in curve] for line, curve in DOT_CURVES.items()}  # normalized to sum=1.0

LINES = ["1L", "2L", "3L"]
LINE_LABEL = {"1L": "1L", "2L": "2L", "3L": "3L+"}
SEGMENTS = ["MDS_RS", "RS_NEG", "D5Q", "HR"]
LR_SEGMENTS = ["MDS_RS", "RS_NEG", "D5Q"]
PEAKED_SEGMENT = "MDS_RS"    # held at baseline -- already at peak share
FIXED_SEGMENTS = ["D5Q", "HR"]   # held at baseline; HR excluded from the LR share metric entirely

MONTH_KEYS = sorted(EPI_DENOM["1L"]["MDS_RS"].keys())
DEFAULT_START = "2024-01"
DEFAULT_END = "2036-12"

# DOT (avg months on therapy), annual control points from 'DoT - Luspatercept' rows 9-11.
# Held flat outside 2020-2028.
DOT_ANNUAL_DEFAULT = {
    "1L": {2020: 6.86, 2021: 7.55, 2022: 9.34, 2023: 10.84, 2024: 10.71,
           2025: 11.54, 2026: 12.24, 2027: 11.80, 2028: 11.80},
    "2L": {2020: 11.23, 2021: 12.54, 2022: 13.14, 2023: 13.34, 2024: 12.11,
           2025: 12.25, 2026: 12.23, 2027: 12.23, 2028: 12.19},
}
DOT_ANNUAL_DEFAULT["3L"] = DOT_ANNUAL_DEFAULT["2L"]

SIMULATION_DEFAULTS = {"start_month": DEFAULT_START, "end_month": DEFAULT_END}


def _year_of(month_key):
    return int(month_key[:4])


def default_dot_monthly():
    out = {}
    for line in LINES:
        annual = DOT_ANNUAL_DEFAULT[line]
        years = sorted(annual.keys())
        grid = {}
        for mk in MONTH_KEYS:
            y = _year_of(mk)
            if y <= years[0]:
                grid[mk] = annual[years[0]]
            elif y >= years[-1]:
                grid[mk] = annual[years[-1]]
            else:
                grid[mk] = annual[y]
        out[line] = grid
    return out


def baseline_blended_lr_share(line, month_key):
    """The LR share implied purely by the baseline Module-2 shares (no
    scenario override) -- i.e. what 'MDS Shares (Rbz Eligible)' shows today."""
    num = sum(BASE_SHARES[line][seg][month_key] * EPI_DENOM[line][seg][month_key] for seg in LR_SEGMENTS)
    den = sum(EPI_DENOM[line][seg][month_key] for seg in LR_SEGMENTS)
    return num / den if den > 1e-9 else 0.0


def default_lr_share_control_points(line):
    """December-exit baseline LR share by year, for seeding the Assumptions UI."""
    out = {}
    for mk in MONTH_KEYS:
        if mk.endswith("-12"):
            out[_year_of(mk)] = baseline_blended_lr_share(line, mk)
    return out


def epi_denominator(line, segment, month_key):
    return EPI_DENOM[line][segment].get(month_key, 0.0)


def base_share(line, segment, month_key):
    return BASE_SHARES[line][segment].get(month_key, 0.0)


def other_input(field, month_key):
    return OTHER_INPUTS[field].get(month_key, 0.0)


def bolus(field, month_key):
    return BOLUS[field].get(month_key, 0.0)


def bt_others_mf(field, month_key):
    return BT_OTHERS_MF[field].get(month_key, 0.0)


def bt_mg(field, month_key):
    return BT_MG[field].get(month_key, 0.0)


def total_patients_static(line, month_key):
    """The workbook's own frozen Total Patients snapshot (Calculation tab
    rows 31-33) -- used verbatim for lines/months a scenario hasn't touched,
    so the Baseline scenario is an exact reproduction rather than an
    approximation."""
    return TOTAL_PATIENTS_STATIC[line].get(month_key, 0.0)
