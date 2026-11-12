# Phase 1: Foundation

## Goal

Deliver a working monorepo foundation with authentication, onboarding, offline-first tracking for glucose and core metrics, backend sync, shared contracts, and an internal admin shell.

## Scope

- Monorepo workspace for mobile, api, admin, and shared packages
- Firebase-backed authentication flow
- Onboarding for language, diabetes profile type, local permission preferences, and disclaimer
- Local SQLite storage for glucose and health metrics
- Lightweight settings persistence compatible with Expo Go
- NestJS API for auth, profile, glucose, metrics, and sync
- Prisma schema and initial PostgreSQL migration
- Shared TypeScript and Zod contracts
- Admin placeholder shell for internal operations

## Deliverables

- `README.md` and phase roadmap docs
- Root workspace scripts, Turbo tasks, and shared TypeScript config
- Mobile screens for sign-in, onboarding, glucose entry, metrics entry, and profile preferences
- API routes for `/auth`, `/profile`, `/glucose`, `/metrics`, and `/sync`
- Shared package with contracts and schemas
- GitHub Actions CI baseline

## Architecture

- Mobile is local-first and syncs through a queued operation model
- Firebase ID tokens are verified by the backend guard
- Shared Zod schemas define the transport layer
- Prisma is the single source of truth for PostgreSQL persistence
- Conflict handling uses `updatedAt` last-write-wins behavior

## APIs

- `POST /auth/session`
- `GET /profile/me`
- `PUT /profile/me`
- `GET /glucose`
- `POST /glucose`
- `PATCH /glucose/:id`
- `GET /metrics`
- `POST /metrics`
- `PATCH /metrics/:id`
- `POST /sync/push`
- `GET /sync/pull`

## Data Model

- `User`
- `UserProfile`
- `GlucoseLog`
- `HealthMetric`

## Acceptance

- User can authenticate
- User completes onboarding once
- User profile persists
- User language and local permission preferences persist
- User can create offline records
- Sync uploads queued changes
- Sync returns remote changes
- Shared contracts compile across apps

## Test Checklist

- Auth session bootstrap
- Onboarding persistence
- Glucose form validation
- Metric form validation
- SQLite repository mapping
- Sync queue generation
- API auth guard
- CRUD routes
