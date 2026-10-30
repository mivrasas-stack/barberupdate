-- Production hotfix: the service edit route PATCHes earns_loyalty_points.
-- Prior migration 20261013001700 granted UPDATE only on the other catalog fields.
-- Preserve least privilege: do not grant table-wide UPDATE to the API role.
GRANT UPDATE (earns_loyalty_points) ON TABLE public.services TO barberos_backend;
