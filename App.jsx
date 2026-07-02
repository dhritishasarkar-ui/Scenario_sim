import React, { useEffect, useState } from 'react'
import Ribbon from './components/Ribbon.jsx'
import ScenariosTab from './components/ScenariosTab.jsx'
import NewScenarioModal from './components/NewScenarioModal.jsx'
import ResultsView from './components/ResultsView.jsx'
import AssumptionsExitTable from './components/AssumptionsExitTable.jsx'
import CompareView from './components/CompareView.jsx'
import { api } from './api/client'

export default function App() {
  const [baseline, setBaseline] = useState(null)
  const [scenarios, setScenarios] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [scenario, setScenario] = useState(null)
  const [results, setResults] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [showNew, setShowNew] = useState(false)
  const [loadingResults, setLoadingResults] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getBaseline().then(setBaseline).catch((e) => setError(String(e)))
    refreshScenarios()
  }, [])

  async function refreshScenarios(selectAfter) {
    try {
      const list = await api.listScenarios()
      let finalList = list
      if (list.length === 0) {
        const created = await api.createScenario({ name: 'Baseline', description: 'Lean model baseline', assumptions_override: {} })
        finalList = [created]
      }
      setScenarios(finalList)
      const toSelect = selectAfter || finalList[0]?.id
      if (toSelect) selectScenario(toSelect)
    } catch (e) {
      setError(String(e))
    }
  }

  async function selectScenario(id) {
    setSelectedId(id)
    setLoadingResults(true)
    try {
      const s = await api.getScenario(id)
      setScenario(s)
      const r = await api.getResults(id)
      setResults(r)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingResults(false)
    }
  }

  async function handleCreate(payload) {
    const created = await api.createScenario(payload)
    setShowNew(false)
    await refreshScenarios(created.id)
    setTab('assumptions')
  }

  async function handleDuplicate(id) {
    const s = scenarios.find((x) => x.id === id)
    const created = await api.duplicateScenario(id, `${s.name} (copy)`)
    await refreshScenarios(created.id)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this scenario?')) return
    await api.deleteScenario(id)
    setSelectedId(null)
    await refreshScenarios()
  }

  async function handleSaveAssumptions(override) {
    setSaving(true)
    try {
      const updated = await api.updateScenario(selectedId, { assumptions_override: override })
      setScenario(updated)
      const r = await api.getResults(selectedId)
      setResults(r)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return <div className="empty-state">Something went wrong talking to the backend: {error}<br />Is the API running on :8123?</div>
  }
  if (!baseline || !scenario) {
    return <div className="loading-bar">Loading…</div>
  }

  return (
    <div className="app-shell">
      <Ribbon
        tab={tab}
        onTab={setTab}
        scenarios={scenarios}
        selectedId={selectedId}
        onSelect={selectScenario}
        onNew={() => setShowNew(true)}
      />
      <div className="main">
        <div className="content">
          {tab === 'dashboard' && <ResultsView results={results} loading={loadingResults} />}
          {tab === 'assumptions' && (
            <AssumptionsExitTable baseline={baseline} scenario={scenario} results={results} saving={saving} onSave={handleSaveAssumptions} />
          )}
          {tab === 'scenarios' && (
            <ScenariosTab
              scenarios={scenarios}
              selectedId={selectedId}
              onSelect={(id) => { selectScenario(id); setTab('assumptions') }}
              onNew={() => setShowNew(true)}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          )}
          {tab === 'compare' && <CompareView scenarios={scenarios} />}
        </div>
      </div>
      {showNew && <NewScenarioModal onCreate={handleCreate} onClose={() => setShowNew(false)} />}
    </div>
  )
}
