-- Offline candidate only. Production concurrency tests required before applying.
create table property_watch.rate_limits (
 key text primary key, window_start timestamptz not null, attempts integer not null check(attempts>=0)
);
alter table property_watch.rate_limits enable row level security;
revoke all on property_watch.rate_limits from public,anon,authenticated;
create function property_watch.consume_limits(keys text[])
returns boolean language plpgsql security invoker set search_path='' as $$
declare k text; r property_watch.rate_limits%rowtype; moment timestamptz:=clock_timestamp();
begin
 if keys is null or cardinality(keys)<>4 then return false; end if;
 if (select count(distinct v) from unnest(keys) v)<>4 then return false; end if;
 if exists(select 1 from unnest(keys) v where v is null or length(v)>100) then return false; end if;
 -- Sorted row locks prevent deadlock and serialize all overlapping dimensions.
 for k in select distinct v from unnest(keys) v order by v loop
  insert into property_watch.rate_limits(key,window_start,attempts) values(k,moment,0) on conflict do nothing;
  perform 1 from property_watch.rate_limits where key=k for update;
 end loop;
 if exists(select 1 from property_watch.rate_limits where key=any(keys) and window_start>moment-interval '15 minutes' and attempts>=3) then return false; end if;
 update property_watch.rate_limits set attempts=case when window_start<=moment-interval '15 minutes' then 1 else attempts+1 end,
 window_start=case when window_start<=moment-interval '15 minutes' then moment else window_start end where key=any(keys);
 return true;
end $$;
revoke all on function property_watch.consume_limits(text[]) from public,anon,authenticated;
