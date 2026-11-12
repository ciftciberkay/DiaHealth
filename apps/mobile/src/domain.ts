import {
  type GlucoseEntry,
  type HealthMetricEntry,
  type HydrationEntry,
  type MedicationEntry,
  type MedicationPlanEntry,
  type MealEntry,
  type ActivityEntry,
  type SyncRecord,
  type DiabetesProfileType,
  type GenderType,
  type GlucoseReadingType,
  type HealthMetricType,
  type MedicationStatus,
  type MealType,
  type ActivityType,
  activityFormSchema,
  glucoseFormSchema,
  hydrationFormSchema,
  mealFormSchema,
  medicationFormSchema,
  medicationPlanFormSchema,
  metricFormSchema
} from "@diahealth/shared";

const timestamp = () => new Date().toISOString();
const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    const nextValue = value === "x" ? random : (random & 0x3) | 0x8;

    return nextValue.toString(16);
  });

export const deriveLanguage = (locale: string) => (locale.toLowerCase().startsWith("tr") ? "tr" : "en");

export const createGlucoseEntry = (input: {
  readingType: GlucoseReadingType;
  valueMgDl: number;
  measuredAt: string;
  note?: string | null;
}): GlucoseEntry => {
  const parsed = glucoseFormSchema.parse(input);
  const now = timestamp();

  return {
    id: createId(),
    readingType: parsed.readingType,
    valueMgDl: parsed.valueMgDl,
    measuredAt: parsed.measuredAt,
    note: parsed.note ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
};

export const createMetricEntry = (input: {
  metricType: HealthMetricType;
  value?: string;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  measuredAt: string;
  note?: string | null;
}): HealthMetricEntry => {
  const parsed = metricFormSchema.parse(input);
  const now = timestamp();

  return {
    id: createId(),
    metricType: parsed.metricType,
    value: parsed.value,
    measuredAt: parsed.measuredAt,
    note: parsed.note ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
};

export const createHydrationEntry = (input: {
  amountMl: number;
  measuredAt: string;
  note?: string | null;
}): HydrationEntry => {
  const parsed = hydrationFormSchema.parse(input);
  const now = timestamp();

  return {
    id: createId(),
    amountMl: parsed.amountMl,
    measuredAt: parsed.measuredAt,
    note: parsed.note ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
};

export const createMedicationEntry = (input: {
  medicationName: string;
  dosage: string;
  scheduledFor: string;
  status: MedicationStatus;
  takenAt?: string | null;
  note?: string | null;
}): MedicationEntry => {
  const parsed = medicationFormSchema.parse(input);
  const now = timestamp();

  return {
    id: createId(),
    medicationName: parsed.medicationName,
    dosage: parsed.dosage,
    scheduledFor: parsed.scheduledFor,
    status: parsed.status,
    takenAt: parsed.takenAt ?? null,
    note: parsed.note ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
};

export const createMedicationPlanEntry = (input: {
  medicationName: string;
  dosage: string;
  scheduleTime: string;
  isActive: boolean;
  note?: string | null;
}): MedicationPlanEntry => {
  const parsed = medicationPlanFormSchema.parse(input);
  const now = timestamp();

  return {
    id: createId(),
    medicationName: parsed.medicationName,
    dosage: parsed.dosage,
    scheduleTime: parsed.scheduleTime,
    isActive: parsed.isActive,
    note: parsed.note ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
};

export const createMealEntry = (input: {
  mealType: MealType;
  mealName: string;
  carbohydrateGrams: number;
  calories: number;
  measuredAt: string;
  note?: string | null;
}): MealEntry => {
  const parsed = mealFormSchema.parse(input);
  const now = timestamp();

  return {
    id: createId(),
    mealType: parsed.mealType,
    mealName: parsed.mealName,
    carbohydrateGrams: parsed.carbohydrateGrams,
    calories: parsed.calories,
    measuredAt: parsed.measuredAt,
    note: parsed.note ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
};

export const createActivityEntry = (input: {
  activityType: ActivityType;
  steps?: number | null;
  durationMinutes?: number | null;
  measuredAt: string;
  note?: string | null;
}): ActivityEntry => {
  const parsed = activityFormSchema.parse(input);
  const now = timestamp();

  return {
    id: createId(),
    activityType: parsed.activityType,
    steps: parsed.steps ?? null,
    durationMinutes: parsed.durationMinutes ?? null,
    measuredAt: parsed.measuredAt,
    note: parsed.note ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
};

export const createSyncRecord = (
  entity: SyncRecord["entity"],
  operation: SyncRecord["operation"],
  recordId: string,
  payload: Record<string, unknown>
): SyncRecord => ({
  entity,
  operation,
  recordId,
  payload,
  updatedAt: timestamp()
});

export const profileDraft = (profile: {
  language: "tr" | "en";
  gender: GenderType;
  diabetesProfile: DiabetesProfileType;
  fullName: string;
  heightCm: number;
  weightKg: number;
  onboardingCompleted?: boolean;
}) => ({
  ...profile,
  onboardingCompleted: profile.onboardingCompleted ?? true,
  disclaimerAcceptedAt: timestamp()
});
