'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient, ChecklistItem, Vendor, BudgetItem, Profile, Room, PHASES, ASSIGNEES, VENDOR_CATEGORIES, VENDOR_STATUS, BUDGET_CATEGORIES } from '@/lib/supabase'
import { differenceInDays, parseISO } from 'date-fns'

interface Props {
  initialItems: ChecklistItem[]
  profile: Profile & { display_name: string }
  room: Room
}

type Tab = 'checklist' | 'vendors' | 'budget'

const ASSIGNEE_COLOR: Record<string, string> = {
  '신랑': 'bg-blue-100 text-blue-700',
  '신부': 'bg-pink-100 text-pink-700',
  '신랑측': 'bg-sky-100 text-sky-700',
  '신부측': 'bg-rose-100 text-rose-700',
  '양가': 'bg-purple-100 text-purple-700',
}

function fmt(n: number) { return n > 0 ? n.toLocaleString('ko-KR') : '' }

export default function ChecklistClient({ initialItems, profile, room }: Props) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('checklist')
  const [items, setItems] = useState<ChecklistItem[]>(initialItems)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<ChecklistItem | null>(null)
  const [editMemo, setEditMemo] = useState('')
  const [editAssignee, setEditAssignee] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Add checklist item
  const [showAddItem, setShowAddItem] = useState(false)
  const [newPhase, setNewPhase] = useState(PHASES[0])
  const [newTitle, setNewTitle] = useState('')

  // Vendor form
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [vForm, setVForm] = useState({ category: VENDOR_CATEGORIES[0], name: '', contact: '', memo: '', status: 'searching', customCategory: '' })

  // Budget form
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null)
  const [bForm, setBForm] = useState({ category: BUDGET_CATEGORIES[0], schedule: '', label: '', planned: '', deposit: '', balance: '', total: '', groom: '', bride: '', status: '미정', note: '' })

  const dday = room.wedding_date ? differenceInDays(parseISO(room.wedding_date), new Date()) : null

  useEffect(() => {
    supabase.from('vendors').select('*').eq('room_id', room.id).order('created_at').then(r => r.data && setVendors(r.data))
    supabase.from('budget_items').select('*').eq('room_id', room.id).order('sort_order').then(r => r.data && setBudgetItems(r.data))
  }, [room.id])

  useEffect(() => {
    const ch = supabase.channel('room-' + room.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checklist_items', filter: `room_id=eq.${room.id}` },
        payload => setItems(prev => prev.map(i => i.id === payload.new.id ? payload.new as ChecklistItem : i)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors', filter: `room_id=eq.${room.id}` },
        () => supabase.from('vendors').select('*').eq('room_id', room.id).order('created_at').then(r => r.data && setVendors(r.data)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_items', filter: `room_id=eq.${room.id}` },
        () => supabase.from('budget_items').select('*').eq('room_id', room.id).order('sort_order').then(r => r.data && setBudgetItems(r.data)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [room.id])

  function copyCode() {
    navigator.clipboard.writeText(room.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const togglePhase = (phase: string) => {
    setExpanded(prev => { const s = new Set(prev); s.has(phase) ? s.delete(phase) : s.add(phase); return s })
  }

  const toggleCheck = useCallback(async (item: ChecklistItem) => {
    const checked = !item.checked
    const now = new Date().toISOString()
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked, checked_by: checked ? profile.display_name : null, checked_at: checked ? now : null } : i))
    setSavingId(item.id)
    await supabase.from('checklist_items').update({ checked, checked_by: checked ? profile.display_name : null, checked_at: checked ? now : null }).eq('id', item.id)
    setSavingId(null)
  }, [profile.display_name])

  const saveEdit = async () => {
    if (!editing) return
    await supabase.from('checklist_items').update({ memo: editMemo || null, assignee: editAssignee || null }).eq('id', editing.id)
    setItems(prev => prev.map(i => i.id === editing.id ? { ...i, memo: editMemo || null, assignee: editAssignee || null } : i))
    setEditing(null)
  }

  async function addItem() {
    if (!newTitle.trim()) return
    const maxOrder = items.filter(i => i.phase === newPhase).reduce((a, i) => Math.max(a, i.sort_order), 0)
    const { data } = await supabase.from('checklist_items').insert({ room_id: room.id, phase: newPhase, title: newTitle.trim(), sort_order: maxOrder + 1 }).select().single()
    if (data) setItems(prev => [...prev, data])
    setNewTitle('')
    setShowAddItem(false)
  }

  async function deleteItem(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('checklist_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  // Vendor handlers
  function openVendorForm(v?: Vendor) {
    if (v) {
      setEditingVendor(v)
      setVForm({ category: VENDOR_CATEGORIES.includes(v.category) ? v.category : '기타', name: v.name, contact: v.contact || '', memo: v.memo || '', status: v.status, customCategory: VENDOR_CATEGORIES.includes(v.category) ? '' : v.category })
    } else {
      setEditingVendor(null)
      setVForm({ category: VENDOR_CATEGORIES[0], name: '', contact: '', memo: '', status: 'searching', customCategory: '' })
    }
    setShowVendorForm(true)
  }

  async function saveVendor() {
    if (!vForm.name.trim()) return
    const cat = vForm.category === '기타' && vForm.customCategory ? vForm.customCategory : vForm.category
    const payload = { room_id: room.id, category: cat, name: vForm.name.trim(), contact: vForm.contact || null, memo: vForm.memo || null, status: vForm.status }
    if (editingVendor) {
      const { data } = await supabase.from('vendors').update(payload).eq('id', editingVendor.id).select().single()
      if (data) setVendors(prev => prev.map(v => v.id === editingVendor.id ? data : v))
    } else {
      const { data } = await supabase.from('vendors').insert(payload).select().single()
      if (data) setVendors(prev => [...prev, data])
    }
    setShowVendorForm(false)
  }

  async function deleteVendor(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('vendors').delete().eq('id', id)
    setVendors(prev => prev.filter(v => v.id !== id))
  }

  // Budget handlers
  function openBudgetForm(b?: BudgetItem) {
    if (b) {
      setEditingBudget(b)
      setBForm({ category: b.category, schedule: b.schedule || '', label: b.label, planned: b.planned ? String(b.planned) : '', deposit: b.deposit ? String(b.deposit) : '', balance: b.balance ? String(b.balance) : '', total: b.total ? String(b.total) : '', groom: b.groom ? String(b.groom) : '', bride: b.bride ? String(b.bride) : '', status: b.status, note: b.note || '' })
    } else {
      setEditingBudget(null)
      setBForm({ category: BUDGET_CATEGORIES[0], schedule: '', label: '', planned: '', deposit: '', balance: '', total: '', groom: '', bride: '', status: '미정', note: '' })
    }
    setShowBudgetForm(true)
  }

  async function saveBudget() {
    if (!bForm.label.trim()) return
    const payload = {
      room_id: room.id, category: bForm.category, schedule: bForm.schedule || null,
      label: bForm.label.trim(), planned: parseInt(bForm.planned) || 0,
      deposit: parseInt(bForm.deposit) || 0, balance: parseInt(bForm.balance) || 0,
      total: parseInt(bForm.total) || 0, groom: parseInt(bForm.groom) || 0,
      bride: parseInt(bForm.bride) || 0, status: bForm.status, note: bForm.note || null,
      sort_order: editingBudget ? editingBudget.sort_order : budgetItems.length,
    }
    if (editingBudget) {
      const { data } = await supabase.from('budget_items').update(payload).eq('id', editingBudget.id).select().single()
      if (data) setBudgetItems(prev => prev.map(b => b.id === editingBudget.id ? data : b))
    } else {
      const { data } = await supabase.from('budget_items').insert(payload).select().single()
      if (data) setBudgetItems(prev => [...prev, data])
    }
    setShowBudgetForm(false)
  }

  async function deleteBudget(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('budget_items').delete().eq('id', id)
    setBudgetItems(prev => prev.filter(b => b.id !== id))
  }

  const total = items.length
  const done = items.filter(i => i.checked).length
  const pct = total > 0 ? Math.round(done / total * 100) : 0
  const usedPhases = PHASES.filter(p => items.some(i => i.phase === p))

  const totalPlanned = budgetItems.reduce((a, b) => a + b.planned, 0)
  const totalTotal = budgetItems.reduce((a, b) => a + b.total, 0)

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl text-stone-800">{room.name}</h1>
            <p className="text-xs text-stone-400">{profile.display_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
                <circle cx="20" cy="20" r="16" fill="none" stroke="#f5f5f4" strokeWidth="3.5"/>
                <circle cx="20" cy="20" r="16" fill="none" stroke="#f43f5e" strokeWidth="3.5" strokeDasharray={`${pct * 1.005} 100.5`} strokeLinecap="round"/>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-rose-500">{pct}%</span>
            </div>
            <button onClick={() => { supabase.auth.signOut(); window.location.href = '/auth' }} className="text-xs text-stone-400 hover:text-stone-600">로그아웃</button>
          </div>
        </div>

        {/* Invite + D-Day */}
        <div className="border-t border-stone-50 bg-stone-50/60">
          <div className="max-w-3xl mx-auto px-4 py-1.5 flex items-center gap-2">
            <span className="text-xs text-stone-400">초대 코드:</span>
            <button onClick={copyCode} className="font-mono text-xs bg-white border border-stone-200 text-stone-600 px-2 py-0.5 rounded-md hover:bg-stone-100 tracking-widest">{room.id}</button>
            <span className="text-xs text-stone-400">{copied ? '✓ 복사됨!' : '← 파트너에게 공유'}</span>
            {dday !== null && (
              <span className="ml-auto font-serif text-sm text-rose-500">
                {dday > 0 ? `D-${dday}` : dday === 0 ? 'D-DAY' : `D+${Math.abs(dday)}`}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-3xl mx-auto px-4 flex border-t border-stone-50">
          {(['checklist','vendors','budget'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-medium relative transition-colors ${tab === t ? 'text-rose-500' : 'text-stone-400 hover:text-stone-600'}`}>
              {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-400 rounded-t" />}
              {t === 'checklist' ? '체크리스트' : t === 'vendors' ? '업체정리' : '예산표'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">

        {/* ── CHECKLIST TAB ── */}
        {tab === 'checklist' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-stone-100 px-4 py-3 flex items-center justify-between gap-4">
              <div className="text-sm text-stone-500"><span className="text-stone-800 font-medium">{done}</span> / {total} 완료</div>
              <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-rose-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-sm font-medium text-rose-500">{pct}%</div>
            </div>

            <button onClick={() => setShowAddItem(true)} className="w-full py-2.5 border border-dashed border-stone-300 rounded-2xl text-xs text-stone-400 hover:bg-stone-50 hover:text-stone-600 transition-colors">
              + 항목 추가
            </button>

            {usedPhases.map(phase => {
              const phaseItems = items.filter(i => i.phase === phase)
              const phaseDone = phaseItems.filter(i => i.checked).length
              const phaseTotal = phaseItems.length
              const phasePct = phaseTotal > 0 ? Math.round(phaseDone / phaseTotal * 100) : 0
              const allDone = phaseDone === phaseTotal
              const open = expanded.has(phase)
              return (
                <div key={phase} className={`bg-white rounded-2xl border overflow-hidden ${allDone ? 'border-green-100' : 'border-stone-100'}`}>
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
                          <button onClick={() => toggleCheck(item)} disabled={savingId === item.id}
                            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${item.checked ? 'bg-rose-500 border-rose-500' : 'border-stone-300 hover:border-rose-400'} ${savingId === item.id ? 'opacity-50' : ''}`}>
                            {item.checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`text-sm ${item.checked ? 'line-through text-stone-400' : 'text-stone-700'}`}>{item.title}</span>
                              {item.assignee && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ASSIGNEE_COLOR[item.assignee] || 'bg-stone-100 text-stone-500'}`}>{item.assignee}</span>}
                            </div>
                            {item.memo && <p className="text-xs text-stone-400 mt-0.5 truncate">{item.memo}</p>}
                            {item.checked && item.checked_by && <p className="text-[10px] text-stone-300 mt-0.5">{item.checked_by} 완료</p>}
                          </div>
                          <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                            <button onClick={() => { setEditing(item); setEditMemo(item.memo || ''); setEditAssignee(item.assignee || '') }} className="text-stone-300 hover:text-stone-500 text-sm px-1">✎</button>
                            <button onClick={() => deleteItem(item.id)} className="text-stone-300 hover:text-red-400 text-sm px-1">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── VENDORS TAB ── */}
        {tab === 'vendors' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={() => openVendorForm()} className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-medium hover:bg-rose-600 transition-colors">+ 업체 추가</button>
            </div>
            {vendors.length === 0 ? (
              <div className="text-center py-16 text-stone-300">
                <p className="text-xl mb-1">업체를 추가해보세요</p>
                <p className="text-xs">메이크업, 드레스, 스냅 등</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {vendors.map(v => (
                  <div key={v.id} className="bg-white rounded-2xl border border-stone-100 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{v.category}</span>
                        <h3 className="font-medium text-stone-800 mt-1">{v.name}</h3>
                        {v.contact && <p className="text-xs text-stone-400">{v.contact}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openVendorForm(v)} className="text-stone-300 hover:text-stone-500 text-xs p-1">✎</button>
                        <button onClick={() => deleteVendor(v.id)} className="text-stone-300 hover:text-red-400 text-xs p-1">✕</button>
                      </div>
                    </div>
                    {v.memo && <p className="text-xs text-stone-400 bg-stone-50 rounded-lg px-3 py-2 mb-2">{v.memo}</p>}
                    <div className="flex gap-1.5 flex-wrap">
                      {Object.entries(VENDOR_STATUS).map(([key, { label, color }]) => (
                        <button key={key}
                          onClick={async () => { await supabase.from('vendors').update({ status: key }).eq('id', v.id); setVendors(prev => prev.map(x => x.id === v.id ? { ...x, status: key } : x)) }}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${v.status === key ? 'ring-1 ring-stone-400 ' + color : color + ' opacity-40'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BUDGET TAB ── */}
        {tab === 'budget' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-stone-100 p-3 text-center">
                <p className="text-xs text-stone-400 mb-1">총 예산</p>
                <p className="text-sm font-medium text-stone-700">{totalPlanned.toLocaleString()}원</p>
              </div>
              <div className="bg-white rounded-2xl border border-stone-100 p-3 text-center">
                <p className="text-xs text-stone-400 mb-1">총 금액</p>
                <p className="text-sm font-medium text-rose-500">{totalTotal.toLocaleString()}원</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => openBudgetForm()} className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-medium hover:bg-rose-600 transition-colors">+ 항목 추가</button>
            </div>

            {BUDGET_CATEGORIES.map(cat => {
              const catItems = budgetItems.filter(b => b.category === cat)
              if (catItems.length === 0) return null
              const catPlanned = catItems.reduce((a, b) => a + b.planned, 0)
              const catTotal = catItems.reduce((a, b) => a + b.total, 0)
              return (
                <div key={cat} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                  <div className="px-4 py-3 bg-stone-50 flex items-center justify-between">
                    <span className="text-xs font-medium text-stone-600">{cat}</span>
                    <span className="text-xs text-stone-400">예산 {catPlanned.toLocaleString()}원 / 총 {catTotal.toLocaleString()}원</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-stone-50">
                          {['스케줄','항목','예산','예약금','잔금','총금액','신랑','신부','진행상황','자세히',''].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-stone-400 font-normal whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {catItems.map(b => (
                          <tr key={b.id} className="hover:bg-stone-50/50 group">
                            <td className="px-3 py-2 text-stone-400 whitespace-nowrap">{b.schedule}</td>
                            <td className="px-3 py-2 text-stone-700 font-medium whitespace-nowrap">{b.label}</td>
                            <td className="px-3 py-2 text-stone-500 whitespace-nowrap">{fmt(b.planned)}</td>
                            <td className="px-3 py-2 text-stone-500 whitespace-nowrap">{fmt(b.deposit)}</td>
                            <td className="px-3 py-2 text-stone-500 whitespace-nowrap">{fmt(b.balance)}</td>
                            <td className="px-3 py-2 font-medium text-stone-700 whitespace-nowrap">{fmt(b.total)}</td>
                            <td className="px-3 py-2 text-stone-500 whitespace-nowrap">{fmt(b.groom)}</td>
                            <td className="px-3 py-2 text-stone-500 whitespace-nowrap">{fmt(b.bride)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${b.status === '예약완료' ? 'bg-green-100 text-green-700' : b.status === '완료' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-500'}`}>{b.status}</span>
                            </td>
                            <td className="px-3 py-2 text-stone-400 max-w-[120px] truncate">{b.note}</td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openBudgetForm(b)} className="text-stone-300 hover:text-stone-500">✎</button>
                                <button onClick={() => deleteBudget(b.id)} className="text-stone-300 hover:text-red-400">✕</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-stone-50/60 font-medium">
                          <td className="px-3 py-2 text-stone-500" colSpan={2}>총 비용</td>
                          <td className="px-3 py-2 text-stone-600">{catPlanned.toLocaleString()}</td>
                          <td className="px-3 py-2 text-stone-600">{catItems.reduce((a,b)=>a+b.deposit,0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-stone-600">{catItems.reduce((a,b)=>a+b.balance,0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-rose-500">{catTotal.toLocaleString()}</td>
                          <td className="px-3 py-2 text-stone-600">{catItems.reduce((a,b)=>a+b.groom,0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-stone-600">{catItems.reduce((a,b)=>a+b.bride,0).toLocaleString()}</td>
                          <td colSpan={3}/>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}

            {/* 카테고리 없는 항목 */}
            {budgetItems.filter(b => !BUDGET_CATEGORIES.includes(b.category)).length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                <div className="px-4 py-3 bg-stone-50"><span className="text-xs font-medium text-stone-600">기타</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-stone-50">
                      {budgetItems.filter(b => !BUDGET_CATEGORIES.includes(b.category)).map(b => (
                        <tr key={b.id} className="hover:bg-stone-50/50 group">
                          <td className="px-3 py-2 text-stone-400">{b.schedule}</td>
                          <td className="px-3 py-2 font-medium text-stone-700">{b.label}</td>
                          <td className="px-3 py-2 text-stone-500">{fmt(b.total)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                              <button onClick={() => openBudgetForm(b)} className="text-stone-300 hover:text-stone-500">✎</button>
                              <button onClick={() => deleteBudget(b.id)} className="text-stone-300 hover:text-red-400">✕</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── 항목 추가 모달 ── */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-end sm:items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowAddItem(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 fade-up">
            <h3 className="font-serif text-xl text-stone-800">항목 추가</h3>
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">단계</label>
              <select className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-white text-stone-700" value={newPhase} onChange={e => setNewPhase(e.target.value)}>
                {PHASES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">항목명</label>
              <input className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="예: 웨딩카 예약" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddItem(false)} className="flex-1 py-3 border border-stone-200 rounded-xl text-sm text-stone-500">취소</button>
              <button onClick={addItem} disabled={!newTitle.trim()} className="flex-1 py-3 bg-rose-500 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-rose-600">추가</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 체크리스트 편집 모달 ── */}
      {editing && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-end sm:items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 fade-up">
            <h3 className="font-serif text-xl text-stone-800">{editing.title}</h3>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-2">담당자</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditAssignee('')} className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${!editAssignee ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500'}`}>없음</button>
                {ASSIGNEES.map(a => <button key={a} onClick={() => setEditAssignee(a)} className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${editAssignee === a ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500'}`}>{a}</button>)}
              </div>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-2">메모</p>
              <textarea className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 resize-none focus:border-rose-300" rows={3} placeholder="메모를 남겨보세요..." value={editMemo} onChange={e => setEditMemo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 border border-stone-200 rounded-xl text-sm text-stone-500">취소</button>
              <button onClick={saveEdit} className="flex-1 py-3 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 업체 폼 모달 ── */}
      {showVendorForm && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-end sm:items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowVendorForm(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-3 fade-up max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-xl text-stone-800">{editingVendor ? '업체 수정' : '업체 추가'}</h3>
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">카테고리</label>
              <div className="flex flex-wrap gap-2">
                {VENDOR_CATEGORIES.map(c => <button key={c} onClick={() => setVForm(f => ({...f, category: c}))} className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${vForm.category === c ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500'}`}>{c}</button>)}
              </div>
              {vForm.category === '기타' && (
                <input className="mt-2 w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-700 focus:border-rose-300" placeholder="카테고리 직접 입력" value={vForm.customCategory} onChange={e => setVForm(f => ({...f, customCategory: e.target.value}))} />
              )}
            </div>
            <div><label className="block text-xs text-stone-400 mb-1.5">업체명 *</label><input className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="예: OO 스튜디오" value={vForm.name} onChange={e => setVForm(f => ({...f, name: e.target.value}))} /></div>
            <div><label className="block text-xs text-stone-400 mb-1.5">연락처</label><input className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="010-0000-0000" value={vForm.contact} onChange={e => setVForm(f => ({...f, contact: e.target.value}))} /></div>
            <div><label className="block text-xs text-stone-400 mb-1.5">메모</label><textarea className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 resize-none focus:border-rose-300" rows={2} placeholder="특이사항 등..." value={vForm.memo} onChange={e => setVForm(f => ({...f, memo: e.target.value}))} /></div>
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">상태</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(VENDOR_STATUS).map(([key, {label}]) => <button key={key} onClick={() => setVForm(f => ({...f, status: key}))} className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${vForm.status === key ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500'}`}>{label}</button>)}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowVendorForm(false)} className="flex-1 py-3 border border-stone-200 rounded-xl text-sm text-stone-500">취소</button>
              <button onClick={saveVendor} disabled={!vForm.name.trim()} className="flex-1 py-3 bg-rose-500 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-rose-600">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 예산 폼 모달 ── */}
      {showBudgetForm && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-end sm:items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowBudgetForm(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-3 fade-up max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-xl text-stone-800">{editingBudget ? '항목 수정' : '예산 항목 추가'}</h3>
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">구분</label>
              <select className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-white text-stone-700" value={bForm.category} onChange={e => setBForm(f => ({...f, category: e.target.value}))}>
                {BUDGET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                <option>기타</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-stone-400 mb-1.5">스케줄</label><input className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="22.3.20" value={bForm.schedule} onChange={e => setBForm(f => ({...f, schedule: e.target.value}))} /></div>
              <div><label className="block text-xs text-stone-400 mb-1.5">항목명 *</label><input className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="상견례" value={bForm.label} onChange={e => setBForm(f => ({...f, label: e.target.value}))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-stone-400 mb-1.5">예산(예상)</label><input type="number" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="400000" value={bForm.planned} onChange={e => setBForm(f => ({...f, planned: e.target.value}))} /></div>
              <div><label className="block text-xs text-stone-400 mb-1.5">예약금</label><input type="number" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="0" value={bForm.deposit} onChange={e => setBForm(f => ({...f, deposit: e.target.value}))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-stone-400 mb-1.5">잔금</label><input type="number" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="0" value={bForm.balance} onChange={e => setBForm(f => ({...f, balance: e.target.value}))} /></div>
              <div><label className="block text-xs text-stone-400 mb-1.5">총금액</label><input type="number" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="400000" value={bForm.total} onChange={e => setBForm(f => ({...f, total: e.target.value}))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-stone-400 mb-1.5">신랑</label><input type="number" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="0" value={bForm.groom} onChange={e => setBForm(f => ({...f, groom: e.target.value}))} /></div>
              <div><label className="block text-xs text-stone-400 mb-1.5">신부</label><input type="number" className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="0" value={bForm.bride} onChange={e => setBForm(f => ({...f, bride: e.target.value}))} /></div>
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">진행상황</label>
              <div className="flex gap-2">
                {['미정','예약완료','완료'].map(s => <button key={s} onClick={() => setBForm(f => ({...f, status: s}))} className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${bForm.status === s ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500'}`}>{s}</button>)}
              </div>
            </div>
            <div><label className="block text-xs text-stone-400 mb-1.5">자세히</label><input className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:border-rose-300" placeholder="메모" value={bForm.note} onChange={e => setBForm(f => ({...f, note: e.target.value}))} /></div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowBudgetForm(false)} className="flex-1 py-3 border border-stone-200 rounded-xl text-sm text-stone-500">취소</button>
              <button onClick={saveBudget} disabled={!bForm.label.trim()} className="flex-1 py-3 bg-rose-500 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-rose-600">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
