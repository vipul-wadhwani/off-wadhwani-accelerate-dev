# Sentry Integration

Sentry is used for error monitoring and performance tracking across the Accelerate platform. Frontend and backend use **separate Sentry projects** for dev and prod, auto-detected at runtime.

## Projects (4 total)

| Project | Scope | Environment | DSN Project ID |
|---------|-------|-------------|---------------|
| `accelerate-dev-fe` | Frontend | Dev | `4511076123934720` |
| `accelerate-dev-be` | Backend | Dev | `4511052614991872` |
| `accelerate-prod-fe` | Frontend | Prod | `4511076127342592` |
| `accelerate-prod-be` | Backend | Prod | `4511076120985600` |

Sentry org: `o4508539300020224`

## Auto-Detection (No Config Needed)

The correct DSN is selected automatically — **no env vars required** per deployment.

**Frontend** (`src/config/sentry.ts`):
- Detects via `window.location.hostname`
- `devaccelerate.*` → dev FE DSN
- `*wadhwani*` or `*netlify*` → prod FE DSN
- Override: set `VITE_SENTRY_DSN` env var

**Backend** (`backend/src/config/sentry.ts`):
- Detects via `SUPABASE_URL`
- Contains `jenyuppryecuirvvlvkb` (prod Supabase project) → prod BE DSN
- Otherwise → dev BE DSN
- Override: set `SENTRY_DSN` env var

## Frontend (`@sentry/react`)

**Config**: `src/config/sentry.ts`

- **Only enabled in production builds** (`import.meta.env.PROD`) — not active in local dev
- Browser tracing integration enabled
- Trace sample rate: 20%

**User context**: Set automatically in `src/context/AuthContext.tsx`
- On login / session restore: `Sentry.setUser({ id, email, username })`
- On logout: `Sentry.setUser(null)`
- Every error includes the affected user's identity

**Error boundary**: `src/components/ErrorBoundary.tsx` catches React rendering errors and reports them to Sentry.

## Backend (`@sentry/node`)

**Config**: `backend/src/config/sentry.ts`

- **Enabled when `NODE_ENV !== 'development'`** (runs on deployed dev/prod servers)
- `sendDefaultPii: true` — captures IP addresses and request data

**Error handler**: `backend/src/middleware/errorHandler.ts` captures unhandled Express errors.

## Environment Variables (Optional Overrides)

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SENTRY_DSN` | Frontend `.env` | Override auto-detected frontend DSN |
| `SENTRY_DSN` | Backend `.env` | Override auto-detected backend DSN |

These are only needed if you want to point to a different Sentry project than the auto-detected one.

## How It Works

1. App starts → auto-detects environment (dev or prod)
2. Selects the correct Sentry DSN for that environment
3. Sentry SDK initializes and captures errors automatically
4. User context is attached after login (frontend)
5. Errors route to the correct Sentry project dashboard at https://sentry.io

## Future Improvements

- **Release tracking**: Tag builds with git SHA for regression detection
- **Source maps upload**: Upload during CI/CD build for readable frontend stack traces
- **Backend tracing**: Add `tracesSampleRate` and Express tracing integration
- **Alerts**: Configure Slack/email notifications for new or spiking errors
