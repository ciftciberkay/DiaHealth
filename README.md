# diahealth

diahealth is a bilingual diabetes management platform built as a TypeScript monorepo. The first delivery focuses on a working phase-1 foundation: authentication, onboarding, local-first health tracking, backend sync, shared contracts, and an internal admin shell.

## Product Summary

- Track fasting, postprandial, and night glucose readings
- Record HbA1c, blood pressure, and weight
- Use email, Google, and Apple sign-in through Firebase
- Complete onboarding for language, diabetes profile, local permission preferences, and medical disclaimer
- Store records offline first and sync them later
- Keep a clear boundary that the app does not replace clinical care

## Tech Stack

- Mobile: React Native with Expo prebuild and TypeScript
- API: NestJS with TypeScript and Prisma
- Admin: Next.js with TypeScript
- Main database: PostgreSQL
- Local mobile storage: SQLite for records and AsyncStorage for lightweight settings
- Auth and push foundation: Firebase
- Workspace tooling: pnpm workspaces and Turbo

## Monorepo Layout

```text
apps/
  mobile/    Expo mobile app
  api/       NestJS API
  admin/     Next.js internal admin shell
packages/
  shared/    Shared contracts, enums, and Zod schemas
docs/
  phases/    Product roadmap and delivery phases
```

## Roadmap

- Phase 1: foundation, auth, onboarding, local-first tracking, sync, admin shell
- Phase 2: medications, meals, hydration, exercise, reminders, dashboard charts, emergency card
- Phase 3: recipes, guides, PDF reporting, content operations
- Phase 4: community, Apple Health, Health Connect, hardening, release readiness

## Phase Notes

- Android health integrations are intentionally deferred to Phase 4.
- Google Fit is not part of the target architecture.
- Health Connect is the Android direction when integrations start.

## Local Setup

```bash
pnpm setup:local
pnpm dev:api
pnpm dev:mobile
pnpm dev:admin
```

- `.env.example` files are provided at the root and app level.
- Phase 1 local development can run with `DEV_AUTH_BYPASS=true`.
- Real Firebase credentials can replace the bypass later without changing routes.
- `pnpm mobile:doctor` validates Expo dependencies.
- `pnpm smoke:api` checks the dev bypass session flow.
- Mobile targets Expo SDK 57. Install the matching Expo Go version on your phone.
- Expo Go 57 on iOS requires the same Expo account in the CLI and phone app. Run `pnpm --filter @diahealth/mobile exec expo login`, sign in on the phone, then run `pnpm dev:mobile` and scan the QR code.
- AsyncStorage is used for lightweight settings in Phase 1 to keep Expo Go compatibility during local testing.

## Medical Disclaimer

diahealth is a self-management tool. It does not diagnose, treat, or replace a clinician. Users must confirm this disclaimer during onboarding and should seek urgent medical help for emergencies.

## Immediate Next Phase

Phase 2 implementation details live in [docs/phases/phase-2-daily-management.md](./docs/phases/phase-2-daily-management.md).
