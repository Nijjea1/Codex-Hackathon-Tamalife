"""User service — the seam between Clerk identity and our own database.

NOTE: This is intentionally a stub for the auth slice. The database lives in a
separate workstream (Supabase + SQLAlchemy). When that lands, this function
becomes the single place that maps a verified Clerk identity to an internal
`users` row.

Target behaviour (design doc §5):
    1. Look up a user by `clerk_user_id`.
    2. If missing, create one — fetching the email from Clerk's Backend API
       (the default session token does NOT contain email), e.g.:
           clerk.users.get(user_id=current_user.clerk_user_id)
    3. Return the internal user record.

Keeping this boundary here means routes never talk to Clerk's Backend API or
the database directly — they depend on `get_current_user` for identity and on
this service for persistence.
"""

from app.schemas.auth import CurrentUser


async def get_or_create_user(current_user: CurrentUser) -> dict:
    """Placeholder: echoes the Clerk identity until the DB layer exists.

    Replace the body with a real lookup/insert against the `users` table once
    Supabase/SQLAlchemy is wired up. The signature is stable, so callers won't
    change.
    """
    # TODO(supabase): replace with real get-or-create against the users table.
    return {
        "clerk_user_id": current_user.clerk_user_id,
        "persisted": False,
    }
