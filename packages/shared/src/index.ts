import { z } from "zod";

export const languageSchema = z.enum(["tr", "en"]);
export const genderSchema = z.enum(["male", "female"]);
export const diabetesProfileSchema = z.enum(["type1", "type2", "gestational"]);
export const glucoseReadingTypeSchema = z.enum([
  "fasting",
  "postprandial",
  "night",
  "morning_fasting",
  "morning_postprandial",
  "noon_fasting",
  "noon_postprandial",
  "evening_fasting",
  "evening_postprandial"
]);
export const healthMetricTypeSchema = z.enum(["hba1c", "blood_pressure", "weight"]);
export const medicationStatusSchema = z.enum(["scheduled", "taken", "skipped"]);
export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const activityTypeSchema = z.enum(["steps", "exercise"]);
export const syncOperationSchema = z.enum(["create", "update"]);
export const syncEntitySchema = z.enum(["profile", "glucose", "metric", "hydration", "medication", "medication_plan", "meal", "activity"]);

export type Language = z.infer<typeof languageSchema>;
export type GenderType = z.infer<typeof genderSchema>;
export type DiabetesProfileType = z.infer<typeof diabetesProfileSchema>;
export type GlucoseReadingType = z.infer<typeof glucoseReadingTypeSchema>;
export type HealthMetricType = z.infer<typeof healthMetricTypeSchema>;
export type MedicationStatus = z.infer<typeof medicationStatusSchema>;
export type MealType = z.infer<typeof mealTypeSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type SyncOperation = z.infer<typeof syncOperationSchema>;
export type SyncEntity = z.infer<typeof syncEntitySchema>;

export const authSessionSchema = z.object({
  firebaseUid: z.string().min(1),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  idToken: z.string().min(1)
});

export const userProfileSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  language: languageSchema,
  gender: genderSchema.nullable().optional(),
  diabetesProfile: diabetesProfileSchema,
  fullName: z.string().max(80),
  heightCm: z.number().min(80).max(260).nullable().optional(),
  weightKg: z.number().min(20).max(350).nullable().optional(),
  onboardingCompleted: z.boolean(),
  disclaimerAcceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

export const glucoseEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  readingType: glucoseReadingTypeSchema,
  valueMgDl: z.number().positive(),
  measuredAt: z.string().datetime(),
  note: z.string().max(280).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional()
});

export const healthMetricEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  metricType: healthMetricTypeSchema,
  value: z.string().min(1),
  measuredAt: z.string().datetime(),
  note: z.string().max(280).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional()
});

export const hydrationEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  amountMl: z.number().int().positive(),
  measuredAt: z.string().datetime(),
  note: z.string().max(280).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional()
});

export const medicationEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  medicationName: z.string().min(2).max(120),
  dosage: z.string().min(1).max(80),
  scheduledFor: z.string().datetime(),
  status: medicationStatusSchema,
  takenAt: z.string().datetime().nullable().optional(),
  note: z.string().max(280).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional()
});

export const medicationPlanEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  medicationName: z.string().min(2).max(120),
  dosage: z.string().min(1).max(80),
  scheduleTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isActive: z.boolean(),
  note: z.string().max(280).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional()
});

export const mealEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  mealType: mealTypeSchema,
  mealName: z.string().min(2).max(120),
  carbohydrateGrams: z.number().min(0).max(500),
  calories: z.number().int().min(0).max(5000),
  measuredAt: z.string().datetime(),
  note: z.string().max(280).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional()
});

export const activityEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  activityType: activityTypeSchema,
  steps: z.number().int().min(0).max(100000).nullable().optional(),
  durationMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  measuredAt: z.string().datetime(),
  note: z.string().max(280).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional()
});

export const emergencyCardSchema = z.object({
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(5).max(32),
  relationship: z.string().trim().max(80).optional().nullable(),
  medicalNotes: z.string().trim().max(500).optional().nullable()
});

export const reminderTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const reminderPreferenceSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  measurementReminders: z.boolean(),
  medicationReminders: z.boolean(),
  hydrationReminders: z.boolean(),
  activityReminders: z.boolean(),
  measurementReminderTime: reminderTimeSchema,
  hydrationReminderTime: reminderTimeSchema,
  activityReminderTime: reminderTimeSchema,
  healthPermissionApproved: z.boolean(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

export const reminderPreferenceUpdateSchema = z.object({
  measurementReminders: z.boolean().optional(),
  medicationReminders: z.boolean().optional(),
  hydrationReminders: z.boolean().optional(),
  activityReminders: z.boolean().optional(),
  measurementReminderTime: reminderTimeSchema.optional(),
  hydrationReminderTime: reminderTimeSchema.optional(),
  activityReminderTime: reminderTimeSchema.optional(),
  healthPermissionApproved: z.boolean().optional()
});

export const syncRecordSchema = z.object({
  entity: syncEntitySchema,
  operation: syncOperationSchema,
  recordId: z.string(),
  payload: z.record(z.any()),
  updatedAt: z.string().datetime()
});

export const syncEnvelopeSchema = z.object({
  lastPulledAt: z.string().datetime().nullable(),
  changes: z.array(syncRecordSchema)
});

export const syncPullResponseSchema = z.object({
  cursor: z.string().datetime(),
  profile: userProfileSchema.nullable(),
  glucose: z.array(glucoseEntrySchema),
  metrics: z.array(healthMetricEntrySchema),
  hydration: z.array(hydrationEntrySchema),
  medication: z.array(medicationEntrySchema),
  medicationPlans: z.array(medicationPlanEntrySchema),
  meals: z.array(mealEntrySchema),
  activities: z.array(activityEntrySchema)
});

export type AuthSession = z.infer<typeof authSessionSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type GlucoseEntry = z.infer<typeof glucoseEntrySchema>;
export type HealthMetricEntry = z.infer<typeof healthMetricEntrySchema>;
export type HydrationEntry = z.infer<typeof hydrationEntrySchema>;
export type MedicationEntry = z.infer<typeof medicationEntrySchema>;
export type MedicationPlanEntry = z.infer<typeof medicationPlanEntrySchema>;
export type MealEntry = z.infer<typeof mealEntrySchema>;
export type ActivityEntry = z.infer<typeof activityEntrySchema>;
export type EmergencyCard = z.infer<typeof emergencyCardSchema>;
export type ReminderPreference = z.infer<typeof reminderPreferenceSchema>;
export type SyncRecord = z.infer<typeof syncRecordSchema>;
export type SyncEnvelope = z.infer<typeof syncEnvelopeSchema>;
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;

const profileSettingsBaseSchema = z.object({
  language: languageSchema,
  gender: genderSchema,
  diabetesProfile: diabetesProfileSchema,
  fullName: z.string().trim().min(2).max(80),
  heightCm: z.coerce.number().min(80).max(260),
  weightKg: z.coerce.number().min(20).max(350)
});

export const profileSettingsUpdateSchema = z.object({
  language: languageSchema.optional(),
  gender: genderSchema.optional(),
  diabetesProfile: diabetesProfileSchema.optional(),
  fullName: z.string().trim().min(2).max(80).optional(),
  heightCm: z.coerce.number().min(80).max(260).optional(),
  weightKg: z.coerce.number().min(20).max(350).optional()
});

export const profileSettingsFormSchema = profileSettingsBaseSchema.superRefine((input, ctx) => {
  if (input.gender === "male" && input.diabetesProfile === "gestational") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["diabetesProfile"],
      message: "Gestational diabetes is not available for male profiles"
    });
  }
});

export const onboardingFormSchema = profileSettingsBaseSchema.extend({
  acceptsDisclaimer: z.literal(true)
}).superRefine((input, ctx) => {
  if (input.gender === "male" && input.diabetesProfile === "gestational") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["diabetesProfile"],
      message: "Gestational diabetes is not available for male profiles"
    });
  }
});

export const glucoseFormSchema = z.object({
  readingType: glucoseReadingTypeSchema,
  valueMgDl: z.coerce.number().min(20).max(600),
  measuredAt: z.string().datetime(),
  note: z.string().max(280).optional().nullable()
});

export const metricFormSchema = z.object({
  metricType: healthMetricTypeSchema,
  value: z.string().max(40).optional(),
  systolic: z.coerce.number().int().min(40).max(280).optional(),
  diastolic: z.coerce.number().int().min(30).max(180).optional(),
  pulse: z.coerce.number().int().min(30).max(220).optional(),
  measuredAt: z.string().datetime(),
  note: z.string().max(280).optional().nullable()
}).superRefine((input, ctx) => {
  if (input.metricType === "blood_pressure") {
    if (!input.systolic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["systolic"],
        message: "Systolic value is required"
      });
    }

    if (!input.diastolic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diastolic"],
        message: "Diastolic value is required"
      });
    }

    if (!input.pulse) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pulse"],
        message: "Pulse value is required"
      });
    }

    return;
  }

  if (!input.value?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "Value is required"
    });
  }

  if (input.metricType === "hba1c") {
    const normalizedValue = input.value?.trim().replace(",", ".") ?? "";
    const numericValue = Number.parseFloat(normalizedValue);

    if (!Number.isFinite(numericValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "HbA1c value must be numeric"
      });
    }
  }
}).transform((input) => {
  const normalizedValue = input.value?.trim() ?? "";

  return {
    metricType: input.metricType,
    value:
      input.metricType === "blood_pressure"
        ? `${input.systolic}/${input.diastolic} mmHg • Nabız ${input.pulse}`
        : input.metricType === "hba1c"
          ? Number.parseFloat(normalizedValue.replace(",", ".")).toFixed(1).replace(".", ",")
          : normalizedValue,
    measuredAt: input.measuredAt,
    note: input.note ?? null,
    systolic: input.systolic,
    diastolic: input.diastolic,
    pulse: input.pulse
  };
});

export const hydrationFormSchema = z.object({
  amountMl: z.coerce.number().int().min(50).max(5000),
  measuredAt: z.string().datetime(),
  note: z.string().max(280).optional().nullable()
});

export const medicationFormSchema = z.object({
  medicationName: z.string().trim().min(2).max(120),
  dosage: z.string().trim().min(1).max(80),
  scheduledFor: z.string().datetime(),
  status: medicationStatusSchema,
  takenAt: z.string().datetime().nullable().optional(),
  note: z.string().max(280).optional().nullable()
});

export const medicationPlanFormSchema = z.object({
  medicationName: z.string().trim().min(2).max(120),
  dosage: z.string().trim().min(1).max(80),
  scheduleTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isActive: z.boolean(),
  note: z.string().max(280).optional().nullable()
});

export const mealFormSchema = z.object({
  mealType: mealTypeSchema,
  mealName: z.string().trim().min(2).max(120),
  carbohydrateGrams: z.coerce.number().min(0).max(500),
  calories: z.coerce.number().int().min(0).max(5000),
  measuredAt: z.string().datetime(),
  note: z.string().max(280).optional().nullable()
});

export const activityFormSchema = z.object({
  activityType: activityTypeSchema,
  steps: z.coerce.number().int().min(0).max(100000).optional(),
  durationMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  measuredAt: z.string().datetime(),
  note: z.string().max(280).optional().nullable()
}).superRefine((input, ctx) => {
  if (input.activityType === "steps" && (!input.steps || input.steps <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["steps"],
      message: "Steps are required"
    });
  }

  if (input.activityType === "exercise" && (!input.durationMinutes || input.durationMinutes <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["durationMinutes"],
      message: "Exercise duration is required"
    });
  }
}).transform((input) => ({
  activityType: input.activityType,
  steps: input.activityType === "steps" ? input.steps ?? 0 : null,
  durationMinutes: input.activityType === "exercise" ? input.durationMinutes ?? 0 : null,
  measuredAt: input.measuredAt,
  note: input.note ?? null
}));

export const defaultProfile = (
  userId: string,
  language: Language = "en",
  diabetesProfile: DiabetesProfileType = "type2"
): UserProfile => {
  const now = new Date().toISOString();

  return {
    userId,
    language,
    gender: null,
    diabetesProfile,
    fullName: "",
    heightCm: null,
    weightKg: null,
    onboardingCompleted: false,
    disclaimerAcceptedAt: null,
    createdAt: now,
    updatedAt: now
  };
};
