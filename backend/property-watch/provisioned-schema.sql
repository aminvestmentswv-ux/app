-- Applied to isolated AM Property Watch project only, November 18, 2026.
-- Snapshot of reviewed migration isolated_watch_registry_paused; not a CLI migration file.
create schema property_watch;
revoke all on schema property_watch from public, anon, authenticated;
create table property_watch.settings (
  id boolean primary key default true check (id),
  delivery_enabled boolean not null default false check (delivery_enabled = false)
);
insert into property_watch.settings(id,delivery_enabled) values(true,false);
create table property_watch.installations (
  id uuid primary key default gen_random_uuid(),
  token_digest text not null unique check (token_digest ~ '^[0-9a-f]{64}$'),
  subscription_id uuid not null unique,
  verified_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > verified_at),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table property_watch.watches (
  installation_id uuid not null references property_watch.installations(id) on delete cascade,
  property_id text not null check (property_id ~ '^[a-zA-Z0-9_-]{1,128}$'),
  consent_version text not null check (consent_version = 'price-drop-v1'),
  started_at timestamptz not null default now(),
  primary key(installation_id,property_id)
);
alter table property_watch.settings enable row level security;
alter table property_watch.installations enable row level security;
alter table property_watch.watches enable row level security;
revoke all on all tables in schema property_watch from public, anon, authenticated;
alter default privileges in schema property_watch revoke all on tables from public, anon, authenticated;
alter default privileges in schema property_watch revoke execute on functions from public;

-- Backend-only invoker functions; intentionally no public or client grants.
create function property_watch.set_watch(device_id uuid, target_property text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare installation property_watch.installations%rowtype;
begin
  select * into installation from property_watch.installations where id=device_id for update;
  if not found or installation.revoked_at is not null
     or installation.expires_at <= clock_timestamp()
     or installation.verified_at > clock_timestamp() then return false; end if;
  insert into property_watch.watches(installation_id,property_id,consent_version)
    values(device_id,target_property,'price-drop-v1') on conflict do nothing;
  return true;
end $$;
create function property_watch.revoke_installation(device_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from property_watch.installations where id=device_id for update;
  update property_watch.installations set revoked_at=clock_timestamp() where id=device_id;
  delete from property_watch.watches where installation_id=device_id;
end $$;
revoke all on all functions in schema property_watch from public, anon, authenticated;
