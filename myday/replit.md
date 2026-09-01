# MyDay Calendar

MyDay is a focused personal calendar and to-do app for planning a day from a month overview.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/myday run dev` — run the MyDay frontend
- `pnpm --filter @workspace/myday run desktop:dev` — build and launch the offline Electron app
- `pnpm --filter @workspace/myday run package:mac` — build the macOS `.dmg` locally
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- No external API keys or login are required.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Preview API: Express 5
- Desktop runtime: Electron with a context-isolated preload and typed IPC
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: Vite renderer + esbuild Electron entrypoints + electron-builder

## Where things live
- `artifacts/myday/src/App.tsx` — month and daily planning UI
- `artifacts/myday/src/index.css` — MyDay visual theme
- `artifacts/myday/electron/main.ts` — offline Electron main process and IPC routing
- `artifacts/myday/electron/preload.ts` — locked-down renderer bridge
- `artifacts/api-server/src/routes/calendar.ts` — calendar, event, and task API
- `artifacts/api-server/src/lib/myday-store.ts` — local JSON persistence with an empty initial dataset
- `lib/myday-core.ts` — shared local calendar/task domain service used by desktop IPC
- `lib/api-spec/openapi.yaml` — source of truth for generated API hooks and schemas

## Architecture decisions
- The first version uses a local JSON file for storage to keep the app single-user, dependency-light, and free to run.
- The API contract remains OpenAPI-first so the frontend uses generated React Query hooks instead of hand-written request shapes.
- The desktop app stores `myday.json` under Electron's per-user application data directory and accesses it only from the main process.
- The renderer uses the generated request contract through an IPC-backed transport when the Electron preload bridge is present; the Express API remains for Replit preview development.
- The app ships without remote font imports or required network calls.
- The UI follows the attached Obsidian reference with a dark workspace, compact chrome, fine dividers, and muted accent color.

## Product
- Month calendar with task/event summaries and month navigation.
- Daily split view with timed events on the left and day tasks on the right.
- Create, edit, complete, delete, reorder, and drag tasks onto time slots to schedule them.
- Data survives refreshes through the local JSON store.
- Month and day views are constrained to the app viewport; busy Schedule and Tasks content scrolls inside its own panel.

## Build the Mac app locally

From the workspace root on macOS:

```bash
pnpm install
pnpm --filter @workspace/myday run package:mac
```

The `.dmg` is written to `artifacts/myday/release/`. To only build and launch the desktop app without packaging:

```bash
pnpm --filter @workspace/myday run desktop:dev
```

## User preferences
- Keep dependencies free/open-source and avoid external services for the personal app.

## Gotchas
- Generated integer schemas use a Zod version that does not expose `z.int`; use numeric OpenAPI fields unless the workspace Zod setup changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
