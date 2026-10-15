# Database scalability audit — Barber Paradise

Audit inputs: GitHub source, backend queries, real Supabase BarberOS Backend (PostgreSQL 17), and performance/security advisers.

## Decision

Keep PostgreSQL 17 / Supabase for OLTP. The data model requires serializable-enough scheduling, atomic inventory, FK integrity, unique idempotency and tenant isolation. MongoDB or Firebase do not fix worker polling, DB connections or expensive joins.

Architecture: authenticated Fastify API replicas -> bounded PostgreSQL pools through Supavisor; Redis for ephemeral real-time fanout; durable PostgreSQL outbox for events; dedicated worker fleet, Storage for media. Add observed load testing and monitoring before scaling vertically or horizontally.

## Verified properties

- Appointments have a real GiST exclusion constraint that prevents overlapping active bookings of the same barber per tenant.
- Tenant+barber and tenant+service composite FKs exist; bookings/orders use scoped idempotency.
- The inspected database contains approximately three tenants, nine appointments and ten outbox events. It is NOT a high-volume benchmark.
- Postgres pg_stat_statements shows over 46,000 outbox polls and average time around 0.03 ms per query. Worker polling grows with replica count, even when idle.
- Supabase adviser reported three missing FK indexes, including one on a legacy WhatsApp delivery table.
- Existing auth adviser reports leaked-password protection disabled. Official documentation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Changes

1. Migration 20261015010100_scalability_foundation.sql adds targeted indexes on user-join requests, tenant+barber customer links, outbox claim order, and legacy WhatsApp deliveries when present. No rows are removed.
2. Worker dynamically backs off during empty polling and infrastructure errors, runs faster when jobs are present, and keeps durable SKIP LOCKED queue claiming.
3. PostgreSQL client enables TCP keepalive and idle-transaction timeout so abandoned connections do not hold row locks indefinitely.
4. Isolated PostgreSQL 17 automated tests attempt 150 queue claims across 12 simultaneous consumers, 50 competing bookings, and 50 inventory purchases when stock is 10. These are correctness checks, not requests-per-second promises.

## Critical migration drift

Real Supabase has table whatsapp_deliveries, created by a different migration from the proposed GitHub WhatsApp PR #3 that introduces whatsapp_messages. Local worktree also contains additional uncommitted migrations with overlapping file timestamp prefixes. DO NOT bulk-run the pending migrations until this drift is reconciled and one canonical message queue and migration ledger is established.

This proposal depends on PR #7 (Superadmin) and PR #3 (WhatsApp), and is not yet deployed locally.

## Load, reliability and scaling gates

Measure HTTP p50/p95/p99, RPS, error rate, DB pool utilization, deadlocks, lock waits, worker oldest pending age, Redis health, failed messages and queue retries.

Before production: load-test 50/100/250/500 concurrent real API clients against isolated staging. Ensure no double-bookings; stock cannot go negative; tenants cannot see one another; timeout and crash recovery have clear behavior. Keep one PostgreSQL writer. Start read replicas, table partitioning or dedicated queue infrastructure only when monitoring proves the need. Do NOT partition appointments prematurely because that complicates exclusion constraints.

Keep the sum of Node pool ceilings bounded: (API replicas + worker replicas) times DATABASE_POOL_MAX, alongside built-in Supabase services, must fit the Supavisor and DB tier. Database query optimisation, connection pooling and scaling docs: https://supabase.com/docs/guides/platform/performance and https://supabase.com/docs/guides/database/postgres/configuration

Before any migration to real Supabase, test staging, take a restorable backup and account for schema drift. Do not run traffic tests on data belonging to existing users.
