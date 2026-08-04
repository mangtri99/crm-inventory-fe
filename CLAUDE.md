# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Nuxt 4 dashboard SPA built on **Nuxt UI v4** (`@nuxt/ui`). Directory is named `crm-inventory-fe`, but the code is still the upstream Nuxt UI dashboard template (Home / Inbox / Customers / Settings) — treat existing pages as scaffolding to replace when building CRM/inventory features. Package manager is **pnpm** (v11). Not a git repo yet.

## Commands

```bash
pnpm dev        # dev server on http://localhost:3000
pnpm build      # production build
pnpm preview    # preview prod build
pnpm lint       # eslint (Nuxt config, stylistic: no comma-dangle, 1tbs)
pnpm typecheck  # vue-tsc via nuxt typecheck
```

No test runner is configured. `postinstall` runs `nuxt prepare` (regenerates `.nuxt/`, required before typecheck/lint work).

## Architecture

Nuxt 4 `app/` directory layout. Auto-imports are on — do not manually import Vue APIs, composables, `~/types`, or components; refer to components by PascalCased path (e.g. `app/components/customers/AddModal.vue` → `<CustomersAddModal>`, `home/HomeStats.vue` → `<HomeStats>`).

- **Data flow**: no real backend. `server/api/*.ts` are Nitro `eventHandler`s returning hardcoded mock arrays typed against `~/types`. Pages fetch them with `useFetch<T>('/api/...', { lazy: true })`. To add data, add a `server/api/` handler + a matching interface in `app/types/index.d.ts`.
- **Types**: all shared domain types live in [app/types/index.d.ts](app/types/index.d.ts) (`User`, `Mail`, `Member`, `Sale`, `Stat`, `Notification`, `Period`, `Range`). Import via `~/types`.
- **Layout shell**: [app/layouts/default.vue](app/layouts/default.vue) owns the whole dashboard chrome — sidebar nav `links` array, `UDashboardGroup`/`UDashboardSidebar`, and the command-palette `groups`. Add a page → add its entry to `links` here. Pages render inside a `<UDashboardPanel>` with `#header` (`UDashboardNavbar`) and `#body` slots.
- **Global state / shortcuts**: [app/composables/useDashboard.ts](app/composables/useDashboard.ts) is a `createSharedComposable` holding cross-page state (notifications slideover) and global `defineShortcuts` (`g-h`/`g-i`/`g-c`/`g-s` nav, `n` notifications).
- **Tables**: TanStack Table Core via Nuxt UI `UTable`. Columns are `TableColumn<T>[]` built with `h()` render functions; components used inside them are pulled in with `resolveComponent('UAvatar')` etc. See [app/pages/customers.vue](app/pages/customers.vue) for the reference pattern (sorting, faceted filters, row selection, pagination).
- **Charts**: Unovis (`@unovis/vue`). Split into `.client.vue` / `.server.vue` variants (see `app/components/home/HomeChart.*`).

## Conventions

- Theme colors set in [app/app.config.ts](app/app.config.ts) (`primary: green`, `neutral: zinc`); the green palette is redefined as CSS vars in [app/assets/css/main.css](app/assets/css/main.css). Change brand color in both.
- Icons: `i-lucide-*` (Lucide) and `i-simple-icons-*` (brands), resolved by Iconify at build.
- Forms/validation: **zod v4** + Nuxt UI `UForm`.
- ESLint stylistic rules are enforced: **no comma dangle**, 1tbs brace style, max 3 attributes per line on single-line templates. Run `pnpm lint` before finishing.
