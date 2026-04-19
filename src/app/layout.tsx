import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '웨딩 체크리스트',
  description: '함께 준비하는 우리의 결혼',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
