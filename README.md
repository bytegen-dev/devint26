# devint26

Source: [github.com/bytegen-dev/devint26](https://github.com/bytegen-dev/devint26)

Masumi agent: natural-language talent query, GitHub user discovery, profile/repo/event fetch, Claude summary per candidate. Express, Prisma/Postgres, GitHub REST, Anthropic APIs.

Register with your live base URL (HTTPS). All responses below are JSON.

---

### Dependencies

- Node 20+
- Postgres
- `GITHUB_TOKEN` (search + user read)
- `ANTHROPIC_API_KEY`

### Run

```bash
git clone https://github.com/bytegen-dev/devint26.git
cd devint26
cp .env.example .env
pnpm install
pnpm run db:push
pnpm run dev          # default http://localhost:3030
```

```bash
pnpm run build && pnpm start
```

`PORT` overrides the listen port.

### Configuration

| Name | Required | Default |
|------|----------|---------|
| `DATABASE_URL` | yes | — |
| `GITHUB_TOKEN` | yes | — |
| `ANTHROPIC_API_KEY` | yes | — |
| `PORT` | no | `3030` |
| `ANTHROPIC_MODEL` | no | `claude-sonnet-4-20250514` |
| `ANTHROPIC_REPORT_CONCURRENCY` | no | `3` (max `10`) |
| `GITHUB_BUNDLE_CONCURRENCY` | no | `4` (max `10`, parallel users during GitHub fetch) |
| `ANTHROPIC_TIMEOUT_MS` | no | `120000` (min `10000`, max `600000`; Anthropic client) |
| `GITHUB_MAX_RETRIES` | no | `5` |
| `GITHUB_SEARCH_QUERY_MAX_LENGTH` | no | `256` |

---

### Routes

| Method | Path | Summary |
|--------|------|---------|
| GET | `/availability` | `200` + `{ "status": "available" }` if DB answers; else `503` + `{ "status": "unavailable" }` |
| GET | `/input_schema` | Schema for `/start_job` body |
| POST | `/start_job` | See below |
| GET | `/status?job_id=` | Job payload or error state |

**`POST /start_job`**

Body:

- `input_data`: array of `{ key, value }` entries; keys are `query` (required), `location`, `limit`. `limit` defaults to 5, range 1–10.
- `identifier_from_purchaser`: required, non-empty. Same string the buyer side uses when building input/output hashes for payment/decision logging.

`201`: `{ "job_id", "status": "awaiting_payment" }`. Processing is async; poll `/status`.

**`GET /status`**

Completed: `output`, `input_hash`, `output_hash`, `completed_at`, `execution_time_seconds`.  
Failed: `error`, `message`, `failed_at`.  
Other states: `status` plus timestamps as applicable.

---

### Hashes

Input: `sha256(lowercase hex)` of `identifier_from_purchaser` + `;` + RFC 8785 canonical JSON of the raw `input_data` array.

Output: same scheme on `identifier_from_purchaser` + `;` + canonical JSON of `{ "reports": [...] }`.

Implementation: `canonicalize` + helpers in `src/lib/hash.ts`.

---

### Source

`src/index.ts` — app entry  
`src/routes/*` — HTTP handlers  
`src/services/job.ts` — job lifecycle and pipeline  
`src/services/github.ts` — API client, retries, query sanitization  
`src/services/intelligence.ts` — Claude calls  
`prisma/schema.prisma` — `Job` model  

### Scripts

`pnpm run dev` · `pnpm run build` · `pnpm start` · `pnpm run lint` · `pnpm run lint:fix` · `pnpm run db:push` · `pnpm run db:generate`

Git hooks (Husky): **pre-commit** → **lint-staged** (`eslint --fix` on staged `src/**/*.ts`). **pre-push** → **`pnpm run build`** then **`pnpm run lint`**. With Husky, `pnpm install` must run from a directory that has `.git` (this repo as root) so `prepare` wires hooks. NVM lines in hook scripts help GitHub Desktop and similar find Node.

---

`.env` is gitignored. Unhandled failures return HTTP 500 with a short body; `src/logger.ts` writes detail to stderr.
