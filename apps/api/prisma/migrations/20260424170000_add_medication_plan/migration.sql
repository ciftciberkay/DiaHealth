CREATE TABLE "MedicationPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "scheduleTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MedicationPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MedicationPlan_userId_isActive_idx" ON "MedicationPlan"("userId", "isActive");

ALTER TABLE "MedicationPlan" ADD CONSTRAINT "MedicationPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
