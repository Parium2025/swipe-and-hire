# Parium load testing

This project includes a controlled load-test harness for finding bottlenecks in:

- job search (`search_jobs` RPC)
- matching/swipe-style job reads (`job_postings`, optional `job_views` writes)
- chat (`get_conversation_summaries`, `conversation_messages`)

The test is intentionally safe by default:

- it runs in read-only mode unless writes are explicitly enabled
- it refuses high-load tests against `parium.se` unless production testing is explicitly allowed
- it writes a JSON report with p50/p95/p99 latency, errors and bottleneck findings

## Quick smoke test

```bash
PARIUM_LOAD_TEST_USERS_COUNT=10 \
PARIUM_LOAD_TEST_DURATION_SECONDS=30 \
bun run load:test
```

## Production load test

Only run this when you intentionally want to test the live backend.

```bash
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
PARIUM_LOAD_TEST_ALLOW_PRODUCTION=true \
PARIUM_LOAD_TEST_USERS_COUNT=100 \
bun run load:test
```

## Optional write testing

Write mode can create `job_views` and chat messages, so only use seeded test accounts/data.

```bash
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
