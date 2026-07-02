import React from 'react'

export default function ScenariosTab({ scenarios, selectedId, onSelect, onNew, onDuplicate, onDelete }) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Scenarios</h1>
          <div className="sub">Create, duplicate, or remove scenarios. Select one to make it active across the app.</div>
        </div>
        <button className="btn btn-primary" onClick={onNew}>+ New scenario</button>
      </div>

      <div className="scenario-grid">
        {scenarios.map((s) => (
          <div key={s.id} className={`scenario-row ${s.id === selectedId ? 'active' : ''}`}>
            <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => onSelect(s.id)}>
              <div className="scenario-row-name">
                {s.name}
                {s.name === 'Baseline' && <span className="tag-baseline">BASE</span>}
              </div>
              {s.description && <div className="scenario-row-desc">{s.description}</div>}
            </div>
            <div className="scenario-row-actions">
              <button className="btn btn-sm" onClick={() => onSelect(s.id)}>View</button>
              <button className="btn btn-sm" onClick={() => onDuplicate(s.id)}>Duplicate</button>
              {s.name !== 'Baseline' && (
                <button className="btn btn-sm btn-danger" onClick={() => onDelete(s.id)}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
