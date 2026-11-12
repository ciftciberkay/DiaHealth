import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { DiabetesProfileType, GenderType, Prisma } from "@prisma/client";
import {
  activityEntrySchema,
  activityFormSchema,
  defaultProfile,
  glucoseEntrySchema,
  glucoseFormSchema,
  hydrationEntrySchema,
  hydrationFormSchema,
  mealEntrySchema,
  mealFormSchema,
  medicationEntrySchema,
  medicationFormSchema,
  medicationPlanEntrySchema,
  medicationPlanFormSchema,
  metricFormSchema,
  profileSettingsUpdateSchema,
  reminderPreferenceSchema,
  reminderPreferenceUpdateSchema,
  syncEnvelopeSchema,
  type GlucoseEntry,
  type HealthMetricEntry,
  type HydrationEntry,
  type MealEntry,
  type ActivityEntry,
  type MedicationEntry,
  type MedicationPlanEntry,
  type SyncRecord,
  type UserProfile
} from "@diahealth/shared";
import type { Request } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { PrismaService } from "./prisma.service";
import { FirebaseAuthGuard, type FirebaseRequestUser } from "./firebase-auth.guard";

type AuthenticatedRequest = Request & { user: FirebaseRequestUser };

const devCredentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: "Password must include uppercase, lowercase, and number"
  })
});

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const devUidForEmail = (email: string) => `dev-${email.replace(/[^a-z0-9]/g, "-")}`;
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, encodedValue: string) => {
  const [salt, storedHash] = encodedValue.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const nextHash = scryptSync(password, salt, 64);
  const previousHash = Buffer.from(storedHash, "hex");

  return previousHash.length === nextHash.length && timingSafeEqual(previousHash, nextHash);
};

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByFirebaseUid(firebaseUid: string) {
    return this.prisma.user.findUnique({
      where: { firebaseUid },
      include: { profile: true, devAuth: true }
    });
  }

  async ensureUser(user: FirebaseRequestUser) {
    const existing = await this.findByFirebaseUid(user.firebaseUid);

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          email: user.email,
          displayName: user.displayName ?? existing.displayName
        },
        include: { profile: true }
      });
    }

    return this.prisma.user.create({
      data: {
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName
      },
      include: { profile: true }
    });
  }

  async updateDisplayName(userId: string, displayName: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { displayName }
    });
  }

  async deleteUserAccount(user: FirebaseRequestUser) {
    const existing = await this.findByFirebaseUid(user.firebaseUid);
    const email = user.email?.trim().toLowerCase() ?? null;

    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.devAuthCredential.deleteMany({
          where: {
            OR: [
              { userId: existing.id },
              ...(email ? [{ email }] : [])
            ]
          }
        });
        await tx.glucoseLog.deleteMany({
          where: { userId: existing.id }
        });
        await tx.healthMetric.deleteMany({
          where: { userId: existing.id }
        });
        await tx.hydrationLog.deleteMany({
          where: { userId: existing.id }
        });
        await tx.medicationLog.deleteMany({
          where: { userId: existing.id }
        });
        await tx.medicationPlan.deleteMany({
          where: { userId: existing.id }
        });
        await tx.mealLog.deleteMany({
          where: { userId: existing.id }
        });
        await tx.activityLog.deleteMany({
          where: { userId: existing.id }
        });
        await tx.reminderPreference.deleteMany({
          where: { userId: existing.id }
        });
        await tx.userProfile.deleteMany({
          where: { userId: existing.id }
        });
        await tx.user.deleteMany({
          where: { id: existing.id }
        });
        return;
      }

      if (email) {
        await tx.devAuthCredential.deleteMany({
          where: { email }
        });
      }
    });
  }
}

@Injectable()
export class ProfilesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId }
    });

    if (profile) {
      return profile;
    }

    const defaults = defaultProfile(userId);
    return this.prisma.userProfile.create({
      data: {
        userId,
        language: defaults.language,
        gender: defaults.gender ?? undefined,
        diabetesProfile: defaults.diabetesProfile,
        fullName: defaults.fullName,
        heightCm: defaults.heightCm,
        weightKg: defaults.weightKg,
        onboardingCompleted: defaults.onboardingCompleted,
        disclaimerAcceptedAt: null
      }
    });
  }

  async updateProfile(userId: string, input: unknown) {
    const payload = input as Record<string, unknown>;
    const profile = await this.getProfile(userId);
    const profileValues = profileSettingsUpdateSchema.parse({
      language: payload.language,
      gender: payload.gender,
      diabetesProfile: payload.diabetesProfile,
      fullName: payload.fullName,
      heightCm: payload.heightCm,
      weightKg: payload.weightKg
    });
    const gender = profileValues.gender ?? profile.gender ?? null;
    let diabetesProfile: DiabetesProfileType = DiabetesProfileType.type2;

    if (profileValues.diabetesProfile === DiabetesProfileType.type1) {
      diabetesProfile = DiabetesProfileType.type1;
    } else if (profileValues.diabetesProfile === DiabetesProfileType.gestational) {
      diabetesProfile = DiabetesProfileType.gestational;
    } else if (profile.diabetesProfile === DiabetesProfileType.type1) {
      diabetesProfile = DiabetesProfileType.type1;
    } else if (profile.diabetesProfile === DiabetesProfileType.gestational) {
      diabetesProfile = DiabetesProfileType.gestational;
    }

    if (gender === GenderType.male && diabetesProfile === DiabetesProfileType.gestational) {
      diabetesProfile = DiabetesProfileType.type2;
    }

    const nextOnboardingCompleted =
      typeof payload.onboardingCompleted === "boolean" ? payload.onboardingCompleted : profile.onboardingCompleted;
    const nextDisclaimerAcceptedAt =
      payload.disclaimerAcceptedAt !== undefined
        ? payload.disclaimerAcceptedAt
          ? new Date(String(payload.disclaimerAcceptedAt))
          : null
        : nextOnboardingCompleted
          ? profile.disclaimerAcceptedAt ?? new Date()
          : profile.disclaimerAcceptedAt;

    const parsed = {
      language: profileValues.language ?? profile.language,
      gender,
      diabetesProfile,
      fullName: profileValues.fullName ?? profile.fullName,
      heightCm: profileValues.heightCm ?? profile.heightCm,
      weightKg: profileValues.weightKg ?? profile.weightKg,
      onboardingCompleted: nextOnboardingCompleted,
      disclaimerAcceptedAt: nextDisclaimerAcceptedAt
    };

    return this.prisma.userProfile.update({
      where: { id: profile.id },
      data: parsed
    });
  }
}

@Injectable()
export class ReminderPreferencesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getForUser(userId: string) {
    const existing = await this.prisma.reminderPreference.findUnique({
      where: { userId }
    });

    if (existing) {
      return existing;
    }

    const defaults = reminderPreferenceSchema.parse({
      measurementReminders: false,
      medicationReminders: false,
      hydrationReminders: false,
      activityReminders: false,
      measurementReminderTime: "08:00",
      hydrationReminderTime: "11:00",
      activityReminderTime: "18:00",
      healthPermissionApproved: false
    });

    return this.prisma.reminderPreference.create({
      data: {
        userId,
        measurementReminders: defaults.measurementReminders,
        medicationReminders: defaults.medicationReminders,
        hydrationReminders: defaults.hydrationReminders,
        activityReminders: defaults.activityReminders,
        measurementReminderTime: defaults.measurementReminderTime,
        hydrationReminderTime: defaults.hydrationReminderTime,
        activityReminderTime: defaults.activityReminderTime,
        healthPermissionApproved: defaults.healthPermissionApproved
      }
    });
  }

  async updateForUser(userId: string, input: unknown) {
    const existing = await this.getForUser(userId);
    const parsed = reminderPreferenceUpdateSchema.parse(input);

    return this.prisma.reminderPreference.update({
      where: { id: existing.id },
      data: {
        measurementReminders: parsed.measurementReminders ?? existing.measurementReminders,
        medicationReminders: parsed.medicationReminders ?? existing.medicationReminders,
        hydrationReminders: parsed.hydrationReminders ?? existing.hydrationReminders,
        activityReminders: parsed.activityReminders ?? existing.activityReminders,
        measurementReminderTime: parsed.measurementReminderTime ?? existing.measurementReminderTime,
        hydrationReminderTime: parsed.hydrationReminderTime ?? existing.hydrationReminderTime,
        activityReminderTime: parsed.activityReminderTime ?? existing.activityReminderTime,
        healthPermissionApproved: parsed.healthPermissionApproved ?? existing.healthPermissionApproved
      }
    });
  }
}

@Injectable()
export class DevAuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(ProfilesService) private readonly profilesService: ProfilesService
  ) {}

  async signUp(input: unknown) {
    const parsed = devCredentialsSchema.parse(input);
    const email = normalizeEmail(parsed.email);
    const firebaseUid = devUidForEmail(email);
    const existing = await this.prisma.devAuthCredential.findUnique({
      where: { email },
      include: { user: true }
    });

    if (existing) {
      throw new ConflictException("Account already exists");
    }

    const user = await this.prisma.user.upsert({
      where: { firebaseUid },
      update: {
        email,
        displayName: email.split("@")[0] ?? "DiaHealth"
      },
      create: {
        firebaseUid,
        email,
        displayName: email.split("@")[0] ?? "DiaHealth"
      },
      include: { profile: true }
    });

    try {
      await this.prisma.devAuthCredential.create({
        data: {
          email,
          passwordHash: hashPassword(parsed.password),
          userId: user.id
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Account already exists");
      }

      throw error;
    }

    return {
      user,
      profile: await this.profilesService.getProfile(user.id)
    };
  }

  async signIn(input: unknown) {
    const parsed = devCredentialsSchema.parse(input);
    const email = normalizeEmail(parsed.email);
    const account = await this.prisma.devAuthCredential.findUnique({
      where: { email },
      include: { user: true }
    });

    if (!account || !verifyPassword(parsed.password, account.passwordHash)) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const user = await this.usersService.ensureUser({
      firebaseUid: devUidForEmail(email),
      email,
      displayName: account.user.displayName ?? email.split("@")[0] ?? "DiaHealth"
    });

    return {
      user,
      profile: await this.profilesService.getProfile(user.id)
    };
  }
}

@Injectable()
export class GlucoseService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.glucoseLog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { measuredAt: "desc" }
    });
  }

  async create(userId: string, input: unknown) {
    const parsed = glucoseFormSchema.parse(input);
    const now = new Date().toISOString();

    return this.prisma.glucoseLog.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        readingType: parsed.readingType,
        valueMgDl: parsed.valueMgDl,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      }
    });
  }

  async update(userId: string, id: string, input: unknown) {
    const parsed = glucoseFormSchema.partial().parse(input);
    await this.assertOwnership(userId, id);

    return this.prisma.glucoseLog.update({
      where: { id },
      data: {
        readingType: parsed.readingType,
        valueMgDl: parsed.valueMgDl,
        measuredAt: parsed.measuredAt ? new Date(parsed.measuredAt) : undefined,
        note: parsed.note ?? null
      }
    });
  }

  async upsertFromSync(userId: string, record: SyncRecord) {
    const parsed = glucoseEntrySchema.parse(record.payload) as GlucoseEntry;
    const existing = await this.prisma.glucoseLog.findUnique({ where: { id: parsed.id } });
    const incomingUpdatedAt = new Date(record.updatedAt);

    if (existing && existing.updatedAt > incomingUpdatedAt) {
      return existing;
    }

    return this.prisma.glucoseLog.upsert({
      where: { id: parsed.id },
      create: {
        id: parsed.id,
        userId,
        readingType: parsed.readingType,
        valueMgDl: parsed.valueMgDl,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        createdAt: new Date(parsed.createdAt),
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      },
      update: {
        readingType: parsed.readingType,
        valueMgDl: parsed.valueMgDl,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      }
    });
  }

  private async assertOwnership(userId: string, id: string) {
    const existing = await this.prisma.glucoseLog.findUnique({ where: { id } });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Record not found");
    }
  }
}

@Injectable()
export class MetricsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.healthMetric.findMany({
      where: { userId, deletedAt: null },
      orderBy: { measuredAt: "desc" }
    });
  }

  async create(userId: string, input: unknown) {
    const parsed = metricFormSchema.parse(input);
    const now = new Date().toISOString();

    return this.prisma.healthMetric.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        metricType: parsed.metricType,
        value: parsed.value,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      }
    });
  }

  async update(userId: string, id: string, input: unknown) {
    const payload = input as Record<string, unknown>;
    const parsed =
      payload.metricType === "blood_pressure"
        ? metricFormSchema.parse({
            metricType: "blood_pressure",
            systolic: payload.systolic,
            diastolic: payload.diastolic,
            pulse: payload.pulse,
            measuredAt: payload.measuredAt ?? new Date().toISOString(),
            note: payload.note
          })
        : metricFormSchema.parse({
            metricType: payload.metricType ?? "hba1c",
            value: payload.value,
            measuredAt: payload.measuredAt ?? new Date().toISOString(),
            note: payload.note
          });
    await this.assertOwnership(userId, id);

    return this.prisma.healthMetric.update({
      where: { id },
      data: {
        metricType: parsed.metricType,
        value: parsed.value,
        measuredAt: parsed.measuredAt ? new Date(parsed.measuredAt) : undefined,
        note: parsed.note ?? null
      }
    });
  }

  async upsertFromSync(userId: string, record: SyncRecord) {
    const parsed = record.payload as HealthMetricEntry;
    const existing = await this.prisma.healthMetric.findUnique({ where: { id: parsed.id } });
    const incomingUpdatedAt = new Date(record.updatedAt);

    if (existing && existing.updatedAt > incomingUpdatedAt) {
      return existing;
    }

    return this.prisma.healthMetric.upsert({
      where: { id: parsed.id },
      create: {
        id: parsed.id,
        userId,
        metricType: parsed.metricType,
        value: parsed.value,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        createdAt: new Date(parsed.createdAt),
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      },
      update: {
        metricType: parsed.metricType,
        value: parsed.value,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      }
    });
  }

  private async assertOwnership(userId: string, id: string) {
    const existing = await this.prisma.healthMetric.findUnique({ where: { id } });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Record not found");
    }
  }
}

@Injectable()
export class HydrationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.hydrationLog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { measuredAt: "desc" }
    });
  }

  async create(userId: string, input: unknown) {
    const parsed = hydrationFormSchema.parse(input);
    const now = new Date().toISOString();

    return this.prisma.hydrationLog.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        amountMl: parsed.amountMl,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      }
    });
  }

  async update(userId: string, id: string, input: unknown) {
    const parsed = hydrationFormSchema.partial().parse(input);
    await this.assertOwnership(userId, id);

    return this.prisma.hydrationLog.update({
      where: { id },
      data: {
        amountMl: parsed.amountMl,
        measuredAt: parsed.measuredAt ? new Date(parsed.measuredAt) : undefined,
        note: parsed.note ?? null
      }
    });
  }

  async upsertFromSync(userId: string, record: SyncRecord) {
    const parsed = hydrationEntrySchema.parse(record.payload) as HydrationEntry;
    const existing = await this.prisma.hydrationLog.findUnique({ where: { id: parsed.id } });
    const incomingUpdatedAt = new Date(record.updatedAt);

    if (existing && existing.updatedAt > incomingUpdatedAt) {
      return existing;
    }

    return this.prisma.hydrationLog.upsert({
      where: { id: parsed.id },
      create: {
        id: parsed.id,
        userId,
        amountMl: parsed.amountMl,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        createdAt: new Date(parsed.createdAt),
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      },
      update: {
        amountMl: parsed.amountMl,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      }
    });
  }

  private async assertOwnership(userId: string, id: string) {
    const existing = await this.prisma.hydrationLog.findUnique({ where: { id } });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Record not found");
    }
  }
}

@Injectable()
export class MedicationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.medicationLog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { scheduledFor: "desc" }
    });
  }

  async create(userId: string, input: unknown) {
    const parsed = medicationFormSchema.parse(input);
    const now = new Date().toISOString();

    return this.prisma.medicationLog.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        medicationName: parsed.medicationName,
        dosage: parsed.dosage,
        scheduledFor: new Date(parsed.scheduledFor),
        status: parsed.status,
        takenAt: parsed.takenAt ? new Date(parsed.takenAt) : null,
        note: parsed.note ?? null,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      }
    });
  }

  async update(userId: string, id: string, input: unknown) {
    const parsed = medicationFormSchema.partial().parse(input);
    await this.assertOwnership(userId, id);

    return this.prisma.medicationLog.update({
      where: { id },
      data: {
        medicationName: parsed.medicationName,
        dosage: parsed.dosage,
        scheduledFor: parsed.scheduledFor ? new Date(parsed.scheduledFor) : undefined,
        status: parsed.status,
        takenAt:
          parsed.takenAt === undefined
            ? undefined
            : parsed.takenAt
              ? new Date(parsed.takenAt)
              : null,
        note: parsed.note ?? null
      }
    });
  }

  async upsertFromSync(userId: string, record: SyncRecord) {
    const parsed = medicationEntrySchema.parse(record.payload) as MedicationEntry;
    const existing = await this.prisma.medicationLog.findUnique({ where: { id: parsed.id } });
    const incomingUpdatedAt = new Date(record.updatedAt);

    if (existing && existing.updatedAt > incomingUpdatedAt) {
      return existing;
    }

    return this.prisma.medicationLog.upsert({
      where: { id: parsed.id },
      create: {
        id: parsed.id,
        userId,
        medicationName: parsed.medicationName,
        dosage: parsed.dosage,
        scheduledFor: new Date(parsed.scheduledFor),
        status: parsed.status,
        takenAt: parsed.takenAt ? new Date(parsed.takenAt) : null,
        note: parsed.note ?? null,
        createdAt: new Date(parsed.createdAt),
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      },
      update: {
        medicationName: parsed.medicationName,
        dosage: parsed.dosage,
        scheduledFor: new Date(parsed.scheduledFor),
        status: parsed.status,
        takenAt: parsed.takenAt ? new Date(parsed.takenAt) : null,
        note: parsed.note ?? null,
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      }
    });
  }

  private async assertOwnership(userId: string, id: string) {
    const existing = await this.prisma.medicationLog.findUnique({ where: { id } });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Record not found");
    }
  }
}

@Injectable()
export class MedicationPlanService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.medicationPlan.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isActive: "desc" }, { scheduleTime: "asc" }]
    });
  }

  async create(userId: string, input: unknown) {
    const parsed = medicationPlanFormSchema.parse(input);
    const now = new Date().toISOString();

    return this.prisma.medicationPlan.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        medicationName: parsed.medicationName,
        dosage: parsed.dosage,
        scheduleTime: parsed.scheduleTime,
        isActive: parsed.isActive,
        note: parsed.note ?? null,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      }
    });
  }

  async update(userId: string, id: string, input: unknown) {
    const parsed = medicationPlanFormSchema.partial().parse(input);
    await this.assertOwnership(userId, id);

    return this.prisma.medicationPlan.update({
      where: { id },
      data: {
        medicationName: parsed.medicationName,
        dosage: parsed.dosage,
        scheduleTime: parsed.scheduleTime,
        isActive: parsed.isActive,
        note: parsed.note ?? null
      }
    });
  }

  async upsertFromSync(userId: string, record: SyncRecord) {
    const parsed = medicationPlanEntrySchema.parse(record.payload) as MedicationPlanEntry;
    const existing = await this.prisma.medicationPlan.findUnique({ where: { id: parsed.id } });
    const incomingUpdatedAt = new Date(record.updatedAt);

    if (existing && existing.updatedAt > incomingUpdatedAt) {
      return existing;
    }

    return this.prisma.medicationPlan.upsert({
      where: { id: parsed.id },
      create: {
        id: parsed.id,
        userId,
        medicationName: parsed.medicationName,
        dosage: parsed.dosage,
        scheduleTime: parsed.scheduleTime,
        isActive: parsed.isActive,
        note: parsed.note ?? null,
        createdAt: new Date(parsed.createdAt),
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      },
      update: {
        medicationName: parsed.medicationName,
        dosage: parsed.dosage,
        scheduleTime: parsed.scheduleTime,
        isActive: parsed.isActive,
        note: parsed.note ?? null,
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      }
    });
  }

  private async assertOwnership(userId: string, id: string) {
    const existing = await this.prisma.medicationPlan.findUnique({ where: { id } });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Record not found");
    }
  }
}

@Injectable()
export class MealService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.mealLog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { measuredAt: "desc" }
    });
  }

  async create(userId: string, input: unknown) {
    const parsed = mealFormSchema.parse(input);
    const now = new Date().toISOString();

    return this.prisma.mealLog.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        mealType: parsed.mealType,
        mealName: parsed.mealName,
        carbohydrateGrams: parsed.carbohydrateGrams,
        calories: parsed.calories,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      }
    });
  }

  async update(userId: string, id: string, input: unknown) {
    const parsed = mealFormSchema.partial().parse(input);
    await this.assertOwnership(userId, id);

    return this.prisma.mealLog.update({
      where: { id },
      data: {
        mealType: parsed.mealType,
        mealName: parsed.mealName,
        carbohydrateGrams: parsed.carbohydrateGrams,
        calories: parsed.calories,
        measuredAt: parsed.measuredAt ? new Date(parsed.measuredAt) : undefined,
        note: parsed.note ?? null
      }
    });
  }

  async upsertFromSync(userId: string, record: SyncRecord) {
    const parsed = mealEntrySchema.parse(record.payload) as MealEntry;
    const existing = await this.prisma.mealLog.findUnique({ where: { id: parsed.id } });
    const incomingUpdatedAt = new Date(record.updatedAt);

    if (existing && existing.updatedAt > incomingUpdatedAt) {
      return existing;
    }

    return this.prisma.mealLog.upsert({
      where: { id: parsed.id },
      create: {
        id: parsed.id,
        userId,
        mealType: parsed.mealType,
        mealName: parsed.mealName,
        carbohydrateGrams: parsed.carbohydrateGrams,
        calories: parsed.calories,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        createdAt: new Date(parsed.createdAt),
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      },
      update: {
        mealType: parsed.mealType,
        mealName: parsed.mealName,
        carbohydrateGrams: parsed.carbohydrateGrams,
        calories: parsed.calories,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      }
    });
  }

  private async assertOwnership(userId: string, id: string) {
    const existing = await this.prisma.mealLog.findUnique({ where: { id } });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Record not found");
    }
  }
}

@Injectable()
export class ActivityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.activityLog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { measuredAt: "desc" }
    });
  }

  async create(userId: string, input: unknown) {
    const parsed = activityFormSchema.parse(input);
    const now = new Date().toISOString();

    return this.prisma.activityLog.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        activityType: parsed.activityType,
        steps: parsed.steps,
        durationMinutes: parsed.durationMinutes,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      }
    });
  }

  async update(userId: string, id: string, input: unknown) {
    const parsed = activityFormSchema.parse(input);
    await this.assertOwnership(userId, id);

    return this.prisma.activityLog.update({
      where: { id },
      data: {
        activityType: parsed.activityType,
        steps: parsed.steps,
        durationMinutes: parsed.durationMinutes,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null
      }
    });
  }

  async upsertFromSync(userId: string, record: SyncRecord) {
    const parsed = activityEntrySchema.parse(record.payload) as ActivityEntry;
    const existing = await this.prisma.activityLog.findUnique({ where: { id: parsed.id } });
    const incomingUpdatedAt = new Date(record.updatedAt);

    if (existing && existing.updatedAt > incomingUpdatedAt) {
      return existing;
    }

    return this.prisma.activityLog.upsert({
      where: { id: parsed.id },
      create: {
        id: parsed.id,
        userId,
        activityType: parsed.activityType,
        steps: parsed.steps ?? null,
        durationMinutes: parsed.durationMinutes ?? null,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        createdAt: new Date(parsed.createdAt),
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      },
      update: {
        activityType: parsed.activityType,
        steps: parsed.steps ?? null,
        durationMinutes: parsed.durationMinutes ?? null,
        measuredAt: new Date(parsed.measuredAt),
        note: parsed.note ?? null,
        updatedAt: incomingUpdatedAt,
        deletedAt: parsed.deletedAt ? new Date(parsed.deletedAt) : null
      }
    });
  }

  private async assertOwnership(userId: string, id: string) {
    const existing = await this.prisma.activityLog.findUnique({ where: { id } });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Record not found");
    }
  }
}

@Injectable()
export class SyncService {
  constructor(
    @Inject(ProfilesService) private readonly profilesService: ProfilesService,
    @Inject(GlucoseService) private readonly glucoseService: GlucoseService,
    @Inject(MetricsService) private readonly metricsService: MetricsService,
    @Inject(HydrationService) private readonly hydrationService: HydrationService,
    @Inject(MedicationService) private readonly medicationService: MedicationService,
    @Inject(MedicationPlanService) private readonly medicationPlanService: MedicationPlanService,
    @Inject(MealService) private readonly mealService: MealService,
    @Inject(ActivityService) private readonly activityService: ActivityService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async push(userId: string, input: unknown) {
    const payload = syncEnvelopeSchema.parse(input);

    for (const change of payload.changes) {
      if (change.entity === "profile") {
        await this.profilesService.updateProfile(userId, change.payload);
      }

      if (change.entity === "glucose") {
        await this.glucoseService.upsertFromSync(userId, change);
      }

      if (change.entity === "metric") {
        await this.metricsService.upsertFromSync(userId, change);
      }

      if (change.entity === "hydration") {
        await this.hydrationService.upsertFromSync(userId, change);
      }

      if (change.entity === "medication") {
        await this.medicationService.upsertFromSync(userId, change);
      }

      if (change.entity === "medication_plan") {
        await this.medicationPlanService.upsertFromSync(userId, change);
      }

      if (change.entity === "meal") {
        await this.mealService.upsertFromSync(userId, change);
      }

      if (change.entity === "activity") {
        await this.activityService.upsertFromSync(userId, change);
      }
    }

    return this.pull(userId, payload.lastPulledAt);
  }

  async pull(userId: string, since: string | null) {
    const cursor = since ? new Date(since) : new Date(0);
    const [profile, glucose, metrics, hydration, medication, medicationPlans, meals, activities] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.glucoseLog.findMany({
        where: { userId, updatedAt: { gt: cursor } },
        orderBy: { updatedAt: "asc" }
      }),
      this.prisma.healthMetric.findMany({
        where: { userId, updatedAt: { gt: cursor } },
        orderBy: { updatedAt: "asc" }
      }),
      this.prisma.hydrationLog.findMany({
        where: { userId, updatedAt: { gt: cursor } },
        orderBy: { updatedAt: "asc" }
      }),
      this.prisma.medicationLog.findMany({
        where: { userId, updatedAt: { gt: cursor } },
        orderBy: { updatedAt: "asc" }
      }),
      this.prisma.medicationPlan.findMany({
        where: { userId, updatedAt: { gt: cursor } },
        orderBy: { updatedAt: "asc" }
      }),
      this.prisma.mealLog.findMany({
        where: { userId, updatedAt: { gt: cursor } },
        orderBy: { updatedAt: "asc" }
      }),
      this.prisma.activityLog.findMany({
        where: { userId, updatedAt: { gt: cursor } },
        orderBy: { updatedAt: "asc" }
      })
    ]);

    return {
      cursor: new Date().toISOString(),
      profile:
        profile && profile.updatedAt > cursor
          ? this.mapProfile(profile)
          : profile && !since
            ? this.mapProfile(profile)
            : null,
      glucose: glucose.map((entry) => this.mapGlucose(entry)),
      metrics: metrics.map((entry) => this.mapMetric(entry)),
      hydration: hydration.map((entry) => this.mapHydration(entry)),
      medication: medication.map((entry) => this.mapMedication(entry)),
      medicationPlans: medicationPlans.map((entry) => this.mapMedicationPlan(entry)),
      meals: meals.map((entry) => this.mapMeal(entry)),
      activities: activities.map((entry) => this.mapActivity(entry))
    };
  }

  private mapProfile(profile: {
    id: string;
    userId: string;
    language: string;
    gender: GenderType | null;
    diabetesProfile: string;
    fullName: string;
    heightCm: number | null;
    weightKg: number | null;
    onboardingCompleted: boolean;
    disclaimerAcceptedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserProfile {
    return {
      id: profile.id,
      userId: profile.userId,
      language: profile.language as UserProfile["language"],
      gender: profile.gender as UserProfile["gender"],
      diabetesProfile: profile.diabetesProfile as UserProfile["diabetesProfile"],
      fullName: profile.fullName,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      onboardingCompleted: profile.onboardingCompleted,
      disclaimerAcceptedAt: profile.disclaimerAcceptedAt?.toISOString() ?? null,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString()
    };
  }

  private mapGlucose(entry: {
    id: string;
    userId: string;
    readingType: string;
    valueMgDl: number;
    measuredAt: Date;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): GlucoseEntry {
    return {
      id: entry.id,
      userId: entry.userId,
      readingType: entry.readingType as GlucoseEntry["readingType"],
      valueMgDl: entry.valueMgDl,
      measuredAt: entry.measuredAt.toISOString(),
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deletedAt: entry.deletedAt?.toISOString() ?? null
    };
  }

  private mapMetric(entry: {
    id: string;
    userId: string;
    metricType: string;
    value: string;
    measuredAt: Date;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): HealthMetricEntry {
    return {
      id: entry.id,
      userId: entry.userId,
      metricType: entry.metricType as HealthMetricEntry["metricType"],
      value: entry.value,
      measuredAt: entry.measuredAt.toISOString(),
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deletedAt: entry.deletedAt?.toISOString() ?? null
    };
  }

  private mapHydration(entry: {
    id: string;
    userId: string;
    amountMl: number;
    measuredAt: Date;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): HydrationEntry {
    return {
      id: entry.id,
      userId: entry.userId,
      amountMl: entry.amountMl,
      measuredAt: entry.measuredAt.toISOString(),
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deletedAt: entry.deletedAt?.toISOString() ?? null
    };
  }

  private mapMedication(entry: {
    id: string;
    userId: string;
    medicationName: string;
    dosage: string;
    scheduledFor: Date;
    status: "scheduled" | "taken" | "skipped";
    takenAt: Date | null;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): MedicationEntry {
    return {
      id: entry.id,
      userId: entry.userId,
      medicationName: entry.medicationName,
      dosage: entry.dosage,
      scheduledFor: entry.scheduledFor.toISOString(),
      status: entry.status,
      takenAt: entry.takenAt?.toISOString() ?? null,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deletedAt: entry.deletedAt?.toISOString() ?? null
    };
  }

  private mapMedicationPlan(entry: {
    id: string;
    userId: string;
    medicationName: string;
    dosage: string;
    scheduleTime: string;
    isActive: boolean;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): MedicationPlanEntry {
    return {
      id: entry.id,
      userId: entry.userId,
      medicationName: entry.medicationName,
      dosage: entry.dosage,
      scheduleTime: entry.scheduleTime,
      isActive: entry.isActive,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deletedAt: entry.deletedAt?.toISOString() ?? null
    };
  }

  private mapMeal(entry: {
    id: string;
    userId: string;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    mealName: string;
    carbohydrateGrams: number;
    calories: number;
    measuredAt: Date;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): MealEntry {
    return {
      id: entry.id,
      userId: entry.userId,
      mealType: entry.mealType,
      mealName: entry.mealName,
      carbohydrateGrams: entry.carbohydrateGrams,
      calories: entry.calories,
      measuredAt: entry.measuredAt.toISOString(),
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deletedAt: entry.deletedAt?.toISOString() ?? null
    };
  }

  private mapActivity(entry: {
    id: string;
    userId: string;
    activityType: "steps" | "exercise";
    steps: number | null;
    durationMinutes: number | null;
    measuredAt: Date;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): ActivityEntry {
    return {
      id: entry.id,
      userId: entry.userId,
      activityType: entry.activityType,
      steps: entry.steps,
      durationMinutes: entry.durationMinutes,
      measuredAt: entry.measuredAt.toISOString(),
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deletedAt: entry.deletedAt?.toISOString() ?? null
    };
  }

}

@Controller("auth")
@UseGuards(FirebaseAuthGuard)
export class AuthController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(ProfilesService) private readonly profilesService: ProfilesService,
    @Inject(ReminderPreferencesService) private readonly reminderPreferencesService: ReminderPreferencesService
  ) {}

  @Post("session")
  async session(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.ensureUser(req.user);
    const profile = await this.profilesService.getProfile(user.id);
    const reminderPreferences = await this.reminderPreferencesService.getForUser(user.id);

    return {
      user,
      profile,
      reminderPreferences
    };
  }
}

@Controller("auth/dev")
export class DevAuthController {
  constructor(@Inject(DevAuthService) private readonly devAuthService: DevAuthService) {}

  @Post("sign-up")
  async signUp(@Body() body: unknown) {
    return this.devAuthService.signUp(body);
  }

  @Post("sign-in")
  async signIn(@Body() body: unknown) {
    return this.devAuthService.signIn(body);
  }
}

@Controller("profile")
@UseGuards(FirebaseAuthGuard)
export class ProfileController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(ProfilesService) private readonly profilesService: ProfilesService
  ) {}

  @Get("me")
  async me(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.ensureUser(req.user);
    return this.profilesService.getProfile(user.id);
  }

  @Put("me")
  async update(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    const payload = body as Record<string, unknown>;
    const profile = await this.profilesService.updateProfile(user.id, body);

    if (typeof payload.fullName === "string" && payload.fullName.trim().length > 0) {
      await this.usersService.updateDisplayName(user.id, payload.fullName.trim());
    }

    return profile;
  }

  @Delete("me")
  async remove(@Req() req: AuthenticatedRequest) {
    await this.usersService.deleteUserAccount(req.user);

    return {
      success: true
    };
  }
}

@Controller("reminder-preferences")
@UseGuards(FirebaseAuthGuard)
export class ReminderPreferencesController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(ReminderPreferencesService) private readonly reminderPreferencesService: ReminderPreferencesService
  ) {}

  @Get("me")
  async me(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.ensureUser(req.user);
    return this.reminderPreferencesService.getForUser(user.id);
  }

  @Put("me")
  async update(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.reminderPreferencesService.updateForUser(user.id, body);
  }
}

@Controller("glucose")
@UseGuards(FirebaseAuthGuard)
export class GlucoseController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(GlucoseService) private readonly glucoseService: GlucoseService
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.ensureUser(req.user);
    return this.glucoseService.list(user.id);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.glucoseService.create(user.id, body);
  }

  @Patch(":id")
  async update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.glucoseService.update(user.id, id, body);
  }
}

@Controller("metrics")
@UseGuards(FirebaseAuthGuard)
export class MetricsController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(MetricsService) private readonly metricsService: MetricsService
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.ensureUser(req.user);
    return this.metricsService.list(user.id);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.metricsService.create(user.id, body);
  }

  @Patch(":id")
  async update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.metricsService.update(user.id, id, body);
  }
}

@Controller("hydration")
@UseGuards(FirebaseAuthGuard)
export class HydrationController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(HydrationService) private readonly hydrationService: HydrationService
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.ensureUser(req.user);
    return this.hydrationService.list(user.id);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.hydrationService.create(user.id, body);
  }

  @Patch(":id")
  async update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.hydrationService.update(user.id, id, body);
  }
}

@Controller("medications")
@UseGuards(FirebaseAuthGuard)
export class MedicationController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(MedicationService) private readonly medicationService: MedicationService
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.ensureUser(req.user);
    return this.medicationService.list(user.id);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.medicationService.create(user.id, body);
  }

  @Patch(":id")
  async update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.medicationService.update(user.id, id, body);
  }
}

@Controller("medication-plans")
@UseGuards(FirebaseAuthGuard)
export class MedicationPlanController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(MedicationPlanService) private readonly medicationPlanService: MedicationPlanService
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.ensureUser(req.user);
    return this.medicationPlanService.list(user.id);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.medicationPlanService.create(user.id, body);
  }

  @Patch(":id")
  async update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.medicationPlanService.update(user.id, id, body);
  }
}

@Controller("meals")
@UseGuards(FirebaseAuthGuard)
export class MealController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(MealService) private readonly mealService: MealService
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.ensureUser(req.user);
    return this.mealService.list(user.id);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.mealService.create(user.id, body);
  }

  @Patch(":id")
  async update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.mealService.update(user.id, id, body);
  }
}

@Controller("activities")
@UseGuards(FirebaseAuthGuard)
export class ActivityController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(ActivityService) private readonly activityService: ActivityService
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.ensureUser(req.user);
    return this.activityService.list(user.id);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.activityService.create(user.id, body);
  }

  @Patch(":id")
  async update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.activityService.update(user.id, id, body);
  }
}

@Controller("sync")
@UseGuards(FirebaseAuthGuard)
export class SyncController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(SyncService) private readonly syncService: SyncService
  ) {}

  @Post("push")
  async push(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const user = await this.usersService.ensureUser(req.user);
    return this.syncService.push(user.id, body);
  }

  @Get("pull")
  async pull(@Req() req: AuthenticatedRequest, @Query("since") since?: string) {
    const user = await this.usersService.ensureUser(req.user);
    return this.syncService.pull(user.id, since ?? null);
  }
}
