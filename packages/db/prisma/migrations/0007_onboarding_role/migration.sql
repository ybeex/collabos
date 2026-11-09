-- PRD_AUDIT.md Finding #9: PRD §14 Flow 1 "Role Selection (PM/Dev/Designer,
-- sets default layout)" step of the onboarding flow. Nullable, no default
-- backfill — existing users predate onboarding and simply have no role,
-- which the redirect logic in apps/web treats as "fall through to the
-- pre-existing unconditional /channels redirect."

ALTER TABLE "users" ADD COLUMN "onboardingRole" TEXT;
