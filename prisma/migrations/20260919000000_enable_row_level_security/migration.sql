-- Supabase exposes every table in the `public` schema through its own
-- PostgREST/GraphQL/Realtime API, independent of this app's Express server,
-- using the project's anon/service keys. This app never uses that API (all
-- access goes through src/middleware/auth.js + rbac.js), but until Row-Level
-- Security is enabled, Supabase's own security advisor is right that anyone
-- with the project's anon key can read/write/delete every row directly,
-- bypassing our auth entirely.
--
-- Enabling RLS with no policies denies all access through that API surface
-- (the safe default, since this app was never meant to use it) while leaving
-- Prisma's own access unaffected: Prisma connects directly over the Postgres
-- wire protocol as the table owner/superuser role, which bypasses RLS by
-- default unless FORCE ROW LEVEL SECURITY is also set (it isn't, here).
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PeerVerificationLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
