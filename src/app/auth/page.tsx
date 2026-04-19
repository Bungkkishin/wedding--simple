'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function generateRoomId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

type Step = 'start' | 'login' | 'signup-name' | 'signup-room'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('start')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [roomMode, setRoomMode] = useState<'create' | 'join'>('create')
  const [coupleName, setCoupleName] = useState('')
  const [weddingDate, setWeddingDate] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError('이메일 또는 비밀번호를 확인해주세요'); setLoading(false); return }
    window.location.href = '/room'
  }

  async function handleSignup() {
    setLoading(true); setError('')
    let roomId = ''
    if (roomMode === 'create') {
      roomId = generateRoomId()
      const { error: roomErr } = await supabase.from('rooms').insert({
        id: roomId, name: coupleName.trim() || '우리의 웨딩', wedding_date: weddingDate || null,
      })
      if (roomErr) { setError('방 만들기 실패: ' + roomErr.message); setLoading(false); return }
      await supabase.rpc('seed_checklist', { p_room_id: roomId })
    } else {
      roomId = joinCode.trim().toLowerCase()
      const { data: room } = await supabase.from('rooms').select('id').eq('id', roomId).single()
      if (!room) { setError(`'${roomId}' 코드를 찾을 수 없어요`); setLoading(false); return }
    }
    const { data, error: signupErr } = await supabase.auth.signUp({ email, password })
    if (signupErr) { setError(signupErr.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('profiles').insert({ id: data.user.id, room_id: roomId, display_name: name.trim() })
    }
    window.location.href = '/room'
  }

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-50 rounded-full blur-3xl opacity-60 translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-stone-100 rounded-full blur-3xl opacity-60 -translate-x-1/2 translate-y-1/2" />
      </div>
      <div className="relative w-full max-w-sm fade-up">
        <div className="text-center mb-8">
          <p className="text-xs tracking-[.25em] text-stone-400 uppercase mb-2">Wedding Checklist</p>
          <h1 className="font-serif text-5xl">💍</h1>
        </div>

        {step === 'start' && (
          <div className="space-y-3">
            <button onClick={() => setStep('signup-name')} className="w-full py-4 bg-rose-500 text-white rounded-2xl text-sm font-medium hover:bg-rose-600 transition-colors">처음 시작하기</button>
            <button onClick={() => setStep('login')} className="w-full py-4 bg-white border border-stone-200 text-stone-700 rounded-2xl text-sm font-medium hover:bg-stone-50 transition-colors">이미 계정이 있어요</button>
          </div>
        )}

        {step === 'login' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 space-y-4">
            <h2 className="font-serif text-2xl font-light text-stone-800">로그인</h2>
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">이메일</label>
              <input type="email" className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm" placeholder="hello@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">비밀번호</label>
              <input type="password" className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            {error && <p className="text-xs text-rose-500 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={handleLogin} disabled={loading || !email || !password} className="w-full py-3.5 bg-rose-500 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-rose-600 transition-colors">{loading ? '로그인 중...' : '로그인'}</button>
            <button onClick={() => { setStep('start'); setError('') }} className="w-full text-xs text-stone-400 hover:text-stone-600">뒤로</button>
          </div>
        )}

        {step === 'signup-name' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 space-y-4">
            <h2 className="font-serif text-2xl font-light text-stone-800">내 정보</h2>
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">이름</label>
              <input className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm" placeholder="예: 신부 지수" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">이메일</label>
              <input type="email" className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm" placeholder="hello@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1.5">비밀번호</label>
              <input type="password" className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm" placeholder="6자 이상" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-xs text-rose-500 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={() => { if (!name.trim() || !email || !password) { setError('모두 입력해주세요'); return } setError(''); setStep('signup-room') }} className="w-full py-3.5 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors">다음 →</button>
            <button onClick={() => { setStep('start'); setError('') }} className="w-full text-xs text-stone-400 hover:text-stone-600">뒤로</button>
          </div>
        )}

        {step === 'signup-room' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 space-y-4">
            <h2 className="font-serif text-2xl font-light text-stone-800">방 설정</h2>
            <div className="flex rounded-xl border border-stone-200 overflow-hidden text-sm">
              <button onClick={() => setRoomMode('create')} className={`flex-1 py-2.5 font-medium transition-colors ${roomMode === 'create' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:bg-stone-50'}`}>새 방 만들기</button>
              <button onClick={() => setRoomMode('join')} className={`flex-1 py-2.5 font-medium transition-colors ${roomMode === 'join' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:bg-stone-50'}`}>코드로 참여</button>
            </div>
            {roomMode === 'create' && (
              <>
                <div>
                  <label className="block text-xs text-stone-400 mb-1.5">커플 이름 (선택)</label>
                  <input className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm" placeholder="예: 민준 ♥ 지수" value={coupleName} onChange={e => setCoupleName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-stone-400 mb-1.5">결혼 예정일 (선택)</label>
                  <input type="date" className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} />
                </div>
                <p className="text-xs text-stone-400 bg-stone-50 rounded-lg px-3 py-2">방을 만들면 6자리 초대 코드가 생성돼요. 파트너한테 공유하면 같이 볼 수 있어요!</p>
              </>
            )}
            {roomMode === 'join' && (
              <div>
                <label className="block text-xs text-stone-400 mb-1.5">초대 코드 (6자리)</label>
                <input className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-center" placeholder="abc123" value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={6} />
                <p className="text-xs text-stone-400 mt-1.5">파트너에게 초대 코드를 받으세요</p>
              </div>
            )}
            {error && <p className="text-xs text-rose-500 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={handleSignup} disabled={loading} className="w-full py-3.5 bg-rose-500 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-rose-600 transition-colors">{loading ? '처리 중...' : roomMode === 'create' ? '방 만들고 시작하기 🎉' : '참여하기 →'}</button>
            <button onClick={() => { setStep('signup-name'); setError('') }} className="w-full text-xs text-stone-400 hover:text-stone-600">뒤로</button>
          </div>
        )}
      </div>
    </main>
  )
}
