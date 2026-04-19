# 💍 웨딩 체크리스트

아이디/비밀번호로 로그인해서 커플이 함께 체크하는 웨딩 플래너.

---

## 배포 순서

### 1. Supabase 설정 (5분)

1. [supabase.com](https://supabase.com) 가입 → **New Project**
2. **SQL Editor**에서 `supabase-schema.sql` 전체 실행
3. **Authentication → Providers → Email** 에서 "Confirm email" 옵션 끄기 (간편하게 바로 로그인되게)
4. **Settings → API**에서 `Project URL`과 `anon public key` 복사

### 2. 방 코드 / 결혼날짜 수정

`supabase-schema.sql` 하단의 insert 문에서:
```sql
insert into rooms (id, name, wedding_date)
values ('our-wedding', '우리의 웨딩', '2025-10-18')
```
- `'our-wedding'` → 원하는 방 코드 (영어, 짧게)
- `'우리의 웨딩'` → 커플 이름
- `'2025-10-18'` → 결혼 예정일

그 다음 아래의 seed 함수 호출도 같이 수정:
```sql
select seed_checklist('our-wedding'); -- 여기도 같은 방 코드로
```

### 3. 로컬 테스트

```bash
npm install
cp .env.local.example .env.local
# .env.local에 Supabase URL, Key 붙여넣기
npm run dev
# → localhost:3000
```

### 4. Vercel 배포

```bash
# GitHub에 push 후 vercel.com에서 연결
# 환경변수 2개 추가:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## 사용 방법

1. 배포된 URL에 접속
2. **회원가입** 탭 → 이름, 방 코드(`our-wedding`), 이메일, 비밀번호 입력
3. 파트너도 동일한 방 코드로 가입
4. 같은 체크리스트를 실시간으로 공유

---

## 파일 구조

```
src/
├── app/
│   ├── page.tsx          # 루트 → 로그인 여부에 따라 리다이렉트
│   ├── auth/page.tsx     # 로그인 / 회원가입
│   └── room/page.tsx     # 체크리스트 메인 (로그인 필요)
├── components/
│   └── ChecklistClient.tsx  # 실시간 체크리스트 UI
├── lib/
│   └── supabase.ts       # 클라이언트 + 타입
└── middleware.ts          # 세션 갱신
```
