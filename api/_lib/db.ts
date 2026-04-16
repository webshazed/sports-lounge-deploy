import { Pool } from "pg";
// trigger watch reload

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

  // Extra profile columns used by registration
  await p.query(`alter table profiles add column if not exists phone text;`);
  await p.query(`alter table profiles add column if not exists dob text;`);
  await p.query(`alter table profiles add column if not exists gender text;`);
  await p.query(`alter table profiles add column if not exists about_you text;`);
  await p.query(`alter table profiles add column if not exists reg_type text;`);
  await p.query(`alter table profiles add column if not exists pl_team text;`);
  await p.query(`alter table profiles add column if not exists world_team text;`);
  await p.query(`alter table profiles add column if not exists address_line1 text;`);
  await p.query(`alter table profiles add column if not exists address_line2 text;`);
  await p.query(`alter table profiles add column if not exists city text;`);
  await p.query(`alter table profiles add column if not exists zip_code text;`);
  await p.query(`alter table profiles add column if not exists country text;`);
  await p.query(`alter table profiles add column if not exists biz_type text;`);
  await p.query(`alter table profiles add column if not exists biz_name text;`);

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
      media_url text,
      media_type text,
      created_at timestamptz not null default now()
    );
  `);
  await p.query(`create index if not exists posts_created_at_idx on posts (created_at desc);`);
  await p.query(`create index if not exists posts_user_created_at_idx on posts (user_id, created_at desc);`);

  // Backwards-compatible column adds
  await p.query(`alter table posts add column if not exists media_url text;`);
  await p.query(`alter table posts add column if not exists media_type text;`);

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

  // ── Event RSVPs ───────────────────────────────────────────────
  await p.query(`
    create table if not exists event_rsvps (
      user_id bigint not null references users(id) on delete cascade,
      event_id bigint not null references events(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, event_id)
    );
  `);

  // ── Messages (persist DMs) ────────────────────────────────────
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
  await p.query(`create index if not exists messages_convo_idx on messages (least(sender_id,receiver_id), greatest(sender_id,receiver_id), created_at desc);`);

  // ── Post Likes ────────────────────────────────────────────────
  await p.query(`
    create table if not exists post_likes (
      user_id bigint not null references users(id) on delete cascade,
      post_id bigint not null references posts(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, post_id)
    );
  `);

  // ── Post Saves (bookmarks) ────────────────────────────────────
  await p.query(`
    create table if not exists post_saves (
      user_id bigint not null references users(id) on delete cascade,
      post_id bigint not null references posts(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, post_id)
    );
  `);

  // ── Multi-photo support on posts ──────────────────────────────
  await p.query(`alter table posts add column if not exists media_urls text[] not null default '{}';`);

  // ── Live Matches ──────────────────────────────────────────────
  await p.query(`
    create table if not exists live_matches (
      id bigserial primary key,
      title text not null,
      sport text not null default 'Football',
      team_home text not null,
      team_away text not null,
      score_home int not null default 0,
      score_away int not null default 0,
      status text not null default 'upcoming',
      starts_at timestamptz not null,
      venue text,
      watch_party_count int not null default 0,
      created_at timestamptz not null default now()
    );
  `);
  await p.query(`create index if not exists live_matches_starts_at_idx on live_matches (starts_at asc);`);

  // ── Match Watch-Party RSVPs ───────────────────────────────────
  await p.query(`
    create table if not exists match_rsvps (
      user_id bigint not null references users(id) on delete cascade,
      match_id bigint not null references live_matches(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, match_id)
    );
  `);

  // ── Business Posts ────────────────────────────────────────────
  await p.query(`
    create table if not exists business_posts (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      category text not null default 'Opportunity',
      title text not null,
      description text not null,
      contact text,
      created_at timestamptz not null default now()
    );
  `);
  await p.query(`create index if not exists business_posts_created_idx on business_posts (created_at desc);`);

  // ── Connections / Friends ─────────────────────────────────────
  await p.query(`
    create table if not exists connections (
      requester_id bigint not null references users(id) on delete cascade,
      addressee_id bigint not null references users(id) on delete cascade,
      status text not null default 'pending',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (requester_id, addressee_id)
    );
  `);
  await p.query(`create index if not exists connections_addressee_idx on connections (addressee_id, status);`);
  await p.query(`create index if not exists connections_requester_idx on connections (requester_id, status);`);

  // ── Comments ──────────────────────────────────────────────────
  await p.query(`
    create table if not exists comments (
      id bigserial primary key,
      post_id bigint not null references posts(id) on delete cascade,
      user_id bigint not null references users(id) on delete cascade,
      content text not null,
      created_at timestamptz not null default now()
    );
  `);
  await p.query(`create index if not exists comments_post_idx on comments (post_id, created_at asc);`);

  // ── Subscriptions (Stripe membership) ─────────────────────────
  await p.query(`
    create table if not exists subscriptions (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      stripe_customer_id text,
      stripe_subscription_id text,
      plan_type text not null default 'individual',
      price_amount int not null default 1999,
      status text not null default 'pending',
      current_period_end timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await p.query(`create index if not exists subscriptions_user_idx on subscriptions (user_id);`);
  await p.query(`create index if not exists subscriptions_stripe_sub_idx on subscriptions (stripe_subscription_id);`);

  // Auto-grant existing users who don't have a subscription yet
  await p.query(`
    insert into subscriptions (user_id, plan_type, price_amount, status, current_period_end)
    select u.id, coalesce(pr.reg_type, 'individual'),
           case when coalesce(pr.reg_type,'individual') = 'individual' then 1999 else 2999 end,
           'active',
           (now() + interval '100 years')
    from users u
    left join profiles pr on pr.user_id = u.id
    where not exists (select 1 from subscriptions s where s.user_id = u.id)
  `);

  didInit = true;
}


