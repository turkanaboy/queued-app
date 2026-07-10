/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { EmptyState, ScreenHeader, SectionTitle } from '../lib/queuedDesign'
import { createParty, getUserParties } from '../lib/parties'

export default function PartiesPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [parties, setParties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMode, setNewMode] = useState('curated')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [loadError, setLoadError] = useState('')

  const uid = session?.user?.id

  const fetchParties = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await getUserParties(uid)
      setParties(data)
    } catch (error) {
      setLoadError(error.message ?? 'Could not load groups')
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => { if (uid) fetchParties() }, [uid, fetchParties])

  async function handleCreate(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setCreateError('')
    try {
      const party = await createParty(name, newMode)
      navigate(`/parties/${party.id}`)
    } catch (err) {
      setCreateError(err.message ?? 'Could not create party')
      setCreating(false)
    }
  }

  return (
    <div className="pb-5">
      <ScreenHeader title="Groups" subtitle="Curate shared lists with your people" />
      <div className="space-y-5 px-[18px]">
        {loadError && <p role="alert" className="rounded-[14px] border border-rose-300/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">{loadError} <button type="button" onClick={fetchParties} className="ml-1 underline">Retry</button></p>}

        {/* Create group */}
        {showCreate ? (
          <form onSubmit={handleCreate} className="rounded-[18px] border border-[rgba(216,168,74,0.26)] bg-[linear-gradient(135deg,rgba(216,168,74,0.16),rgba(45,212,143,0.08))] p-4 shadow-[inset_3px_0_0_rgba(216,168,74,0.48)]">
            <p className="mb-3 text-sm font-extrabold text-[#F7F1E4]">Name your group</p>
            <div className="mb-3 flex gap-2 rounded-full border border-[rgba(150,214,180,0.16)] bg-[rgba(9,46,32,0.45)] p-1">
              {[
                ['curated', 'Curated list'],
                ['rotating_picker', 'Rotating picker'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setNewMode(mode)}
                  aria-pressed={newMode === mode}
                  className={`btn-press flex-1 rounded-full px-3 py-2 text-xs font-bold ${newMode === mode ? 'bg-[#F4E9D1] text-[#052016]' : 'text-[rgba(214,240,224,0.65)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Weekend picks"
                maxLength={60}
                className="min-w-0 flex-1 rounded-full border border-[rgba(150,214,180,0.2)] bg-[rgba(9,46,32,0.6)] px-4 py-2 text-sm text-[#F7F1E4] placeholder-[rgba(214,240,224,0.35)] outline-none focus:border-[rgba(150,214,180,0.45)]"
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="btn-press shrink-0 rounded-full bg-[#F4E9D1] px-4 py-2 text-xs font-extrabold text-[#052016] disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewName(''); setNewMode('curated'); setCreateError('') }}
                className="btn-press shrink-0 rounded-full border border-[rgba(150,214,180,0.16)] px-3 py-2 text-xs font-bold text-[rgba(214,240,224,0.7)]"
              >
                Cancel
              </button>
            </div>
            {createError && (
              <p role="alert" className="mt-2 text-xs text-rose-300">{createError}</p>
            )}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-press w-full rounded-[18px] border border-[rgba(216,168,74,0.26)] bg-[linear-gradient(135deg,rgba(216,168,74,0.16),rgba(45,212,143,0.08))] p-4 shadow-[inset_3px_0_0_rgba(216,168,74,0.48)] text-left"
          >
            <p className="text-sm font-extrabold text-[#F7F1E4]">Start a group</p>
            <p className="mt-0.5 text-xs text-[rgba(214,240,224,0.58)]">
              Create a shared list your people can add to and vote on.
            </p>
          </button>
        )}

        {/* Group list */}
        <section>
          <SectionTitle count={parties.length}>Your groups</SectionTitle>
          {loading ? (
            <p className="text-sm text-[rgba(214,240,224,0.4)]">Loading…</p>
          ) : parties.length === 0 ? (
            <div className="rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]">
              <EmptyState
                title="No groups yet"
                body="Create one above or join via an invite link."
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-[18px] border border-[rgba(150,214,180,0.16)] bg-[rgba(12,62,44,0.55)] shadow-[inset_3px_0_0_rgba(184,115,51,0.62)]">
              {parties.map((party, i) => (
                <PartyCard
                  key={party.id}
                  party={party}
                  first={i === 0}
                  onClick={() => navigate(`/parties/${party.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function PartyCard({ party, first, onClick }) {
  const memberCount = party.party_members?.[0]?.count ?? 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn-press flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${first ? '' : 'border-t border-[rgba(150,214,180,0.12)]'}`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[#F7F1E4]">{party.name}</p>
        <p className="mt-0.5 text-xs text-[rgba(214,240,224,0.5)]">
          {memberCount} {memberCount === 1 ? 'member' : 'members'} · {party.mode === 'rotating_picker' ? 'Rotating picker' : 'Curated list'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <svg className="ml-1 text-[rgba(214,240,224,0.3)]" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  )
}
