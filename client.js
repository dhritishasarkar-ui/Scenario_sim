const BASE = '/api'

async function handle(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  getBaseline: () => fetch(`${BASE}/baseline`).then(handle),
  listScenarios: () => fetch(`${BASE}/scenarios`).then(handle),
  getScenario: (id) => fetch(`${BASE}/scenarios/${id}`).then(handle),
  createScenario: (payload) =>
    fetch(`${BASE}/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handle),
  updateScenario: (id, payload) =>
    fetch(`${BASE}/scenarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handle),
  deleteScenario: (id) =>
    fetch(`${BASE}/scenarios/${id}`, { method: 'DELETE' }).then(handle),
  duplicateScenario: (id, name) =>
    fetch(`${BASE}/scenarios/${id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(handle),
  getResults: (id) => fetch(`${BASE}/scenarios/${id}/results`).then(handle),
  getDotCurve: (id, line, year) => fetch(`${BASE}/scenarios/${id}/dot-curve?line=${line}&year=${year}`).then(handle),
}
