# Canonical migration reconciliation (Supabase BarberOS Backend)

## GitHub vs current Supabase

GitHub branch `feat/unified-release-schema-20261015` contains the complete agreed application backend/schema history.

Real Supabase: `wrfwhftzaflwhkvkzrjm` (PostgreSQL 17) already has original core migrations, the separately authored `barberos_whatsapp_notifications_20261014` migration, and two scaling index migrations applied via the Supabase connector:

| Live Supabase migration record | GitHub equivalent / treatment |
| --- | --- |
| `barberos_whatsapp_notifications_20261014` | **Legacy schema** with `whatsapp_deliveries` and trigger `appointments_whatsapp_queue`; NOT equivalent to the new `20261014000400_whatsapp_templates.sql` |
| `barber_paradise_scalability_foundation_20261015` | `20261015010100_scalability_foundation.sql` already applied to remote as a separately numbered Supabase migration |
| `barber_paradise_outbox_retention_20261015` | `20261015010200_outbox_retention.sql` already applied to remote as a separately numbered Supabase migration |
| `20261014000400_whatsapp_templates.sql` | **New additive migration** providing `whatsapp_messages`, `whatsapp_consents`, `whatsapp_tenant_settings`. Requires back-end worker to remain disabled until templates are approved |
| `20261014000500_platform_integrations.sql` | **New additive migration** providing encrypted platform integrations vault |
| `20261015010300_whatsapp_legacy_bridge.sql` | **New compatibility migration**, run AFTER approved templates, checks legacy queue has no pending messages; retires only old producer trigger; preserves legacy table as archive, disables per-tenant sending by default |

**Warning:** the live migration version identifiers are not equal to migration filenames. Do NOT run `supabase db push` indiscriminately against the connected project or repair migration history without reviewing each version. A separate baseline/reconciliation procedure must map existing completed files to version numbers before first production CD setup.

## Authoritative data model

- Persistent source of truth: PostgreSQL with strict tenant-scoped foreign keys and database-backed invariants.
- Only **one active new WhatsApp queue**: `whatsapp_messages`; the old `whatsapp_deliveries` is preserved read-only until archiving after manual review.
- Settings and consents default to OFF. No automatic migration of old `appointments.whatsapp_opt_in` into new consent records. Customers must opt in under the new rules.
- Global switch `WHATSAPP_SEND_ENABLED=false` remains OFF until production signoff.
- Admin secrets encrypted using backend-only `PLATFORM_SECRETS_KEY`. Git does not contain tokens.

## Deployment / rollback sequence

1. Tag or export a restorable backup of the existing Supabase data and migrate on isolated CI PostgreSQL 17.
2. Apply `20261014000400_whatsapp_templates.sql` and `20261014000500_platform_integrations.sql` to the intended DB.
3. Verify no legacy rows in `whatsapp_deliveries` with `status='pending'`; otherwise halt and reconcile messages individually.
4. Apply bridge `20261015010300_whatsapp_legacy_bridge.sql`.
5. Roll out backend+frontend with shared `PLATFORM_SECRETS_KEY` and WhatsApp sends disabled. Verify tenants, user roles, webhooks and admin settings before enabling sending.
6. Rollback backend independently while old legacy table remains available. **Do not re-enable the old producer trigger** together with the new producer; that would produce duplicate notifications.
7. Clean up unused legacy table only after a tested archival process and confirmed no references in local worktree.

## Local user-worktree caution

`UPDATEBARBER` is on `feature/professional-image-upload` with many uncommitted edits and several extra migrations (e.g. new barber intervals, QR affiliations, contracts and tenant commercial profile). Those edits **cannot be assumed to match GitHub**. Never reset/force-checkout the user's local worktree when updating. Review and integrate those patches separately before final release build.
