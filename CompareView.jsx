import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { api } from '../api/client'

const COLORS = ['#A020A0', '#4A5FBD', '#B4761F', '#B14B3B', '#1B7A72', '#6E1471']
const LINES = ['1L', '2L', '3L']
const LINE_LABEL = { '1L': '1L', '2L': '2L', '3L': '3L+' }
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const num = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }))

const METRICS = [
  { k: 'model_demand', label: 'Model Demand Rev ($mm)', isPct: false, get: (r, y) => r.annual_company[y]?.model_demand_revenue_usd_mm },
  { k: 'om', label: 'OM Revenue ($mm)', isPct: false, get: (r, y) => r.annual_company[y]?.om_revenue_usd_mm },
  { k: 'gross', label: 'Total Gross Rev ($mm)', isPct: false, get: (r, y) => r.annual_company[y]?.total_gross_revenue_usd_mm },
  { k: 'net', label: 'Total Net Rev ($mm)', isPct: false, get: (r, y) => r.annual_company[y]?.total_net_revenue_usd_mm },
  { k: '1L_share', label: '1L LR share', isPct: true, get: (r, y) => r.annual['1L'][y]?.lr_exit_share },
  { k: '2L_share', label: '2L LR share', isPct: true, get: (r, y) => r.annual['2L'][y]?.lr_exit_share },
  { k: '1L_dot', label: '1L DOT (months)', isPct: false, get: (r, y) => r.annual['1L'][y]?.dot_exit_months },
]

export default function CompareView({ scenarios }) {
  const [checked, setChecked] = useState([])
  const [resultsById, setResultsById] = useState({})
  const [metricKey, setMetricKey] = useState('model_demand')
  const [curveLine, setCurveLine] = useState('1L')
  const [curveYear, setCurveYear] = useState(2026)
  const [curvesById, setCurvesById] = useState({})

  useEffect(() => {
    checked.forEach((id) => {
      if (!resultsById[id]) {
        api.getResults(id).then((r) => setResultsById((prev) => ({ ...prev, [id]: r })))
      }
    })
  }, [checked])

  useEffect(() => {
    setCurvesById({})
    checked.forEach((id) => {
      api.getDotCurve(id, curveLine, curveYear).then((c) => setCurvesById((prev) => ({ ...prev, [id]: c })))
    })
  }, [checked, curveLine, curveYear])

  const toggle = (id) => setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const metric = METRICS.find((m) => m.k === metricKey)
  const scenarioName = (id) => scenarios.find((s) => s.id === id)?.name || id

  const chartData = useMemo(() => {
    const active = checked.filter((id) => resultsById[id])
    if (active.length === 0) return []
    const years = resultsById[active[0]].years
    return years.map((y) => {
      const row = { year: y }
      active.forEach((id) => { row[id] = metric.get(resultsById[id], y) })
      return row
    })
  }, [checked, resultsById, metricKey])

  const deltaRows = useMemo(() => {
    const active = checked.filter((id) => resultsById[id])
    if (active.length < 2) return null
    const base = active[0]
    const years = resultsById[base].years
    return years.map((y) => {
      const baseVal = metric.get(resultsById[base], y)
      const row = { year: y, baseVal }
      active.slice(1).forEach((id) => {
        const val = metric.get(resultsById[id], y)
        row[id] = { val, delta: val - baseVal, deltaPct: baseVal !== 0 ? (val - baseVal) / baseVal : null }
      })
      return row
    })
  }, [checked, resultsById, metricKey])

  const curveChartData = useMemo(() => {
    const active = checked.filter((id) => curvesById[id])
    if (active.length === 0) return []
    return Array.from({ length: 48 }, (_, i) => {
      const row = { month: i + 1 }
      active.forEach((id) => { row[id] = curvesById[id].curve[i] })
      return row
    })
  }, [checked, curvesById])

  const availableYears = Array.from({ length: 2036 - 2024 + 1 }, (_, i) => 2024 + i)

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Compare scenarios</h1>
          <div className="sub">Select scenarios to overlay on a chart, see exact deltas by year, and compare DOT curve shape.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Scenario selection</div>
        <div className="compare-checklist">
          {scenarios.map((s, i) => (
            <div key={s.id} className={`compare-chip ${checked.includes(s.id) ? 'checked' : ''}`} onClick={() => toggle(s.id)}>
              <span className="swatch" style={{ background: COLORS[checked.indexOf(s.id) >= 0 ? checked.indexOf(s.id) % COLORS.length : i % COLORS.length] }} />
              {s.name}
            </div>
          ))}
        </div>
        {checked.length >= 2 && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
            Deltas below are calculated vs. <strong>{scenarioName(checked[0])}</strong> (the first scenario you selected).
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Metric comparison</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {METRICS.map((m) => (
            <button key={m.k} className={`tab ${metricKey === m.k ? 'active' : ''}`} onClick={() => setMetricKey(m.k)}>{m.label}</button>
          ))}
        </div>

        {checked.length === 0 ? (
          <div className="empty-state">Select two or more scenarios above to compare.</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--surface-sunken)" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => (metric.isPct ? `${Math.round(v * 100)}%` : v)}
                  tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={54}
                />
                <Tooltip formatter={(v) => (metric.isPct ? pct(v) : v?.toFixed?.(1))} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Legend formatter={(id) => scenarioName(Number(id))} wrapperStyle={{ fontSize: 12 }} />
                {checked.map((id, i) => (
                  <Line key={id} type="monotone" dataKey={id} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {deltaRows && (
              <div className="exit-table-scroll" style={{ marginTop: 16 }}>
                <table className="share-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>{scenarioName(checked[0])}</th>
                      {checked.slice(1).map((id) => (
                        <React.Fragment key={id}>
                          <th>{scenarioName(id)}</th>
                          <th>Δ</th>
                          <th>Δ%</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deltaRows.map((row) => (
                      <tr key={row.year}>
                        <td>{row.year}</td>
                        <td>{metric.isPct ? pct(row.baseVal) : num(row.baseVal, 1)}</td>
                        {checked.slice(1).map((id) => (
                          <React.Fragment key={id}>
                            <td>{metric.isPct ? pct(row[id].val) : num(row[id].val, 1)}</td>
                            <td style={{ color: row[id].delta > 0 ? 'var(--teal)' : row[id].delta < 0 ? 'var(--coral)' : 'inherit' }}>
                              {row[id].delta > 0 ? '+' : ''}{metric.isPct ? pct(row[id].delta) : num(row[id].delta, 1)}
                            </td>
                            <td style={{ color: row[id].delta > 0 ? 'var(--teal)' : row[id].delta < 0 ? 'var(--coral)' : 'inherit' }}>
                              {row[id].deltaPct == null ? '—' : `${row[id].deltaPct > 0 ? '+' : ''}${(row[id].deltaPct * 100).toFixed(1)}%`}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">DOT curve comparison (48-month persistency shape)</div>
        <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '0 0 12px' }}>
          The actual month-on-therapy curve applied to patients starting in the selected year — same shape across
          scenarios, height scaled to each scenario's DOT assumption for that vintage.
        </p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>Line</label>
            <select className="btn btn-sm" value={curveLine} onChange={(e) => setCurveLine(e.target.value)}>
              {LINES.map((l) => <option key={l} value={l}>{LINE_LABEL[l]}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>Cohort start year</label>
            <select className="btn btn-sm" value={curveYear} onChange={(e) => setCurveYear(Number(e.target.value))}>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {checked.length === 0 ? (
          <div className="empty-state">Select scenarios above to compare their DOT curves.</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={curveChartData}>
                <CartesianGrid stroke="var(--surface-sunken)" vertical={false} />
                <XAxis dataKey="month" label={{ value: 'Months on therapy', position: 'insideBottom', offset: -3, fontSize: 11 }}
                  tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v) => v?.toFixed?.(3)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Legend formatter={(id) => scenarioName(Number(id))} wrapperStyle={{ fontSize: 12 }} />
                {checked.map((id, i) => (
                  <Line key={id} type="monotone" dataKey={id} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }}>
              {checked.map((id) => (
                curvesById[id] && (
                  <div key={id}>
                    <strong>{scenarioName(id)}</strong>: avg DOT = <span className="mono">{curvesById[id].total_dot.toFixed(2)}</span> months
                  </div>
                )
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
