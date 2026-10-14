-- Indexed cursor sync for durable notifications fallback during Realtime outages.
-- Backend endpoint enforces auth user and ordered keyset pagination.
BEGIN;
CREATE INDEX IF NOT EXISTS idx_notifications_cursor_feed
 ON public.notifications(user_id,created_at,id);
COMMIT;