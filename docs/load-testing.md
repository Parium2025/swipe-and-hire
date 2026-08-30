# Parium load testing

This project includes a controlled load-test harness for finding bottlenecks in:

- job search (`search_jobs` RPC)
- matching/swipe-style job reads (`job_postings`, optional `job_views` writes)
- chat (`get_conversation_summaries`, `conversation_messages`)

The test is intentionally safe by default:

- it runs in read-only mode unless writes are explicitly enabled
- it is fail-closed on targeting: the **actual** Supabase URL used by the client is validated against a
  mandatory `PARIUM_LOAD_TEST_EXPECTED_SUPABASE_URL` before any client is created
- there is **no** low-virtual-user or "smoke is safe" exception; every production run requires explicit opt-in
- it writes a JSON report with p50/p95/p99 latency, errors and bottleneck findings

## Targeting rules (read first)

| Situation | Result |
| --- | --- |
| Missing `PARIUM_LOAD_TEST_EXPECTED_SUPABASE_URL` | refuses to run |
| Actual Supabase origin != expected origin | refuses to run, even with `ALLOW_PRODUCTION=true` |
| Malformed/non-http(s) URL | refuses to run |
| Production origin without `PARIUM_LOAD_TEST_ALLOW_PRODUCTION=true` | refuses to run at any user count |

Origins are compared normalized (scheme + lowercased host, trailing slash and path ignored).
The report and console log show the normalized **actual** origin, never a label.

## Staging test

Staging requires the actual staging Supabase URL and key plus the exact expected origin:

```bash
SUPABASE_URL=https://<staging-ref>.supabase.co \
SUPABASE_ANON_KEY=<staging-anon-key> \
PARIUM_LOAD_TEST_EXPECTED_SUPABASE_URL=https://<staging-ref>.supabase.co \
PARIUM_LOAD_TEST_USERS_COUNT=10 \
PARIUM_LOAD_TEST_DURATION_SECONDS=30 \
bun run load:test
```

## Production load test

Only run this when you intentionally want to test the live backend. Both the expected origin and the
opt-in flag are mandatory, regardless of user count.

```bash
PARIUM_LOAD_TEST_EXPECTED_SUPABASE_URL=https://<prod-ref>.supabase.co \
PARIUM_LOAD_TEST_ALLOW_PRODUCTION=true \
PARIUM_LOAD_TEST_USERS_COUNT=200 \
PARIUM_LOAD_TEST_DURATION_SECONDS=180 \
PARIUM_LOAD_TEST_RAMP_SECONDS=45 \
bun run load:test
```

## Authenticated chat testing

Chat scenarios need real test users that already have conversations. Provide users as JSON:

```bash
PARIUM_LOAD_TEST_AUTH_USERS='[
  {"email":"test1@example.com","password":"password"},
  {"email":"test2@example.com","password":"password"}
]' \
PARIUM_LOAD_TEST_EXPECTED_SUPABASE_URL=https://<target-ref>.supabase.co \
PARIUM_LOAD_TEST_ALLOW_PRODUCTION=true \
PARIUM_LOAD_TEST_USERS_COUNT=100 \
bun run load:test
```

## Optional write testing

Write mode can create `job_views` and chat messages, so only use seeded test accounts/data.

```bash
PARIUM_LOAD_TEST_EXPECTED_SUPABASE_URL=https://<staging-ref>.supabase.co \
PARIUM_LOAD_TEST_ENABLE_WRITES=true \
PARIUM_LOAD_TEST_AUTH_USERS='[{"email":"test1@example.com","password":"password"}]' \
bun run load:test
```

## Report

Reports are written to:

```text
/mnt/documents/load-tests/
```

Look for:

- p95 above 1500 ms = moderate bottleneck
- p95 above 3000 ms = severe bottleneck
- error rate above 2% = reliability bottleneck
- skipped chat requests = missing authenticated users or missing conversations
