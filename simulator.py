"""
Monthly calculator engine (v4) -- faithful port of Reb_lean_model_v1.xlsx,
including an exact replication of the workbook's CalPersistancy macro for
Total Patients (see baseline_data.py docstring for the full derivation).

Per line (1L / 2L / 3L+) and month:
    New Patients(seg)  = EpiDenominator(seg, month) x Share(seg, month)
    New Patients(line) = sum over 4 segments
    New Patients LR(line) = sum over the 3 LR segments (excludes HR)

    Total Patients(line, t):
      - Base case: the workbook's own static Total Patients snapshot,
        verbatim -- exact.
      - Delta correction: added only for months whose 48-month cohort
        lookback includes at least one vintage (cohort-start month) whose
        share or DOT you actually edited. The correction is the exact
        difference between this scenario's contribution and baseline's
        contribution for just those touched cohorts:
            correction(t) = sum over age=1..48, for touched cohorts only, of
                [New Patients_scenario(t-age+1) x Shape(age) x DOT_scenario(t-age+1)]
              - [New Patients_baseline(t-age+1) x Shape(age) x DOT_baseline(t-age+1)]
        Months with no touched cohort in their lookback window are
        untouched and stay bit-exact, even on a line you've otherwise
        edited -- e.g. editing 2027's DOT no longer perturbs 2024-2026.

    TRx(line)      = Total Patients(line) x Compliance(line) x AdminPerMonth
                      + Bolus(line) x AdminPerMonth
    Vol Demand(line)   = TRx(line) x DosePerAdmin(line)
    Vol OM(line)       = TRx(line) x (1 + ModelForecastFactorOM) x DosePerAdmin(line)
    Vol Ex-factory(line) = TRx(line) x (1 + FF_OM + FinanceFactorExFactory) x DosePerAdmin(line)

    Gross Revenue(line) = Vol Ex-factory(line) x Price/mg / 1e6
    Net Revenue(line)   = Gross Revenue(line) x OverallGTN

MDS totals = sum across 1L/2L/3L+. Company totals add BT/Others/MF:
    Model Demand Revenue = (MDS Demand mg + BT/Others/MF Demand mg) x Price/mg / 1e6
    OM Revenue            = (MDS OM mg + BT/Others/MF OM mg) x Price/mg / 1e6
    Total Gross Revenue   = MDS Gross Revenue + BT/Others/MF Gross Revenue (static $)
    Total Net Revenue     = MDS Net Revenue + BT/Others/MF Net Revenue (static $)

SHARE INPUT: you set a target LR exit share by year, per line. ND5Q RS-
absorbs the delta needed to hit that blended target; ND5Q MDS-RS (already at
peak) and D5Q are held at their baseline trajectory. HR is independent and
always at baseline (it's excluded from the LR share metric entirely).
Outside any year you've edited, the true raw monthly baseline share is used
(not a smoothed interpolation) -- see baseline_data.py.
"""
from __future__ import annotations
from typing import Dict, Any
import copy

from . import baseline_data as B


def _deep_merge(base, override):
    result = copy.deepcopy(base)
    if not override:
        return result
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = copy.deepcopy(v)
    return result


def _month_pos(month_key: str) -> float:
    y, m = month_key.split("-")
    return int(y) + (int(m) - 1) / 12.0


def _shift_month(month_key: str, delta: int) -> str:
    y, m = (int(x) for x in month_key.split("-"))
    idx = y * 12 + (m - 1) + delta
    return f"{idx // 12}-{idx % 12 + 1:02d}"


class MDSEngine:
    def __init__(self, assumptions_override: Dict[str, Any] | None = None):
        ov = assumptions_override or {}

        lr_ov = ov.get("lr_share_target") or {}
        self.lr_override_years = {
            line: sorted(int(y) for y in (lr_ov.get(line) or {}).keys())
            for line in B.LINES
        }
        self.lr_override_values = {
            line: {int(y): v for y, v in (lr_ov.get(line) or {}).items()}
            for line in B.LINES
        }

        base_dot = B.default_dot_monthly()
        self.dot_baseline_pure = {line: dict(base_dot[line]) for line in B.LINES}
        dot_ov = ov.get("dot_monthly") or {}
        dot_annual_ov = ov.get("dot_annual") or {}
        self.dot_override_lines = set(dot_annual_ov.keys()) | set(dot_ov.keys())
        for line, years in dot_annual_ov.items():
            for y, v in years.items():
                y = int(y)
                for mk in B.MONTH_KEYS:
                    if int(mk[:4]) == y:
                        base_dot[line][mk] = v
        self.dot_monthly = {line: _deep_merge(base_dot[line], dot_ov.get(line)) for line in B.LINES}

        self.sim = _deep_merge(B.SIMULATION_DEFAULTS, ov.get("sim"))

        self.line_is_pure_baseline = {
            line: (len(self.lr_override_years[line]) == 0 and line not in self.dot_override_lines)
            for line in B.LINES
        }

    # ------------------------------------------------------------- shares --
    def _target_lr_share(self, line, month_key):
        years = self.lr_override_years[line]
        if not years:
            return B.baseline_blended_lr_share(line, month_key)

        y = int(month_key[:4])
        lo = max([oy for oy in years if oy <= y], default=None)
        hi = min([oy for oy in years if oy >= y], default=None)

        if lo is None or hi is None:
            return B.baseline_blended_lr_share(line, month_key)
        if lo == hi:
            return self.lr_override_values[line][lo]
        x = _month_pos(month_key)
        x_lo, x_hi = lo + 11 / 12, hi + 11 / 12
        t = (x - x_lo) / (x_hi - x_lo)
        v_lo, v_hi = self.lr_override_values[line][lo], self.lr_override_values[line][hi]
        return v_lo + (v_hi - v_lo) * t

    def _segment_shares(self, line, month_key):
        target = self._target_lr_share(line, month_key)

        s_mds = B.base_share(line, "MDS_RS", month_key)
        s_d5q = B.base_share(line, "D5Q", month_key)
        s_hr = B.base_share(line, "HR", month_key)

        d_mds = B.epi_denominator(line, "MDS_RS", month_key)
        d_rsneg = B.epi_denominator(line, "RS_NEG", month_key)
        d_d5q = B.epi_denominator(line, "D5Q", month_key)

        total_lr_denom = d_mds + d_rsneg + d_d5q
        if d_rsneg > 1e-9:
            s_rsneg = (target * total_lr_denom - s_mds * d_mds - s_d5q * d_d5q) / d_rsneg
        else:
            s_rsneg = 0.0
        s_rsneg = max(0.0, min(1.0, s_rsneg))

        return {"MDS_RS": s_mds, "RS_NEG": s_rsneg, "D5Q": s_d5q, "HR": s_hr}

    def _dot(self, line, month_key):
        return self.dot_monthly[line].get(month_key, 10.0)

    def dot_curve(self, line, year):
        """The actual scaled 48-month persistency curve for cohorts starting
        in `year`, for this scenario: baseline shape x this scenario's DOT
        height for that vintage. Values sum to the DOT (in months)."""
        height = self._dot(line, f"{year}-01")
        shape = B.DOT_CURVE_SHAPE[line]
        return [s * height for s in shape]

    # ------------------------------------------------------------- run ----
    def run(self):
        start = self.sim.get("start_month", B.DEFAULT_START)
        end = self.sim.get("end_month", B.DEFAULT_END)

        all_months = B.MONTH_KEYS
        output_months = [m for m in all_months if start <= m <= end]

        # Pass 1: New Patients for every line/month across the full history,
        # both under this scenario's shares and under pure baseline shares
        # (the latter is needed to isolate exactly which cohort-months were
        # actually touched, for the delta-correction in Pass 2).
        new_line = {line: {} for line in B.LINES}
        new_line_lr = {line: {} for line in B.LINES}
        new_line_baseline = {line: {} for line in B.LINES}
        for line in B.LINES:
            pure_baseline = self.line_is_pure_baseline[line]
            for mk in all_months:
                shares = self._segment_shares(line, mk)
                by_seg = {seg: B.epi_denominator(line, seg, mk) * shares[seg] for seg in B.SEGMENTS}
                new_line[line][mk] = sum(by_seg.values())
                new_line_lr[line][mk] = sum(by_seg[seg] for seg in B.LR_SEGMENTS)
                if pure_baseline:
                    new_line_baseline[line][mk] = new_line[line][mk]
                else:
                    s_mds = B.base_share(line, "MDS_RS", mk)
                    s_d5q = B.base_share(line, "D5Q", mk)
                    s_hr = B.base_share(line, "HR", mk)
                    d_mds = B.epi_denominator(line, "MDS_RS", mk)
                    d_rsneg = B.epi_denominator(line, "RS_NEG", mk)
                    d_d5q = B.epi_denominator(line, "D5Q", mk)
                    target = B.baseline_blended_lr_share(line, mk)
                    total_lr_denom = d_mds + d_rsneg + d_d5q
                    s_rsneg = ((target * total_lr_denom - s_mds * d_mds - s_d5q * d_d5q) / d_rsneg) if d_rsneg > 1e-9 else 0.0
                    s_rsneg = max(0.0, min(1.0, s_rsneg))
                    base_by_seg = {
                        "MDS_RS": B.epi_denominator(line, "MDS_RS", mk) * s_mds,
                        "RS_NEG": d_rsneg * s_rsneg,
                        "D5Q": d_d5q * s_d5q,
                        "HR": B.epi_denominator(line, "HR", mk) * s_hr,
                    }
                    new_line_baseline[line][mk] = sum(base_by_seg.values())

        # Pass 2: Total Patients -- exact static reference as the base for
        # every month; a delta correction is added only for months whose
        # 48-month cohort lookback actually includes an edited vintage
        # (edited share and/or edited DOT for that specific cohort-start
        # month). Untouched months stay bit-exact even on an edited line.
        total_patients = {line: {} for line in B.LINES}
        for line in B.LINES:
            if self.line_is_pure_baseline[line]:
                for mk in output_months:
                    total_patients[line][mk] = B.total_patients_static(line, mk)
            else:
                shape = B.DOT_CURVE_SHAPE[line]
                dot_base = self.dot_baseline_pure[line]
                for mk in output_months:
                    correction = 0.0
                    for age in range(1, 49):
                        cohort_mk = _shift_month(mk, -(age - 1))
                        if cohort_mk not in new_line[line]:
                            continue
                        share_touched = new_line[line][cohort_mk] != new_line_baseline[line][cohort_mk]
                        dot_now = self._dot(line, cohort_mk)
                        dot_then = dot_base.get(cohort_mk, dot_now)
                        dot_touched = dot_now != dot_then
                        if not (share_touched or dot_touched):
                            continue
                        scenario_contrib = new_line[line][cohort_mk] * shape[age - 1] * dot_now
                        baseline_contrib = new_line_baseline[line][cohort_mk] * shape[age - 1] * dot_then
                        correction += scenario_contrib - baseline_contrib
                    total_patients[line][mk] = B.total_patients_static(line, mk) + correction

        # Pass 3: TRx -> Volumes -> Revenue, and share metrics.
        monthly = {line: {} for line in B.LINES}
        for line in B.LINES:
            for mk in output_months:
                tp = total_patients[line][mk]
                compliance = B.other_input(f"compliance_{line.lower()}", mk)
                admin_pm = B.other_input("admin_per_month", mk)
                bolus_field = {"1L": "1l_bolus", "2L": "2l_bolus", "3L": "3l_bolus"}[line]
                bolus_pts = B.bolus(bolus_field, mk)
                trx = tp * compliance * admin_pm + bolus_pts * admin_pm

                dose_field = {"1L": "dose_1l", "2L": "dose_2l", "3L": "dose_3l"}[line]
                dose = B.other_input(dose_field, mk)
                vol_demand = trx * dose

                ff_om = B.other_input("model_forecast_factor_om", mk)
                ff_fin = B.other_input("finance_factor_exfactory", mk)
                vol_om = trx * (1 + ff_om) * dose
                vol_exfactory = trx * (1 + ff_om + ff_fin) * dose

                price = B.other_input("gross_price_per_mg", mk)
                gtn = B.other_input("overall_gtn", mk)
                gross_rev = vol_exfactory * price / 1_000_000.0
                net_rev = gross_rev * gtn

                lr_denom = sum(B.epi_denominator(line, seg, mk) for seg in B.LR_SEGMENTS)
                total_denom = sum(B.epi_denominator(line, seg, mk) for seg in B.SEGMENTS)
                lr_share = (new_line_lr[line][mk] / lr_denom) if lr_denom > 1e-9 else 0.0
                total_share = (new_line[line][mk] / total_denom) if total_denom > 1e-9 else 0.0

                monthly[line][mk] = {
                    "lr_share": lr_share,
                    "total_share": total_share,
                    "total_patients": tp,
                    "trx": trx,
                    "volume_demand_mg": vol_demand,
                    "volume_om_mg": vol_om,
                    "volume_exfactory_mg": vol_exfactory,
                    "dot_months": self._dot(line, mk),
                    "gross_revenue_usd_mm": gross_rev,
                    "net_revenue_usd_mm": net_rev,
                }

        # company-level tiers (Model Demand / OM Revenue), including BT/Others/MF static mg volumes
        company = {}
        for mk in output_months:
            mds_demand_mg = sum(monthly[line][mk]["volume_demand_mg"] for line in B.LINES)
            mds_om_mg = sum(monthly[line][mk]["volume_om_mg"] for line in B.LINES)
            other_demand_mg = (
                B.bt_mg("others_mf_demand_25", mk) * 25 + B.bt_mg("others_mf_demand_75", mk) * 75
                + B.bt_mg("bthal_demand_25", mk) * 25 + B.bt_mg("bthal_demand_75", mk) * 75
            )
            other_om_mg = (
                B.bt_mg("others_mf_om_25", mk) * 25 + B.bt_mg("others_mf_om_75", mk) * 75
                + B.bt_mg("bthal_om_25", mk) * 25 + B.bt_mg("bthal_om_75", mk) * 75
            )
            price = B.other_input("gross_price_per_mg", mk)
            model_demand_rev = (mds_demand_mg + other_demand_mg) * price / 1_000_000.0
            om_rev = (mds_om_mg + other_om_mg) * price / 1_000_000.0

            mds_gross = sum(monthly[line][mk]["gross_revenue_usd_mm"] for line in B.LINES)
            mds_net = sum(monthly[line][mk]["net_revenue_usd_mm"] for line in B.LINES)
            bt_others_mf_gross = B.bt_others_mf("bt_gross", mk) + B.bt_others_mf("others_gross", mk) + B.bt_others_mf("mf_gross", mk)
            bt_others_mf_net = B.bt_others_mf("bt_net", mk) + B.bt_others_mf("others_net", mk) + B.bt_others_mf("mf_net", mk)

            company[mk] = {
                "model_demand_revenue_usd_mm": model_demand_rev,
                "om_revenue_usd_mm": om_rev,
                "mds_gross_revenue_usd_mm": mds_gross,
                "mds_net_revenue_usd_mm": mds_net,
                "bt_others_mf_gross_usd_mm": bt_others_mf_gross,
                "bt_others_mf_net_usd_mm": bt_others_mf_net,
                "total_gross_revenue_usd_mm": mds_gross + bt_others_mf_gross,
                "total_net_revenue_usd_mm": mds_net + bt_others_mf_net,
            }

        years = sorted(set(int(mk[:4]) for mk in output_months))
        annual = {line: {} for line in B.LINES}
        for line in B.LINES:
            for y in years:
                year_months = [mk for mk in output_months if mk.startswith(str(y))]
                if not year_months:
                    continue
                dec_key = f"{y}-12" if f"{y}-12" in year_months else year_months[-1]
                annual[line][y] = {
                    "lr_exit_share": monthly[line][dec_key]["lr_share"],
                    "total_exit_share": monthly[line][dec_key]["total_share"],
                    "dot_exit_months": monthly[line][dec_key]["dot_months"],
                    "dot_avg_months": sum(monthly[line][mk]["dot_months"] for mk in year_months) / len(year_months),
                    "gross_revenue_usd_mm": sum(monthly[line][mk]["gross_revenue_usd_mm"] for mk in year_months),
                    "net_revenue_usd_mm": sum(monthly[line][mk]["net_revenue_usd_mm"] for mk in year_months),
                    "avg_total_patients": sum(monthly[line][mk]["total_patients"] for mk in year_months) / len(year_months),
                }

        annual_company = {}
        for y in years:
            year_months = [mk for mk in output_months if mk.startswith(str(y))]
            annual_company[y] = {
                k: sum(company[mk][k] for mk in year_months)
                for k in ["model_demand_revenue_usd_mm", "om_revenue_usd_mm", "total_gross_revenue_usd_mm", "total_net_revenue_usd_mm"]
            }

        return {
            "months": output_months,
            "years": years,
            "monthly": monthly,
            "annual": annual,
            "company_monthly": company,
            "annual_company": annual_company,
        }
