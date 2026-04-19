import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const createClient = () => createClientComponentClient()

export type ChecklistItem = {
  id: string
  room_id: string
  phase: string
  title: string
  checked: boolean
  checked_by: string | null
  checked_at: string | null
  assignee: string | null
  memo: string | null
  sort_order: number
}

export type Profile = {
  id: string
  room_id: string
  display_name: string
}

export type Room = {
  id: string
  name: string
  wedding_date: string | null
}

export const PHASES = [
  'D-12개월','D-11개월','D-10개월','D-9개월','D-8개월','D-7개월',
  'D-6개월','D-5개월','D-4개월','D-3개월','D-2개월','D-1개월',
  'D-2주','D-1주','D-1일','D-DAY',
]

export const ASSIGNEES = ['신랑','신부','신랑측','신부측','양가']
