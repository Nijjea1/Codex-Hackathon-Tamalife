-- Run once in each Supabase environment. Application tables are managed by Alembic.
-- The bucket is private and accessed only by the FastAPI service-role client.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No anon/authenticated Storage policies are created intentionally. The mobile
-- app must send files to FastAPI; only the backend service role accesses Storage.
