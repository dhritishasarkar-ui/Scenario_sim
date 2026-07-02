import React from 'react'

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'assumptions', label: 'Assumptions' },
  { key: 'scenarios', label: 'Scenarios' },
  { key: 'compare', label: 'Compare' },
]

export default function Ribbon({ tab, onTab, scenarios, selectedId, onSelect, onNew }) {
  return (
    <div className="ribbon">
      <div className="ribbon-left">
        <div className="ribbon-brand">
          <div className="ribbon-brand-mark"><span></span><span></span><span></span></div>
          <div>
            <div className="ribbon-brand-title">Reblozyl Scenario Builder</div>
            <div className="ribbon-brand-sub">1L · 2L · 3L+</div>
          </div>
        </div>
        <div className="ribbon-nav">
          {TABS.map((t) => (
            <button key={t.key} className={`ribbon-tab ${tab === t.key ? 'active' : ''}`} onClick={() => onTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="ribbon-right">
        <select className="scenario-switcher" value={selectedId || ''} onChange={(e) => onSelect(Number(e.target.value))}>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button className="btn-ribbon" onClick={onNew}>+ New scenario</button>
      </div>
    </div>
  )
}
