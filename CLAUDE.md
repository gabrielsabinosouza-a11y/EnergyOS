@AGENTS.md

# EnergyOS project context

Before making project changes, read [the project and mobile plan](docs/PROJECT_AND_MOBILE_PLAN.md) and inspect the current source rather than relying on dated status summaries.

- The existing product is a Next.js web app and API backed by Firebase Authentication and PostgreSQL/Neon.
- The API and server-side modules own data access; clients must not connect directly to PostgreSQL.
- Mobile work should use React Native with Expo and TypeScript. Do not write Kotlin or Java or require Android Studio.
- Keep the current web app at the repository root unless a separate, explicitly approved migration requires moving it.
- Preserve the `America/Sao_Paulo` product-day rules and use server responses as authoritative for rewards and persisted state.
- Follow `AGENTS.md`, existing project conventions, and the installed framework documentation when editing framework code.
