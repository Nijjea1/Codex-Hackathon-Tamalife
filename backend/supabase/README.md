# Supabase environment bootstrap

Tamalife uses Supabase for hosted PostgreSQL and private receipt storage, not for
application authentication.

For each staging/production project:

1. Run `001_storage.sql` in the SQL editor.
2. Copy the direct database URL for Alembic migrations.
3. Copy a persistent runtime URL: direct when the host supports IPv6, otherwise
   Supavisor session mode.
4. Replace the URL scheme with `postgresql+asyncpg://` for SQLAlchemy.
5. Store the URLs, project URL, and service key in the deployment secret manager.
6. Run `uv run alembic upgrade head` from `backend/`.
7. Keep the Storage bucket private and do not add client policies unless the
   architecture is deliberately changed to permit direct mobile access.

The service key bypasses Storage RLS and must never be exposed to Expo, logs, or
API responses.

