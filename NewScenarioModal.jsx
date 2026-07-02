import React, { useState } from 'react'

export default function NewScenarioModal({ onCreate, onClose }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New scenario</h3>
        <p>Starts from baseline assumptions — edit the levers after creating it.</p>
        <label>Name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Faster Luspatercept ramp" />
        <label>Description (optional)</label>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's different about this case?" />
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() => onCreate({ name: name.trim(), description, assumptions_override: {} })}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
