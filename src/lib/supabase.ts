import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const createClient = () => createSupabaseClient(supabaseUrl, supabaseAnonKey)

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

export type Vendor = {
  id: string
  room_id: string
  category: string
  name: string
  contact: string | null
  memo: string | null
  status: string
  created_at: string
}

export type BudgetItem = {
  id: string
  room_id: string
  category: string
  schedule: string | null
  label: string
  planned: number
  deposit: number
  balance: number
  total: number
  groom: number
  bride: number
  status: string
  note: string | null
  sort_order: number
}

export const PHASES = [
  'D-12개월','D-11개월','D-10개월','D-9개월','D-8개월','D-7개월',
  'D-6개월','D-5개월','D-4개월','D-3개월','D-2개월','D-1개월',
  'D-2주','D-1주','D-1일','D-DAY',
]

export const ASSIGNEES = ['신랑','신부','신랑측','신부측','양가']
export const VENDOR_CATEGORIES = ['메이크업','드레스','야외스냅','스튜디오','기타']
export const BUDGET_CATEGORIES = ['인사','스튜디오(스냅촬영)','결혼준비','결혼식']
export const VENDOR_STATUS: Record<string, { label: string; color: string }> = {
  searching:  { label: '알아보는중', color: 'bg-stone-100 text-stone-500' },
  contacted:  { label: '상담완료',   color: 'bg-blue-100 text-blue-600' },
  contracted: { label: '예약완료',   color: 'bg-green-100 text-green-700' },
  done:       { label: '완납',       color: 'bg-rose-100 text-rose-600' },
}
