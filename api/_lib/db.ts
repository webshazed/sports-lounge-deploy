import { Pool } from "pg";

let pool: Pool | undefined;
let didInit = false;

function getConnectionString() {
  const cs =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!cs) {
    throw new Error(
      "Missing Postgres connection string. Set POSTGRES_URL (recommended) or DATABASE_URL."
    );
  }
  return cs;
}

export function getPool() {
  if (!pool) {
    const connectionString = getConnectionString();
    // In serverless/prod environments (Vercel + managed Postgres like Neon),
    // SSL is typically required. pg does not always infer this reliably from
    // libpq-style query params like "?sslmode=require".
    const isProd = process.env.NODE_ENV === "production";
    pool = new Pool({
      connectionString,
      ssl: isProd ? { rejectUnauthorized: false } : undefined,
      // Prevent long hangs on cold starts / unreachable DB.
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
      max: 5,
    });
  }
  return pool;
}

export async function ensureSchema() {
  if (didInit) return;
  didInit = true;

  const p = getPool();
  await p.query(`
    create table if not exists users (
      id bigserial primary key,
      email text not null unique,
      username text not null unique,
      password_hash text not null,
      created_at timestamptz not null default now(),
      last_seen timestamptz not null default now()
    );
  `);

  await p.query(`
    create table if not exists profiles (
      user_id bigint primary key references users(id) on delete cascade,
      full_name text,
      role text,
      company text,
      bio text,
      industry text,
      favorite_sports text,
      business_interests text,
      looking_for text[] not null default '{}',
      badges text[] not null default '{}',
      cover_image_url text,
      avatar_url text,
      membership_tier text not null default 'Gold',
      location text,
      phone text,
      dob text,
      gender text,
      about_you text,
      privacy_settings jsonb not null default '{"phone":"only_me","email":"only_me","dob":"only_me","username":"only_me"}',
      reg_type text,
      pl_team text,
      world_team text,
      address_line1 text,
      address_line2 text,
      city text,
      zip_code text,
      country text,
      biz_type text,
      biz_name text,
      updated_at timestamptz not null default now()
    );
  `);

  // Backwards-compatible column adds for existing DBs
  await p.query(`alter table profiles add column if not exists company text;`);
  await p.query(`alter table profiles add column if not exists looking_for text[] not null default '{}';`);
  await p.query(`alter table profiles add column if not exists badges text[] not null default '{}';`);
  await p.query(`alter table profiles add column if not exists cover_image_url text;`);
  await p.query(`alter table profiles add column if not exists avatar_url text;`);
  await p.query(`alter table users add column if not exists last_seen timestamptz not null default now();`);
  await p.query(`alter table profiles add column if not exists phone text;`);
  await p.query(`alter table profiles add column if not exists dob text;`);
  await p.query(`alter table profiles add column if not exists gender text;`);
  await p.query(`alter table profiles add column if not exists about_you text;`);
  await p.query(`alter table profiles add column if not exists privacy_settings jsonb not null default '{"phone":"only_me","email":"only_me","dob":"only_me","username":"only_me"}';`);
  await p.query(`alter table profiles add column if not exists pl_team text;`);
  await p.query(`alter table profiles add column if not exists world_team text;`);
  await p.query(`alter table profiles add column if not exists address_line1 text;`);
  await p.query(`alter table profiles add column if not exists address_line2 text;`);
  await p.query(`alter table profiles add column if not exists city text;`);
  await p.query(`alter table profiles add column if not exists zip_code text;`);
  await p.query(`alter table profiles add column if not exists country text;`);
  await p.query(`alter table profiles add column if not exists biz_type text;`);
  await p.query(`alter table profiles add column if not exists biz_name text;`);
  await p.query(`alter table profiles add column if not exists reg_type text;`);

  await p.query(`
    create table if not exists lounge_bookings (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      lounge_location text not null,
      start_time timestamptz not null,
      guests int not null,
      area text not null,
      match_name text,
      extras jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `);

  await p.query(`create index if not exists lounge_bookings_location_time_idx on lounge_bookings (lounge_location, start_time desc);`);
  await p.query(`create index if not exists lounge_bookings_user_time_idx on lounge_bookings (user_id, start_time desc);`);

  await p.query(`
    create table if not exists posts (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      kind text not null default 'Post',
      content text not null,
      like_count int not null default 0,
      comment_count int not null default 0,
      created_at timestamptz not null default now()
    );
  `);
  await p.query(`create index if not exists posts_created_at_idx on posts (created_at desc);`);
  await p.query(`create index if not exists posts_user_created_at_idx on posts (user_id, created_at desc);`);

  await p.query(`
    create table if not exists post_likes (
      user_id bigint not null references users(id) on delete cascade,
      post_id bigint not null references posts(id) on delete cascade,
      reaction_type text not null default 'like',
      created_at timestamptz not null default now(),
      primary key (user_id, post_id)
    );
  `);
  await p.query(`alter table post_likes add column if not exists reaction_type text not null default 'like';`);

  await p.query(`
    create table if not exists post_comments (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      post_id bigint not null references posts(id) on delete cascade,
      parent_id bigint references post_comments(id) on delete cascade,
      content text not null,
      created_at timestamptz not null default now()
    );
  `);
  await p.query(`create index if not exists post_comments_post_id_idx on post_comments (post_id, created_at asc);`);
  await p.query(`alter table post_comments add column if not exists parent_id bigint references post_comments(id) on delete cascade;`);

  await p.query(`
    create table if not exists events (
      id bigserial primary key,
      created_by bigint not null references users(id) on delete cascade,
      title text not null,
      starts_at timestamptz not null,
      location text,
      rsvp_count int not null default 0,
      created_at timestamptz not null default now()
    );
  `);
  await p.query(`create index if not exists events_starts_at_idx on events (starts_at asc);`);

  await p.query(`
    create table if not exists connections (
      id bigserial primary key,
      requester_id bigint not null references users(id) on delete cascade,
      receiver_id bigint not null references users(id) on delete cascade,
      status text not null default 'pending', -- 'pending', 'accepted', 'rejected'
      created_at timestamptz not null default now(),
      unique(requester_id, receiver_id)
    );
  `);
  await p.query(`create index if not exists connections_receiver_idx on connections (receiver_id, status);`);
  await p.query(`create index if not exists connections_pair_idx on connections (requester_id, receiver_id);`);

  await p.query(`
    create table if not exists messages (
      id bigserial primary key,
      sender_id bigint not null references users(id) on delete cascade,
      receiver_id bigint not null references users(id) on delete cascade,
      content text not null,
      read_at timestamptz,
      created_at timestamptz not null default now()
    );
  `);
  await p.query(`create index if not exists messages_conversation_idx on messages (sender_id, receiver_id, created_at desc);`);
  await p.query(`create index if not exists messages_receiver_unread_idx on messages (receiver_id) where read_at is null;`);
}

