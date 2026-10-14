# Barber Paradise — Release checklist (stabilization)

> This branch is intentionally not deployed or merged until its real QA gate passes.
> WhatsApp template sending is **out of scope** for this change; it is the next phase.

## Completed code changes

1. Images: first-party uploads to the existing public-read `barberos-images` Supabase Storage bucket, file signature/size checks, WebP compression for large photos, broken-image fallbacks, optional HTTPS URL entry, product images, shop logo/cover/gallery, shop-managed barber images and the barber's own photo/gallery.
2. Business persistence: tenant profile fields, product photos and up to 10 portfolio URLs are written to PostgreSQL and reloaded from it; no longer just a temporary React store.
3. Auth/QR: session restoration loading, explicit 429 auth messages, owner invitation QR and approval workflow, and an Add Barber entry point on the owner team screen. Barber photo editing uses tenant and user authorization.
4. Commerce: backend appointment, order and inventory tests are part of CI; stock inputs reject zero, negative, fractional and non-finite amounts.
5. Verification: root `npm ci` is clean without `--legacy-peer-deps`, TypeScript/build pass, backend tests and visual Playwright login tests run in GitHub Actions.

## Real QA (must pass before merging)

The existing `tests/e2e/connection.spec.js` covers:
- owner, client and joined barber logins and role isolation
- barcode/QR customer linking and professional join approval/rejection
- product creation and stock movement
- real browser reservations and product orders
- shop profile persistence and image upload to Storage
- navigation through commercial and client modules

Execute the `QA real end-to-end (manual)` workflow on branch `fix/stabilization-five-priorities-20261014`, or run the same tests from the dedicated QA machine using a local environment. The workflow **will skip the live tests** unless the following repository Actions secrets are configured:

- `QA_SUPABASE_URL`
- `QA_SUPABASE_PUBLISHABLE_KEY`
- `QA_SUPABASE_SERVICE_ROLE_KEY`
- `QA_DATABASE_URL` (API PostgreSQL connection)
- `QA_ADMIN_DATABASE_URL` (admin-only cleanup of generated test data)

The workflow refuses any Supabase URL/connection not pointing to the isolated `wrfwhftzaflwhkvkzrjm` project. Do not place secret values in code, commits or PR comments. The integration test creates temporary users and test-only tenants and cleans them after completion. A green CI result **without a real QA run is not sufficient** for production release.

## Deployment and acceptance

1. Merge after QA passes; deploy the matching frontend and backend versions together. The new frontend calls media/profile APIs not available in older backend containers.
2. Verify the backend has the `SUPABASE_SERVICE_ROLE_KEY` for Storage writes **server-side only**. Never add it to a Vite `VITE_` environment variable. Keep `MEDIA_BUCKET=barberos-images` and CORS configured for the intended domain.
3. After deployment verify `/api/v1/health/ready` and permission-denied responses for unauthorized upload/edit attempts.
4. Upload real JPEG, PNG and WebP files from phone and desktop; reload, log out/in, and confirm persisted media. Test broken legacy external image URLs.
5. Repeat role, QR, appointment, inventory and order tests against QA staging; verify image access across customer and professional views.
6. Capture a rollback point for DB and container release. Do not remove any existing images as part of rollout.
7. Do not merge with `main` or expose new workflows to production until QA is green and the owner has approved the release.

## Deferred: WhatsApp Cloud API templates

After priorities above are verified, design approved Meta WhatsApp templates (appointment confirmation, reminder, change and cancellation). Store template names, language and parameter mappings per tenant; check user opt-in, scheduling/timezone, retries, idempotency, failed delivery and webhook signature verification. Do not send messages from this branch.
