'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, ChecklistItem, Profile, Room, PHASES, ASSIGNEES } from '@/lib/supabase'
import { differenceInDays, parseISO } from 'date-fns'

interface Props {
  initialItems: ChecklistItem[]
  profile: Profile & { display_name: string }
  room: Room
}

const ASSIGNEE_COLOR: Record<string, string> = {
  '신랑':   'bg-blue-100 text-blue-700',
  '신부':   'bg-pink-100 text-pink-700',
  '신랑측': 'bg-sky-100 text-sky-700',
  '신부측': 'bg-rose-100 text-rose-700',
  '양가':   'bg-purple-100 text-purple-700',
}

export default function ChecklistClient({ initialItems, profile, room }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [items, setItems] = useState<ChecklistItem[]>(initialItems)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<ChecklistItem | null>(null)
  const [editMemo, setEditMemo] = useState('')
  const [editAssignee, setEditAssignee] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(room.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dday = room.wedding_date
    ? differenceInDays(parseISO(room.wedding_date), new Date())
    : null

  useEffect(() => {
    const ch = supabase.channel('checklist-' + room.id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'checklist_items',
        filter: `room_id=eq.${room.id}`,
      }, payload => {
        setItems(prev => prev.map(i => i.id === payload.new.id ? payload.new as ChecklistItem : i))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [room.id])

  const togglePhase = (phase: string) => {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(phase) ? s.delete(phase) : s.add(phase)
      return s
    })
  }

  const toggleCheck = useCallback(async (item: ChecklistItem) => {
    const checked = !item.checked
    const now = new Date().toISOString()
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked, checked_by: checked ? profile.display_name : null, checked_at: checked ? now : null } : i))
    setSavingId(item.id)
    await supabase.from('checklist_items').update({
      checked,
      checked_by: checked ? profile.display_name : null,
      checked_at: checked ? now : null,
    }).eq('id', item.id)
    setSavingId(null)
  }, [profile.display_name])

  const openEdit = (item: ChecklistItem) => {
    setEditing(item)
    setEditMemo(item.memo || '')
    setEditAssignee(item.assignee || '')
  }

  const saveEdit = async () => {
    if (!editing) return
    await supabase.from('checklist_items').update({
      memo: editMemo || null,
      assignee: editAssignee || null,
    }).eq('id', editing.id)
    setItems(prev => prev.map(i => i.id === editing.id
      ? { ...i, memo: editMemo || null, assignee: editAssignee || null } : i))
    setEditing(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  const total = items.length
  const done = items.filter(i => i.checked).length
  const pct = total > 0 ? Math.round(done / total * 100) : 0
  const usedPhases = PHASES.filter(p => items.some(i => i.phase === p))

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl text-stone-800">{room.name}</h1>
            <p className="text-xs text-stone-400">{profile.display_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
                <circle cx="20" cy="20" r="16" fill="none" stroke="#f5f5f4" strokeWidth="3.5"/>
                <circle cx="20" cy="20" r="16" fill="none" stroke="#f43f5e" strokeWidth="3.5"
                  strokeDasharray={`${pct * 1.005} 100.5`} strokeLinecap="round"/>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-rose-500">{pct}%</span>
            </div>
            <button onClick={handleLogout} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">로그아웃</button>
          </div>
        </div>
        <div className="border-t border-stone-50 bg-stone-50/60">
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-2">
            <span className="text-xs text-stone-400">초대 코드:</span>
            <button onClick={copyCode} className="font-mono text-xs bg-white border border-stone-200 text-stone-600 px-2.5 py-1 rounded-md hover:bg-stone-100 transition-colors tracking-widest">
              {room.id}
            </button>
            <span className="text-xs text-stone-400">{copied ? '✓ 복사됨!' : '← 파트너에게 공유하세요'}</span>
          </div>
        </div>
        {dday !== null && (
          <div className="border-t border-stone-50 bg-rose-50/60">
            <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-3">
              <span className="font-serif text-lg text-rose-500">
                {dday > 0 ? `D - ${dday}` : dday === 0 ? 'D - DAY' : `D + ${Math.abs(dday)}`}
              </span>
              <span className="text-xs text-stone-400">
                {dday > 0 ? `결혼식까지 ${dday}일` : dday === 0 ? '오늘이 결혼식!' : `결혼 ${Math.abs(dday)}일째`}
              </span>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        <div className="bg-white rounded-2xl border border-stone-100 px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-sm text-stone-500">
            <span className="text-stone-800 font-medium">{done}</span> / {total} 완료
          </div>
          <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-rose-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-sm font-medium text-rose-500">{pct}%</div>
        </div>

        {usedPhases.map(phase => {
          const phaseItems = items.filter(i => i.phase === phase)
          if (phaseItems.length === 0) return null
          const phaseDone = phaseItems.filter(i => i.checked).length
          const phaseTotal = phaseItems.length
          const phasePct = phaseTotal > 0 ? Math.round(phaseDone / phaseTotal * 100) : 0
          const allDone = phaseDone === phaseTotal
          const open = expanded.has(phase)

          return (
            <div key={phase} className={`bg-white rounded-2xl border overflow-hidden transition-colors ${allDone ? 'border-green-100' : 'border-stone-100'}`}>
              <button onClick={() => togglePhase(phase)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-stone-50/70 transition-colors">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${allDone ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>{phase}</span>
                <div className="flex-1 h-1 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-300 rounded-full transition-all" style={{ width: `${phasePct}%` }} />
                </div>
                <span className="text-xs text-stone-400 shrink-0">{phaseDone}/{phaseTotal}</span>
                <span className="text-stone-300 text-xs">{open ? '▲' : '▽'}</span>
              </button>

              {open && (
                <div className="border-t border-stone-50 divide-y divide-stone-50">
                  {phaseItems.map(item => (
                    <div key={item.id} className={`flex items-start gap-3 px-4 py-3 group ${item.checked ? 'bg-stone-50/40' : ''}`}>
                      <button
                        onClick={() => toggleCheck(item)}
                        disabled={savingId === item.id}
                        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          item.checked ? 'bg-rose-500 border-rose-500' : 'border-stone-300 hover:border-rose-400'
                        } ${savingId === item.id ? 'opacity-50' : ''}`}
                      >
                        {item.checked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                            <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-sm ${item.checked ? 'line-through text-stone-400' : 'text-stone-700'}`}>{item.title}</span>
                          {item.assignee && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ASSIGNEE_COLOR[item.assignee] || 'bg-stone-100 text-stone-500'}`}>{item.assignee}</span>
                          )}
                        </div>
                        {item.memo && <p className="text-xs text-stone-400 mt-0.5 truncate">{item.memo}</p>}
                        {item.checked && item.checked_by && (
                          <p className="text-[10px] text-stone-300 mt-0.5">{item.checked_by} 완료</p>
                        )}
                      </div>
                      <button onClick={() => openEdit(item)} className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 hover:text-stone-500 text-sm px-1">✎</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </main>

      {editing && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 fade-up">
            <h3 className="font-serif text-xl text-stone-800">{editing.title}</h3>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-2">담당자</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditAssignee('')}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${!editAssignee ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500'}`}>없음</button>
                {ASSIGNEES.map(a => (
                  <button key={a} onClick={() => setEditAssignee(a)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${editAssignee === a ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500'}`}>{a}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-2">메모</p>
              <textarea className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 resize-none focus:border-rose-300 transition-colors"
                rows={3} placeholder="메모를 남겨보세요..." value={editMemo} onChange={e => setEditMemo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 border border-stone-200 rounded-xl text-sm text-stone-500 hover:bg-stone-50">취소</button>
              <button onClick={saveEdit} className="flex-1 py-3 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
