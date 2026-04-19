import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ChecklistClient from '@/components/ChecklistClient'

export default async function RoomPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth')

  // Load profile + room
  const { data: profile } = await supabase
    .from('profiles').select('*, rooms(*)').eq('id', session.user.id).single()

  if (!profile?.room_id) redirect('/auth')

  const { data: items } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('room_id', profile.room_id)
    .order('sort_order')

  return (
    <ChecklistClient
      initialItems={items || []}
      profile={profile}
      room={profile.rooms as any}
    />
  )
}
