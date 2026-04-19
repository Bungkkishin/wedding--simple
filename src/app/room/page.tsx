'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, ChecklistItem, Profile, Room } from '@/lib/supabase'
import ChecklistClient from '@/components/ChecklistClient'

export default function RoomPage() {
  const supabase = createClient()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [room, setRoom] = useState<Room | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/auth'; return }

      const { data: prof } = await supabase
        .from('profiles').select('*, rooms(*)').eq('id', session.user.id).single()
      if (!prof?.room_id) { window.location.href = '/auth'; return }

      const { data: its } = await supabase
        .from('checklist_items').select('*').eq('room_id', prof.room_id).order('sort_order')

      setProfile(prof)
      setRoom(prof.rooms as Room)
      setItems(its || [])
      setReady(true)
    }
    load()
  }, [])

  if (!ready) return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-7 h-7 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-stone-400">불러오는 중...</p>
      </div>
    </main>
  )

  return <ChecklistClient initialItems={items} profile={profile} room={room!} />
}
