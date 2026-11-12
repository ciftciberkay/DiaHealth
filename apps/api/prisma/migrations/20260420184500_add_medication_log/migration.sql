CREATE TYPE "MedicationStatus" AS ENUM ('scheduled', 'taken', 'skipped');

CREATE TABLE "MedicationLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "medicationName" TEXT NOT NULL,
  "dosage" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "MedicationStatus" NOT NULL,
  "takenAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "MedicationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MedicationLog_userId_scheduledFor_idx" ON "MedicationLog"("userId", "scheduledFor" DESC);

ALTER TABLE "MedicationLog"
ADD CONSTRAINT "MedicationLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
