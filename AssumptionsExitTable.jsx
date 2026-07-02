import React, { useState } from 'react'

function getPath(obj, path, fallback) {
  let cur = obj
  for (const k of path) {
    if (cur == null) return fallback
    cur = cur[k]
  }
  return cur === undefined ? fallback : cur
}
function setPath(obj, path, value) {
  const clone = JSON.parse(JSON.stringify(obj))
  let cur = clone
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}
    cur = cur[k]
  }
  cur[path[path.length - 1]] = value
  return clone
}

const LINES = ['1L', '2L', '3L']
const LINE_LABEL = { '1L': '1L', '2L': '2L', '3L': '3L+' }
const LINE_CHIP = { '1L': 'l1', '2L': 'l2', '3L': 'l3' }

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const num = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }))

export default function AssumptionsExitTable({ baseline, scenario, results, onSave, saving }) {
  const [override, setOverride] = useState(scenario.assumptions_override || {})
  const [jsonMode, setJsonMode] = useState(false)
  const [jsonText, setJsonText] = useState(JSON.stringify(scenario.assumptions_override || {}, null, 2))
  const [jsonError, setJsonError] = useState(null)
  const [editYears] = useState(() => {
    const years = Object.keys(baseline.lr_share_control_points['1L']).map(Number).sort((a, b) => a - b)
    return years.filter((y) => y >= 2023 && y <= 2036)
  })

  const val = (path, fallback) => getPath(override, path, fallback)
  const set = (path, v) => setOverride((prev) => setPath(prev, path, v))

  const dotFallback = (line, y) => {
    const knownYears = Object.keys(baseline.dot_annual_default[line]).map(Number).sort((a, b) => a - b)
    if (y <= knownYears[0]) return baseline.dot_annual_default[line][String(knownYears[0])]
    if (y >= knownYears[knownYears.length - 1]) return baseline.dot_annual_default[line][String(knownYears[knownYears.length - 1])]
    return baseline.dot_annual_default[line][String(y)] ?? baseline.dot_annual_default[line][knownYears[knownYears.length - 1]]
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Assumptions &amp; Outputs — year exit</h1>
          <div className="sub">
            Editing <strong>{scenario.name}</strong>. Parameters are editable; outputs update after you Save &amp; re-run.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => { setOverride({}); setJsonText('{}') }}>Reset to baseline</button>
          <button className="btn btn-sm" onClick={() => setJsonMode((m) => !m)}>{jsonMode ? 'Simple editor' : 'Advanced JSON'}</button>
          <button className="btn btn-primary" disabled={saving} onClick={() => onSave(jsonMode ? JSON.parse(jsonText) : override)}>
            {saving ? 'Running…' : 'Save & re-run'}
          </button>
        </div>
      </div>

      {jsonMode ? (
        <div className="card">
          <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '0 0 8px' }}>
            <code>lr_share_target.[line].[year]</code> (line: 1L/2L/3L) — target blended LR exit share;{' '}
            <code>dot_annual.[line].[year]</code> or <code>dot_monthly.[line].[&quot;YYYY-MM&quot;]</code>;{' '}
            <code>sim.start_month</code> / <code>sim.end_month</code> (&quot;YYYY-MM&quot;).
          </p>
          <textarea
            rows={20}
            style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12, border: '1px solid var(--hairline)', borderRadius: 6, padding: 10 }}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          {jsonError && <div style={{ color: 'var(--coral)', fontSize: 12, marginTop: 6 }}>{jsonError}</div>}
        </div>
      ) : (
        <div className="card exit-table-scroll">
          <table className="exit-table">
            <thead>
              <tr>
                <th>Parameter / Output</th>
                {editYears.map((y) => <th key={y}>{y}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="section-row"><td colSpan={editYears.length + 1}>Parameters — LR exit share</td></tr>
              {LINES.map((line) => (
                <tr key={`share-${line}`}>
                  <td><span className={`line-chip ${LINE_CHIP[line]}`}>{LINE_LABEL[line]}</span> LR exit share</td>
                  {editYears.map((y) => {
                    const baselineVal = baseline.lr_share_control_points[line][String(y)] ?? baseline.lr_share_control_points[line][y] ?? 0
                    return (
                      <td key={y}>
                        <input
                          type="number" step={0.5}
                          value={(val(['lr_share_target', line, y], baselineVal) * 100).toFixed(1)}
                          onChange={(e) => set(['lr_share_target', line, y], parseFloat(e.target.value) / 100)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}

              <tr className="section-row"><td colSpan={editYears.length + 1}>Parameters — DOT (months)</td></tr>
              {LINES.map((line) => (
                <tr key={`dot-${line}`}>
                  <td><span className={`line-chip ${LINE_CHIP[line]}`}>{LINE_LABEL[line]}</span> DOT</td>
                  {editYears.map((y) => (
                    <td key={y}>
                      <input
                        type="number" step={0.1}
                        value={val(['dot_annual', line, y], dotFallback(line, y))}
                        onChange={(e) => set(['dot_annual', line, y], parseFloat(e.target.value))}
                      />
                    </td>
                  ))}
                </tr>
              ))}

              {results && (
                <>
                  <tr className="section-row"><td colSpan={editYears.length + 1}>Outputs — resulting shares &amp; DOT (sanity check)</td></tr>
                  {LINES.map((line) => (
                    <tr key={`out-share-${line}`} className="output-row">
                      <td className="mono-cell"><span className={`line-chip ${LINE_CHIP[line]}`}>{LINE_LABEL[line]}</span> LR share (resulting)</td>
                      {editYears.map((y) => (
                        <td key={y} className="mono-cell">{pct(results.annual[line][y]?.lr_exit_share)}</td>
                      ))}
                    </tr>
                  ))}
                  {LINES.map((line) => (
                    <tr key={`out-dot-${line}`} className="output-row">
                      <td className="mono-cell"><span className={`line-chip ${LINE_CHIP[line]}`}>{LINE_LABEL[line]}</span> DOT (resulting)</td>
                      {editYears.map((y) => (
                        <td key={y} className="mono-cell">{num(results.annual[line][y]?.dot_exit_months, 1)}</td>
                      ))}
                    </tr>
                  ))}

                  <tr className="section-row"><td colSpan={editYears.length + 1}>Outputs — revenue ($mm)</td></tr>
                  <tr className="output-row">
                    <td className="mono-cell">Model Demand Revenue</td>
                    {editYears.map((y) => <td key={y} className="mono-cell">{num(results.annual_company[y]?.model_demand_revenue_usd_mm, 0)}</td>)}
                  </tr>
                  <tr className="output-row">
                    <td className="mono-cell">OM Revenue</td>
                    {editYears.map((y) => <td key={y} className="mono-cell">{num(results.annual_company[y]?.om_revenue_usd_mm, 0)}</td>)}
                  </tr>
                  <tr className="output-row">
                    <td className="mono-cell">Total Gross Revenue</td>
                    {editYears.map((y) => <td key={y} className="mono-cell">{num(results.annual_company[y]?.total_gross_revenue_usd_mm, 0)}</td>)}
                  </tr>
                  <tr className="output-row">
                    <td className="mono-cell">Total Net Revenue</td>
                    {editYears.map((y) => <td key={y} className="mono-cell">{num(results.annual_company[y]?.total_net_revenue_usd_mm, 0)}</td>)}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-title">Simulation horizon</div>
        <div className="field-row">
          <span className="field-label">Start month</span>
          <input
            type="month"
            value={val(['sim', 'start_month'], baseline.sim_defaults.start_month)}
            onChange={(e) => set(['sim', 'start_month'], e.target.value)}
          />
        </div>
        <div className="field-row">
          <span className="field-label">End month</span>
          <input
            type="month"
            value={val(['sim', 'end_month'], baseline.sim_defaults.end_month)}
            onChange={(e) => set(['sim', 'end_month'], e.target.value)}
          />
        </div>
      </div>
    </>
  )
}
