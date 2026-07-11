# AssanPay Onboarding Portal Frontend

TanStack Start/React frontend for AssanPay merchant onboarding and operations. The Bun/Hono backend is hosted separately in `../onboarding-portal-assanpay-BE`.

## Local setup

```sh
bun install --frozen-lockfile
bun run dev
```

The development server defaults to `http://localhost:5173`. Configure `VITE_API_URL` when the API is hosted elsewhere, and include the frontend origin in the backend `CORS_ORIGIN`.

For separate production origins, coordinate backend secure/SameSite cookie settings with the deployed domains. Access tokens remain in application memory; refresh sessions use the backend HTTP-only cookie.

## Commands

```sh
bun run dev
bun run test
bun run lint
bun run format
```

Do not run the frontend build unless explicitly requested; follow `AGENTS.md`.

## Main routes

- `/login` and `/set-password/:token`: employee authentication.
- `/onboarding-form`: public merchant onboarding.
- `/onboarding-form/resubmit/:token`: rejected-field resubmission.
- `/onboarding-form/agreement/:token`: signed agreement upload.
- `/onboarding-form/go-live/:token`: MID Go-Live activation.
- Authenticated cases, merchants, dashboard, users, configuration, and notifications under `_app` routes.

API functions live in `src/apis`, shared authentication/error handling in `src/lib` and `src/features/auth`, and query integration in `src/hooks`.

## Deployment

The project targets Cloudflare through Wrangler. `bun run deploy` performs a production build and deployment; run it only when explicitly authorized.
