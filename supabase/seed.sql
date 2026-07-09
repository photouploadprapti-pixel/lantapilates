-- Optional seed data for Lanta Pilates tablets

insert into public.tablet_users (name) values
  ('Alex'),
  ('Bob')
on conflict do nothing;

-- Assign Alex to tab1 and Bob to tab2 when users exist
update public.tablets
set user_id = (select id from public.tablet_users where name = 'Alex' limit 1)
where slug = 'tab1'
  and exists (select 1 from public.tablet_users where name = 'Alex');

update public.tablets
set user_id = (select id from public.tablet_users where name = 'Bob' limit 1)
where slug = 'tab2'
  and exists (select 1 from public.tablet_users where name = 'Bob');
