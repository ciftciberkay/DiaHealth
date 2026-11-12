import { describe, expect, it } from "vitest";
import { reminderPreferenceUpdateSchema } from "@diahealth/shared";
import {
  createActivityEntry,
  createGlucoseEntry,
  createHydrationEntry,
  createMealEntry,
  createMedicationEntry,
  createMedicationPlanEntry,
  createMetricEntry,
  createSyncRecord,
  deriveLanguage,
  profileDraft
} from "../src/domain";

describe("mobile phase-1 helpers", () => {
  it("derives Turkish locale", () => {
    expect(deriveLanguage("tr-TR")).toBe("tr");
  });

  it("creates glucose syncable entry", () => {
    const entry = createGlucoseEntry({
      readingType: "fasting",
      valueMgDl: 112,
      measuredAt: new Date().toISOString()
    });

    expect(entry.id).toBeTruthy();
    expect(entry.readingType).toBe("fasting");
  });

  it("creates metric entry", () => {
    const entry = createMetricEntry({
      metricType: "weight",
      value: "71",
      measuredAt: new Date().toISOString()
    });

    expect(entry.metricType).toBe("weight");
  });

  it("creates queue payload", () => {
    const syncRecord = createSyncRecord("profile", "update", "abc", { language: "en" });
    expect(syncRecord.recordId).toBe("abc");
  });

  it("creates profile draft", () => {
    const draft = profileDraft({
      language: "en",
      gender: "female",
      diabetesProfile: "type2",
      fullName: "Test User",
      heightCm: 170,
      weightKg: 70
    });
    expect(draft.onboardingCompleted).toBe(true);
  });
});

describe("mobile phase-2 helpers", () => {
  const measuredAt = new Date("2026-04-25T08:30:00.000Z").toISOString();

  it("creates hydration entry", () => {
    const entry = createHydrationEntry({
      amountMl: 300,
      measuredAt,
      note: "Water"
    });

    expect(entry.amountMl).toBe(300);
    expect(entry.deletedAt).toBeNull();
  });

  it("creates medication log entry", () => {
    const entry = createMedicationEntry({
      medicationName: "Metformin",
      dosage: "500 mg",
      scheduledFor: measuredAt,
      status: "scheduled"
    });

    expect(entry.medicationName).toBe("Metformin");
    expect(entry.status).toBe("scheduled");
  });

  it("creates medication plan entry", () => {
    const entry = createMedicationPlanEntry({
      medicationName: "Vitamin D",
      dosage: "1000 IU",
      scheduleTime: "21:00",
      isActive: true
    });

    expect(entry.scheduleTime).toBe("21:00");
    expect(entry.isActive).toBe(true);
  });

  it("creates meal entry", () => {
    const entry = createMealEntry({
      mealType: "breakfast",
      mealName: "Eggs",
      carbohydrateGrams: 5,
      calories: 240,
      measuredAt
    });

    expect(entry.mealType).toBe("breakfast");
    expect(entry.carbohydrateGrams).toBe(5);
  });

  it("creates activity entries", () => {
    const steps = createActivityEntry({
      activityType: "steps",
      steps: 4500,
      measuredAt
    });
    const exercise = createActivityEntry({
      activityType: "exercise",
      durationMinutes: 30,
      measuredAt
    });

    expect(steps.steps).toBe(4500);
    expect(steps.durationMinutes).toBeNull();
    expect(exercise.steps).toBeNull();
    expect(exercise.durationMinutes).toBe(30);
  });

  it("validates reminder time format", () => {
    const valid = reminderPreferenceUpdateSchema.safeParse({
      measurementReminderTime: "07:30",
      hydrationReminderTime: "12:15",
      activityReminderTime: "19:45"
    });
    const invalid = reminderPreferenceUpdateSchema.safeParse({
      measurementReminderTime: "7:30"
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("creates phase-2 sync records", () => {
    const hydration = createHydrationEntry({
      amountMl: 250,
      measuredAt
    });
    const syncRecord = createSyncRecord("hydration", "create", hydration.id, hydration);

    expect(syncRecord.entity).toBe("hydration");
    expect(syncRecord.payload.amountMl).toBe(250);
  });
});
