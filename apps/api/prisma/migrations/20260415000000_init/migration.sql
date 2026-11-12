-- CreateEnum
CREATE TYPE "DiabetesProfileType" AS ENUM ('type1', 'type2', 'gestational');

-- CreateEnum
CREATE TYPE "GlucoseReadingType" AS ENUM ('fasting', 'postprandial', 'night');

-- CreateEnum
CREATE TYPE "HealthMetricType" AS ENUM ('hba1c', 'blood_pressure', 'weight');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "firebaseUid" TEXT NOT NULL,
  "email" TEXT,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "diabetesProfile" "DiabetesProfileType" NOT NULL DEFAULT 'type2',
  "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  "disclaimerAcceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlucoseLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readingType" "GlucoseReadingType" NOT NULL,
  "valueMgDl" DOUBLE PRECISION NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "GlucoseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthMetric" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "metricType" "HealthMetricType" NOT NULL,
  "value" TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "HealthMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "GlucoseLog_userId_measuredAt_idx" ON "GlucoseLog"("userId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "HealthMetric_userId_measuredAt_idx" ON "HealthMetric"("userId", "measuredAt" DESC);

-- AddForeignKey
ALTER TABLE "UserProfile"
ADD CONSTRAINT "UserProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlucoseLog"
ADD CONSTRAINT "GlucoseLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthMetric"
ADD CONSTRAINT "HealthMetric_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
