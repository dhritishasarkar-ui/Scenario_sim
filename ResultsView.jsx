import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const num = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }))
const LINES = ['1L', '2L', '3L']
const LINE_LABEL = { '1L': '1L', '2L': '2L', '3L': '3L+' }
const LINE_COLOR = { '1L': 'var(--bms-purple)', '2L': 'var(--indigo)', '3L': 'var(--amber)' }

function shareSeries(results) {
  return results.years.map((y) => {
    const row = { year: y }
    LINES.forEach((l) => { row[l] = results.annual[l][y]?.lr_exit_share })
    return row
  })
}
function dotSeries(results) {
  return results.years.map((y) => {
    const row = { year: y }
    LINES.forEach((l) => { row[l] = results.annual[l][y]?.dot_exit_months })
    return row
  })
}
function revenueTierSeries(results) {
  return results.years.map((y) => ({
    year: y,
    model_demand: results.annual_company[y]?.model_demand_revenue_usd_mm,
    om: results.annual_company[y]?.om_revenue_usd_mm,
    gross: results.annual_company[y]?.total_gross_revenue_usd_mm,
    net: results.annual_company[y]?.total_net_revenue_usd_mm,
  }))
}
function patientsSeries(results) {
  return results.years.map((y) => {
    const row = { year: y }
    LINES.forEach((l) => { row[l] = results.annual[l][y]?.avg_total_patients })
    return row
  })
}

export default function ResultsView({ results, loading }) {
  if (loading) return <div className="loading-bar">Running simulation…</div>
  if (!results) return null

  const shareData = shareSeries(results)
  const dotData = dotSeries(results)
  const revData = revenueTierSeries(results)
  const patData = patientsSeries(results)

  const lastYear = results.years[results.years.length - 1]
  const lastCo = results.annual_company[lastYear]

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Model Demand Rev ({lastYear}), $mm</div>
          <div className="kpi-value">{num(lastCo?.model_demand_revenue_usd_mm, 0)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">OM Revenue ({lastYear}), $mm</div>
          <div className="kpi-value teal">{num(lastCo?.om_revenue_usd_mm, 0)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Gross Rev ({lastYear}), $mm</div>
          <div className="kpi-value indigo">{num(lastCo?.total_gross_revenue_usd_mm, 0)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Net Rev ({lastYear}), $mm</div>
          <div className="kpi-value amber">{num(lastCo?.total_net_revenue_usd_mm, 0)}</div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="card">
          <div className="card-title">Revenue tiers — Model Demand → OM → Gross → Net ($mm)</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revData}>
              <CartesianGrid stroke="var(--surface-sunken)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={50} />
              <Tooltip formatter={(v) => num(v, 0)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="model_demand" stroke="var(--hairline)" strokeWidth={2} dot={false} name="Model Demand" />
              <Line type="monotone" dataKey="om" stroke="var(--amber)" strokeWidth={2} dot={false} name="OM Revenue" />
              <Line type="monotone" dataKey="gross" stroke="var(--indigo)" strokeWidth={2} dot={false} name="Total Gross" />
              <Line type="monotone" dataKey="net" stroke="var(--teal)" strokeWidth={2} dot={false} name="Total Net" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">
            LR exit share by line <span className="line-chip l1">1L</span><span className="line-chip l2">2L</span><span className="line-chip l3">3L+</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={shareData}>
              <CartesianGrid stroke="var(--surface-sunken)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} />
              <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v) => pct(v)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Line type="monotone" dataKey="1L" stroke={LINE_COLOR['1L']} strokeWidth={2} dot={false} name="1L LR" />
              <Line type="monotone" dataKey="2L" stroke={LINE_COLOR['2L']} strokeWidth={2} dot={false} name="2L LR" />
              <Line type="monotone" dataKey="3L" stroke={LINE_COLOR['3L']} strokeWidth={2} dot={false} name="3L+ LR" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">DOT by line, months (Dec exit)</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dotData}>
              <CartesianGrid stroke="var(--surface-sunken)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip formatter={(v) => num(v, 1)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Line type="monotone" dataKey="1L" stroke={LINE_COLOR['1L']} strokeWidth={2} dot={false} name="1L" />
              <Line type="monotone" dataKey="2L" stroke={LINE_COLOR['2L']} strokeWidth={2} dot={false} name="2L" />
              <Line type="monotone" dataKey="3L" stroke={LINE_COLOR['3L']} strokeWidth={2} dot={false} name="3L+" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Avg active patients by line</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={patData}>
              <CartesianGrid stroke="var(--surface-sunken)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--hairline)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v) => num(v, 0)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Line type="monotone" dataKey="1L" stroke={LINE_COLOR['1L']} strokeWidth={2} dot={false} name="1L" />
              <Line type="monotone" dataKey="2L" stroke={LINE_COLOR['2L']} strokeWidth={2} dot={false} name="2L" />
              <Line type="monotone" dataKey="3L" stroke={LINE_COLOR['3L']} strokeWidth={2} dot={false} name="3L+" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Annual summary — data table</div>
        <table className="share-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>1L LR share</th><th>2L LR share</th><th>3L+ LR share</th>
              <th>1L DOT</th><th>2L DOT</th><th>3L+ DOT</th>
              <th>Model Demand ($mm)</th><th>OM Rev ($mm)</th><th>Total Gross ($mm)</th><th>Total Net ($mm)</th>
            </tr>
          </thead>
          <tbody>
            {results.years.map((y) => {
              const co = results.annual_company[y] || {}
              return (
                <tr key={y}>
                  <td>{y}</td>
                  <td>{pct(results.annual['1L'][y]?.lr_exit_share)}</td>
                  <td>{pct(results.annual['2L'][y]?.lr_exit_share)}</td>
                  <td>{pct(results.annual['3L'][y]?.lr_exit_share)}</td>
                  <td>{num(results.annual['1L'][y]?.dot_exit_months, 1)}</td>
                  <td>{num(results.annual['2L'][y]?.dot_exit_months, 1)}</td>
                  <td>{num(results.annual['3L'][y]?.dot_exit_months, 1)}</td>
                  <td>{num(co.model_demand_revenue_usd_mm, 0)}</td>
                  <td>{num(co.om_revenue_usd_mm, 0)}</td>
                  <td>{num(co.total_gross_revenue_usd_mm, 0)}</td>
                  <td>{num(co.total_net_revenue_usd_mm, 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
