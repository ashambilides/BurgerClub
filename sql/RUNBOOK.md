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

## Phase 4 client diffs (apply at step 5)

### `config.js`
```diff
-    // Admin password hash (default: "password")
-    // To change: use the admin panel's Settings tab, or
-    // generate a new hash at the browser console: await hashPassword('yournewpassword')
-    ADMIN_PASSWORD_HASH: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
+    // Admin identity — authentication is enforced by Supabase Auth + RLS, not here.
+    // Create this user in Supabase > Authentication > Users. Change the password there.
+    ADMIN_EMAIL: 'admin@botmc.local',
```
Also bump `config.js?v=18` → `v=19` in `index.html`.

### `app.js` — module state (near the top, by `let adminLoggedIn = false;`)
```js
let adminToken = null; // Supabase Auth JWT for the admin session
```

### `app.js` — authenticated write headers
Add a helper next to `API_HEADERS`, and route the three write helpers through it so
admin writes carry the JWT (anon writes will be correctly denied by RLS):
```js
function writeHeaders(extra) {
    const h = { ...API_HEADERS, ...(extra || {}) };
    if (adminToken) h['Authorization'] = `Bearer ${adminToken}`;
    return h;
}
```
In `dbInsert`, `dbUpdate`, `dbDelete`, replace `API_HEADERS` with `writeHeaders()`
(keep the `'Prefer'` extras, e.g. `writeHeaders({ 'Prefer': 'return=representation' })`).
Leave `dbSelect` and `rpcCall` on `API_HEADERS` (public read + anon voting).

### `app.js` — replace `handleAdminLogin` (the SHA-256 + `admin_hash` version)
```js
async function handleAdminLogin() {
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('adminLoginError');
    if (!password) { errorEl.textContent = 'Please enter a password.'; return; }
    try {
        const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: CONFIG.ADMIN_EMAIL, password }),
        });
        if (!res.ok) { errorEl.textContent = 'Incorrect password.'; return; }
        const data = await res.json();
        adminToken = data.access_token;
        adminLoggedIn = true;
        errorEl.textContent = '';
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        loadAdminData();
    } catch (e) {
        console.error('Admin login error:', e);
        errorEl.textContent = 'Login failed. Try again.';
    }
}
```

### `app.js` — retire the in-app password change (`handleChangePassword`)
Password changes now happen in the Supabase dashboard. Replace the body with a notice:
```js
async function handleChangePassword() {
    const msg = document.getElementById('changePasswordMsg');
    msg.textContent = 'Change the admin password in Supabase > Authentication > Users.';
    msg.className = 'form-message';
}
```
`hashPassword()` is then unused and can be deleted (optional).

### After applying
Bump `app.js?v=45` → `v=46` in `index.html`, then deploy (runbook steps 6–7).
