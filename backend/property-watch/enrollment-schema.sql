create table property_watch.enrollment_challenges (
 id uuid primary key default gen_random_uuid(),
 browser_digest text not null check(browser_digest ~ '^[0-9a-f]{64}$'),
 receipt_digest text not null check(receipt_digest ~ '^[0-9a-f]{64}$'),
 subscription_id uuid not null,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now(),
 check(expires_at > created_at and expires_at <= created_at + interval '5 minutes')
);
alter table property_watch.enrollment_challenges enable row level security;
revoke all on property_watch.enrollment_challenges from public, anon, authenticated;
create function property_watch.consume_enrollment(challenge_id uuid, browser_proof text, receipt_proof text, bearer_digest text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare challenge property_watch.enrollment_challenges%rowtype; inserted uuid;
begin
 select * into challenge from property_watch.enrollment_challenges where id=challenge_id for update;
 if browser_proof is null or receipt_proof is null or bearer_digest is null or not found or challenge.consumed_at is not null or challenge.expires_at <= clock_timestamp()
   or challenge.browser_digest <> browser_proof or challenge.receipt_digest <> receipt_proof
   or bearer_digest !~ '^[0-9a-f]{64}$' then return false; end if;
 insert into property_watch.installations(token_digest,subscription_id,verified_at,expires_at)
 values(bearer_digest,challenge.subscription_id,clock_timestamp(),clock_timestamp()+interval '30 days')
 on conflict do nothing returning id into inserted;
 if inserted is null then return false; end if;
 update property_watch.enrollment_challenges set consumed_at=clock_timestamp() where id=challenge_id;
 return true;
end $$;
revoke all on function property_watch.consume_enrollment(uuid,text,text,text) from public,anon,authenticated;