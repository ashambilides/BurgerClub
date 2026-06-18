# BotMC Security Hardening — Deployment Runbook

Addresses the audit findings C1, H1, H2, H3, M1–M5. Work is split into phases by
risk. **Phases 1–3 are already implemented in `app.js`** and are safe to deploy now
(they degrade gracefully if the SQL isn't applied yet). **Phase 4 is the breaking
cutover** — its client diffs are at the bottom of this file, to apply only after the
Supabase steps are done.

> Em dash note: every SQL file uses the literal `—` (U+2014) that `app.js` puts in
> burger labels. Don't retype it as a hyphen.

---

## Already done in code (deployable today)

| Finding | Where |
|--------|-------|
| **H2** stored XSS | `escapeHtml` now escapes `'` and `/`; all data-bearing `onclick` handlers replaced by a single delegated dispatcher (`initDelegatedHandlers`) using `data-action`/`data-*`. No user data reaches a JS string. |
| **H3** orphaned uploads | Duplicate check moved before photo upload; Phase-3 RPC makes it atomic. |
| **M5** file-path injection | `safeStorageName()` ignores the user filename; extension comes from an allow-list. |
| **M3** mutable keys | `attendeesData` is keyed by stable `ResultId` everywhere. |
| **M4** stale ranking | Attendee/vote routing prefers `active_burger_result_id`. |
| **H1** fuzzy join | `ratingMatchesResult()` joins by `result_id` (label fallback for legacy rows). |
| **M1** non-atomic votes | Submit calls the `submit_rating` RPC; falls back to the legacy path if the RPC 404s. |

`index.html` cache-buster bumped to `app.js?v=45`.

---

## Apply order (do NOT reorder)

1. **Deploy current `app.js`** (Phases 1–3 client). Site keeps working on the
   existing wide-open backend; voting uses the legacy path until step 2.
2. **Run `01_phase2_result_id_and_constraints.sql`** in the Supabase SQL editor.
   Then run the VERIFY query inside it and resolve any `result_id IS NULL` ratings.
3. **Run `02_phase3_submit_rating_rpc.sql`.** Voting now flows through the atomic RPC
   automatically (no redeploy needed — the client already prefers it).
4. **Supabase dashboard:** create the admin Auth user and disable public signups
   (steps are in `03_phase4_rls_and_auth.sql`, top comment).
5. **Apply the Phase 4 client diffs below** to `app.js` + `config.js`, bump the
   cache-buster again, but **don't deploy yet**.
6. **Run `03_phase4_rls_and_auth.sql`** (RLS lockdown + drops `admin_hash`).
7. **Deploy the Phase 4 `app.js`/`config.js`.** Do steps 6 and 7 close together.

> Why 3 before 6: once RLS is locked down, anon can only vote through the RPC. If the
> RPC weren't in place first, voting would break (the legacy fallback's direct inserts
> are blocked by RLS).

---

## Verification

- **XSS:** add a member named `O'Brien"/<img src=x onerror=alert(1)>` — it renders as
  inert text in the table, tracker, and admin lists; edit/remove still work.
- **Vote (post-step 3):** submit a rating → one `ratings` row (with `result_id`),
  `burger_rating` + rankings update, attendee added, photo in gallery. Re-submit same
  name/burger → "already submitted", **no** new storage object or gallery row.
- **Multi-burger venue (Nowon):** rating/attendee attach to the right `result_id`.
- **Lockdown (post-step 6):** as anon, `PATCH /rest/v1/results?id=eq.1` and
  `DELETE /rest/v1/form_config?id=eq.1` return 401/empty; `admin_hash` column is gone.
  Admin login via Auth unlocks the panel; delete/edit work only while logged in.

## Rollback

- Phases 2–3 are additive; to revert behaviour, redeploy the prior `app.js` (RPC simply
  goes unused). The column/constraints/function can stay.
- Phase 4: `alter table ... disable row level security;` on each table re-opens access
  in an emergency. Re-add `admin_hash` only if you roll the client all the way back.

---

## Phase 4 client — ALREADY APPLIED in code

The Phase 4 client cutover is implemented (multi-user, no hardcoded email):
- `config.js`: `ADMIN_PASSWORD_HASH` removed (no secret in the repo).
- `app.js`: `adminToken` + `writeHeaders()` route admin writes with the Auth JWT;
  `dbInsert/dbUpdate/dbDelete` use it; `dbSelect`/`rpcCall` stay anon.
- Admin login (`handleAdminLogin`) now POSTs **email + password** to Supabase Auth
  (`/auth/v1/token?grant_type=password`); `index.html` gained an email field. Any user
  you add in Supabase can log in — no shared password, clean handover.
- In-app "change password" is retired (manage users in the dashboard).
- Cache-busters bumped: `config.js?v=19`, `app.js?v=46`.

### What YOU still do for the lockdown
1. **Supabase → Authentication → Users → Add user** for each admin (you + the other
   member). Check **"Auto Confirm User"** so the password grant works immediately.
2. **Authentication → Providers → Email:** turn **OFF** "Allow new users to sign up"
   (so strangers can't self-register an authenticated account).
3. Deploy the current code (done by the assistant), then **log in on the live site** to
   confirm your Auth user works.
4. Run **`03_phase4_rls_and_auth.sql`** to lock down RLS + drop `admin_hash`.
5. Verify anon writes are blocked (queries in that SQL file).

Ordering note: deploying this client *before* running `03_…sql` is safe — voting uses the
RPC and admin uses the JWT, so nothing breaks while RLS is still open.

### Handover later
Transfer the **Supabase project** (dashboard → Project Settings → General → Transfer) and
the **GitHub repo** ownership. The new owner then manages admin users in Supabase. Nothing
sensitive lives in the repo — the only credential is the public anon key, which RLS renders
harmless for writes.
