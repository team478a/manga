begin;

alter function public.is_admin() security invoker;
alter function public.is_admin() reset all;

commit;
