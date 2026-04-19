-- ================================================================
-- 웨딩 체크리스트 스키마 v2
-- Supabase > SQL Editor 에 전체 붙여넣고 Run 하세요
-- ================================================================

create table if not exists rooms (
  id          text primary key,
  name        text not null,
  wedding_date date,
  created_at  timestamptz default now()
);

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  room_id     text references rooms(id),
  display_name text not null,
  created_at  timestamptz default now()
);

create table if not exists checklist_items (
  id          uuid primary key default gen_random_uuid(),
  room_id     text references rooms(id) on delete cascade,
  phase       text not null,
  title       text not null,
  checked     boolean default false,
  checked_by  text,
  checked_at  timestamptz,
  assignee    text,
  memo        text,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

alter table rooms           enable row level security;
alter table profiles        enable row level security;
alter table checklist_items enable row level security;

create policy "rooms_select" on rooms for select using (true);
create policy "rooms_insert" on rooms for insert with check (true);

create policy "profiles_select" on profiles for select
  using (room_id in (select room_id from profiles where id = auth.uid()));
create policy "profiles_insert" on profiles for insert with check (id = auth.uid());
create policy "profiles_update" on profiles for update using (id = auth.uid());

create policy "items_select" on checklist_items for select
  using (room_id in (select room_id from profiles where id = auth.uid()));
create policy "items_update" on checklist_items for update
  using (room_id in (select room_id from profiles where id = auth.uid()));
create policy "items_insert" on checklist_items for insert with check (true);

alter publication supabase_realtime add table checklist_items;

create or replace function seed_checklist(p_room_id text)
returns void language plpgsql as $$
declare
  phases text[][] := array[
    array['D-12개월','결혼 날짜 확정'],array['D-12개월','예산 설정'],
    array['D-12개월','양가 상견례 진행'],array['D-12개월','예식장 투어 및 계약'],
    array['D-11개월','웨딩 스타일 및 컨셉 설정'],array['D-11개월','웨딩 플래너 여부 결정'],
    array['D-11개월','스드메 업체 조사'],array['D-11개월','신혼집 방향 결정'],
    array['D-10개월','스드메 계약'],array['D-10개월','본식 스냅/영상 업체 예약'],
    array['D-10개월','허니문 후보지 선정'],array['D-9개월','허니문 예약 (항공/숙소)'],
    array['D-9개월','혼수 리스트 작성'],array['D-9개월','예물/예단 진행 여부 결정'],
    array['D-8개월','드레스 투어'],array['D-8개월','웨딩 촬영 컨셉 기획'],
    array['D-8개월','신혼집 계약 진행'],array['D-7개월','웨딩 촬영 일정 확정'],
    array['D-7개월','촬영 의상 및 소품 준비'],array['D-7개월','피부/다이어트 관리 시작'],
    array['D-6개월','웨딩 촬영 진행'],array['D-6개월','모바일 청첩장 업체 조사'],
    array['D-6개월','혼수 구매 시작'],array['D-5개월','촬영 사진 셀렉'],
    array['D-5개월','청첩장 디자인 제작'],array['D-5개월','예물/예단 준비'],
    array['D-4개월','본식 드레스 선택'],array['D-4개월','청첩장 주문'],
    array['D-4개월','하객 리스트 작성'],array['D-3개월','청첩장 발송'],
    array['D-3개월','헤어/메이크업 리허설'],array['D-3개월','혼수 준비 마무리'],
    array['D-2개월','사회자 및 축가 섭외'],array['D-2개월','예식 식순 구성'],
    array['D-2개월','웨딩슈즈/액세서리 준비'],array['D-1개월','하객 최종 확인'],
    array['D-1개월','좌석 배치도 작성'],array['D-1개월','본식 리허설 진행'],
    array['D-1개월','예물/예단 전달'],array['D-2주','드레스 최종 피팅'],
    array['D-2주','네일/헤어 스타일 확정'],array['D-2주','허니문 짐 준비'],
    array['D-1주','예식장 최종 확인'],array['D-1주','답례품 준비'],
    array['D-1주','축의금/봉투 준비'],array['D-1일','짐 최종 점검'],
    array['D-1일','예식 준비물 확인'],array['D-1일','충분한 휴식'],
    array['D-DAY','예식장 도착 및 준비'],array['D-DAY','체크리스트 담당자 지정'],
    array['D-DAY','예식 진행'],array['D-DAY','피로연 및 마무리']
  ];
  i int;
begin
  for i in 1..array_length(phases, 1) loop
    insert into checklist_items (room_id, phase, title, sort_order)
    values (p_room_id, phases[i][1], phases[i][2], i);
  end loop;
end;
$$;
