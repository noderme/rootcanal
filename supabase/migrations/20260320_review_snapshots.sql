-- review_snapshots: one row per clinic per day, tracking review count + rating over time
create table if not exists review_snapshots (
  id            uuid          primary key default gen_random_uuid(),
  clinic_url    text          not null,
  place_id      text,
  review_count  integer,
  rating        numeric(3,1),
  snapshot_date date          not null,
  created_at    timestamptz   default now(),
  unique (clinic_url, snapshot_date)
);

-- competitor_snapshots: one row per competitor per clinic per day
create table if not exists competitor_snapshots (
  id               uuid        primary key default gen_random_uuid(),
  clinic_url       text        not null,
  competitor_name  text        not null,
  place_id         text,
  review_count     integer,
  rating           numeric(3,1),
  google_rank      integer,
  snapshot_date    date        not null,
  created_at       timestamptz default now(),
  unique (clinic_url, competitor_name, snapshot_date)
);
