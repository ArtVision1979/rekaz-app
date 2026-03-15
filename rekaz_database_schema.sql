-- =============================================
-- REKAZ SITE VISIT MANAGER — Supabase Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. USERS (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  email text not null,
  role text not null default 'engineer' check (role in ('admin','engineer','supervisor')),
  avatar_url text,
  created_at timestamptz default now()
);
alter table public.users enable row level security;
create policy "Users can view all users" on public.users for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- 2. PROJECT CATEGORIES
create table public.project_categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);
insert into public.project_categories (name) values ('Villa'),('Building'),('Complex'),('Commercial'),('Infrastructure');

-- 3. PROJECTS
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  project_no text not null unique,
  name text not null,
  location text,
  category_id uuid references public.project_categories(id),
  client_name text,
  start_date date,
  end_date date,
  status text default 'active' check (status in ('active','on_hold','completed','cancelled')),
  progress int default 0 check (progress between 0 and 100),
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.projects enable row level security;
create policy "Authenticated users can view projects" on public.projects for select using (auth.role() = 'authenticated');
create policy "Admin/engineer can insert projects" on public.projects for insert with check (auth.role() = 'authenticated');
create policy "Admin/engineer can update projects" on public.projects for update using (auth.role() = 'authenticated');

-- 4. CONSTRUCTION STAGES
create table public.construction_stages (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  order_index int,
  created_at timestamptz default now()
);
insert into public.construction_stages (name, order_index) values
  ('Design',1),('Permit',2),('Excavation',3),('Foundation',4),
  ('Structure',5),('Masonry',6),('MEP',7),('Plaster',8),
  ('Finishing',9),('Handover',10);

-- 5. INSPECTION CHECKLISTS
create table public.inspection_checklists (
  id uuid default gen_random_uuid() primary key,
  stage_id uuid references public.construction_stages(id),
  item text not null,
  order_index int,
  created_at timestamptz default now()
);
insert into public.inspection_checklists (stage_id, item, order_index)
select s.id, c.item, c.idx from public.construction_stages s
cross join (values
  ('Foundation','Soil compaction verified',1),
  ('Foundation','Formwork dimensions correct',2),
  ('Foundation','Rebar placement checked',3),
  ('Foundation','Concrete mix approved',4),
  ('Structure','Column alignment verified',1),
  ('Structure','Beam reinforcement checked',2),
  ('Structure','Slab thickness confirmed',3)
) as c(stage_name, item, idx)
where s.name = c.stage_name;

-- 6. SITE VISITS
create table public.site_visits (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  stage_id uuid references public.construction_stages(id),
  visit_date date not null default current_date,
  engineer_id uuid references public.users(id),
  notes text,
  severity text default 'low' check (severity in ('low','medium','high','critical')),
  gps_lat numeric(10,8),
  gps_lng numeric(11,8),
  next_visit_date date,
  status text default 'draft' check (status in ('draft','submitted','approved')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.site_visits enable row level security;
create policy "Authenticated users can view visits" on public.site_visits for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert visits" on public.site_visits for insert with check (auth.role() = 'authenticated');
create policy "Engineers can update own visits" on public.site_visits for update using (auth.role() = 'authenticated');

-- 7. VISIT CHECKLIST RESULTS
create table public.visit_checklist_results (
  id uuid default gen_random_uuid() primary key,
  visit_id uuid references public.site_visits(id) on delete cascade,
  checklist_item_id uuid references public.inspection_checklists(id),
  passed boolean,
  note text,
  created_at timestamptz default now()
);

-- 8. VISIT PHOTOS
create table public.visit_photos (
  id uuid default gen_random_uuid() primary key,
  visit_id uuid references public.site_visits(id) on delete cascade,
  file_path text not null,
  caption text,
  markup_data jsonb,
  created_at timestamptz default now()
);

-- 9. TASKS
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  visit_id uuid references public.site_visits(id),
  title text not null,
  description text,
  severity text default 'medium' check (severity in ('low','medium','high','critical')),
  assigned_to text,
  due_date date,
  status text default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.tasks enable row level security;
create policy "Authenticated users can view tasks" on public.tasks for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage tasks" on public.tasks for all using (auth.role() = 'authenticated');

-- 10. TASK PHOTOS (before/after)
create table public.task_photos (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade,
  photo_type text check (photo_type in ('before','after')),
  file_path text not null,
  created_at timestamptz default now()
);

-- 11. DAILY LOGS
create table public.daily_logs (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  log_date date not null default current_date,
  engineer_id uuid references public.users(id),
  weather text,
  workers_count int,
  activities text,
  issues text,
  created_at timestamptz default now()
);

-- 12. MILESTONES
create table public.milestones (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  due_date date,
  completed_date date,
  status text default 'pending' check (status in ('pending','in_progress','completed','delayed')),
  created_at timestamptz default now()
);

-- 13. DRAWINGS
create table public.drawings (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  drawing_no text,
  file_path text not null,
  version text default 'R0',
  uploaded_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- 14. REPORTS
create table public.reports (
  id uuid default gen_random_uuid() primary key,
  report_no text not null unique,
  visit_id uuid references public.site_visits(id) on delete cascade,
  project_id uuid references public.projects(id),
  generated_by uuid references public.users(id),
  pdf_path text,
  qr_code text,
  signed boolean default false,
  created_at timestamptz default now()
);

-- 15. SCHEDULE VISITS
create table public.schedule_visits (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  engineer_id uuid references public.users(id),
  scheduled_date date not null,
  scheduled_time time,
  notes text,
  reminder_sent boolean default false,
  created_at timestamptz default now()
);

-- 16. ACTIVITY LOG
create table public.activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

-- =============================================
-- STORAGE BUCKETS
-- Run in Supabase Dashboard > Storage
-- =============================================
-- insert into storage.buckets (id, name, public) values ('projects', 'projects', false);
-- Folder structure will be:
-- projects/{project_id}/visits/{visit_id}/photos/
-- projects/{project_id}/tasks/{task_id}/before_after/
-- projects/{project_id}/drawings/
-- projects/{project_id}/reports/

-- =============================================
-- REPORT NUMBER FUNCTION (auto-increment)
-- =============================================
create or replace function generate_report_no()
returns text language plpgsql as $$
declare
  year_part text := to_char(now(), 'YYYY');
  seq_no int;
begin
  select count(*) + 1 into seq_no from public.reports
  where created_at >= date_trunc('year', now());
  return 'SVR-' || year_part || '-' || lpad(seq_no::text, 3, '0');
end;
$$;

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_projects_updated before update on public.projects for each row execute function update_updated_at();
create trigger trg_visits_updated before update on public.site_visits for each row execute function update_updated_at();
create trigger trg_tasks_updated before update on public.tasks for each row execute function update_updated_at();

-- =============================================
-- SAMPLE DATA
-- =============================================
-- Note: Insert a user first via Supabase Auth, then:
-- insert into public.projects (project_no, name, location, status, progress)
-- values ('RKZ-0001','Al Lawzi Villa','Riffa','active',45),
--        ('RKZ-0002','Salman Building','Manama','active',28),
--        ('RKZ-0003','Al Noor Complex','Muharraq','active',72);
