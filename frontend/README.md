# ACR-MS Frontend

Angular (standalone, SCSS) + Angular Material (Material 3) + AG Grid Community. Runs on mock data, no backend needed.

## Run

```bash
npm install
npm start          # http://localhost:4300
```

Click **Login as Admin (Demo)** on the login page (or sign in with any email and password). This works only while `mockMode` is `true` in `public/assets/config.json`: every repository then uses its mock and no request is sent to the backend. Set `mockMode` to `false` to use the real API. Never ship with `mockMode` enabled.

## Scripts

| Command                | Purpose          |
| ---------------------- | ---------------- |
| `npm start`            | Dev server       |
| `npm run build`        | Production build |
| `npm run lint`         | ESLint           |
| `npm run format`       | Prettier (write) |
| `npm run format:check` | Prettier (check) |

## Runtime config

`public/assets/config.json` is fetched at startup (served at `/assets/config.json`). It holds
branding (product name, tagline, logo, optional `cssVariables` overrides such as `--mat-sys-primary` for tenant colours), API base URL and currency/locale. Edit it without rebuilding.

## Structure

`src/app/core` (guards, interceptors, config, layout), `shared` (pipes, components),
`features/<feature>/{domain,data,presentation}`.

To switch from mock to real API, change the provider in each feature's `*.providers.ts`
(and `core/layout/shell.providers.ts`). `MockAuthRepository` is development only and must never
ship to production.
