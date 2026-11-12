# Phase 2: Daily Management

## Goal

Extend phase 1 with daily-management flows that make diahealth useful as a continuous routine tool.

## Scope

- Medication plans and logs
- Meal tracking
- Hydration tracking
- Step and exercise tracking
- Reminder scheduling
- Daily, weekly, and monthly dashboard charts
- Emergency card and caregiver quick-call button

## Product Exclusions

- Medication adherence chart was removed by user request.
- Home-screen manual sync button was removed by user request.
- Medication plans are kept in code and sync model, but the dedicated menu entry is not exposed by user request.

## Dependencies

- Stable phase-1 auth and profile model
- Shared contract expansion for medication and activity records
- Push notification infrastructure
- Background sync improvements

## Deliverables

- Hydration tracking vertical slice with mobile UI, API CRUD, local sync, and shared contracts
- Meal tracking vertical slice with mobile UI, API CRUD, local sync, and shared contracts
- Medication logging vertical slice with mobile UI, API CRUD, local sync, and shared contracts
- Medication plan vertical slice with mobile UI, API CRUD, local sync, and shared contracts
- Activity tracking vertical slice with steps, exercise duration, mobile UI, API CRUD, local sync, and shared contracts
- Daily-management navigation entry points in the mobile app
- Local medication reminder scheduling with date/time notifications
- Local recurring medication plan reminder scheduling
- Local daily reminder scheduling for measurement, hydration, and activity preferences
- Configurable reminder times for measurement, hydration, and activity reminders
- Local emergency card with caregiver quick-call action
- Daily, weekly, and monthly charts for hydration, meals, and activity
- Reminder preferences persisted locally and on backend
- Phase-2 acceptance checklist and rollout order
- Mobile phase-2 helper tests for hydration, medication, medication plan, meal, activity, reminder time, and sync records

## Architecture

- Phase 2 keeps the phase-1 local-first pattern
- New daily-management entities sync through the same queue model
- Shared Zod schemas stay source of truth for mobile and API payloads
- Reminders start as persisted preferences before push scheduling is activated
- Emergency data stays local-first and can later gain server backup

## APIs

- `GET /hydration`
- `POST /hydration`
- `PATCH /hydration/:id`
- `GET /medications`
- `POST /medications`
- `PATCH /medications/:id`
- `GET /medication-plans`
- `POST /medication-plans`
- `PATCH /medication-plans/:id`
- `GET /meals`
- `POST /meals`
- `PATCH /meals/:id`
- `GET /activities`
- `POST /activities`
- `PATCH /activities/:id`

## Data Model

- `HydrationLog`
- `MedicationLog`
- `MedicationPlan`
- `MealLog`
- `ActivityLog`
- `ReminderPreference`
- `EmergencyCard`

## Implementation Order

- Step 1: hydration vertical slice
- Step 2: medication log and plan foundation
- Step 3: meal, exercise, and steps capture
- Step 4: reminder scheduling model and local triggers
- Step 5: emergency card and caregiver shortcuts
- Step 6: dashboard charts for phase-2 entities

## Acceptance

- User can log hydration offline
- Hydration logs sync to backend and return on pull
- User can edit and delete hydration logs
- User can log medications offline
- Medication logs sync to backend and return on pull
- User can edit and delete medication logs
- User can create medication plans offline
- Medication plans sync to backend and return on pull
- User can edit and delete medication plans
- Active medication plans schedule recurring local reminders
- User can log meals offline
- Meal logs sync to backend and return on pull
- User can edit and delete meal logs
- User can log steps and exercise offline
- Activity logs sync to backend and return on pull
- User can edit and delete activity logs
- User can save an emergency card locally
- User can call the emergency contact from the card
- User can view hydration charts by day, week, and month
- User can view meal charts by day, week, and month
- User can view activity charts by day, week, and month
- User reminder preferences persist across sessions and devices
- User can configure daily reminder times
- Daily-management modules are reachable from the app
- Shared daily-management contracts compile in mobile and API

## Test Checklist

- Hydration form validation
- Hydration helper test coverage
- Hydration local repository mapping
- Hydration sync queue generation
- Hydration API CRUD
- Hydration pull and push flows
- Medication form validation
- Medication helper test coverage
- Medication local repository mapping
- Medication API CRUD
- Medication pull and push flows
- Medication plan form validation
- Medication plan helper test coverage
- Medication plan local repository mapping
- Medication plan API CRUD
- Medication plan pull and push flows
- Meal form validation
- Meal helper test coverage
- Meal local repository mapping
- Meal API CRUD
- Meal pull and push flows
- Activity form validation
- Activity helper test coverage
- Activity local repository mapping
- Activity API CRUD
- Activity pull and push flows
- Medication date/time notification scheduling
- Medication plan recurring notification scheduling
- Measurement reminder daily local notification scheduling
- Hydration reminder daily local notification scheduling
- Activity reminder daily local notification scheduling
- Reminder time validation and persistence
- Reminder preference local persistence
- Reminder preference backend persistence
- Emergency card validation
- Emergency contact quick-call link
- Hydration dashboard chart rendering
- Meal dashboard chart rendering
- Activity dashboard chart rendering
