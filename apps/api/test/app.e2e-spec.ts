import { Test } from "@nestjs/testing";
import { INestApplication, CanActivate, ExecutionContext } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseAuthGuard } from "../src/firebase-auth.guard";
import { PrismaService } from "../src/prisma.service";

const userId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";

type Row = Record<string, unknown> & { id: string; userId: string; updatedAt?: Date; deletedAt?: Date | null };

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const requestContext = context.switchToHttp().getRequest();
    requestContext.user = {
      firebaseUid: "firebase-user-1",
      email: "test@diahealth.app",
      displayName: "Test User"
    };
    return true;
  }
}

const createModel = () => {
  const rows: Row[] = [];

  return {
    rows,
    findMany: async ({ where }: { where?: { userId?: string; deletedAt?: null; updatedAt?: { gt: Date } } } = {}) =>
      rows.filter((row) => {
        if (where?.userId && row.userId !== where.userId) {
          return false;
        }

        if (where?.deletedAt === null && row.deletedAt !== null && row.deletedAt !== undefined) {
          return false;
        }

        if (where?.updatedAt?.gt && row.updatedAt && row.updatedAt <= where.updatedAt.gt) {
          return false;
        }

        return true;
      }),
    findUnique: async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id) ?? null,
    create: async ({ data }: { data: Row }) => {
      const row = { ...data, updatedAt: data.updatedAt ?? new Date(), deletedAt: data.deletedAt ?? null };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const index = rows.findIndex((row) => row.id === where.id);
      const next = { ...rows[index], ...data, updatedAt: data.updatedAt ?? new Date() } as Row;
      rows[index] = next;
      return next;
    },
    upsert: async ({ where, create, update }: { where: { id: string }; create: Row; update: Partial<Row> }) => {
      const existing = rows.find((row) => row.id === where.id);

      if (!existing) {
        rows.push({ ...create, deletedAt: create.deletedAt ?? null });
        return create;
      }

      Object.assign(existing, update);
      return existing;
    },
    deleteMany: async ({ where }: { where?: { userId?: string } } = {}) => {
      const kept = where?.userId ? rows.filter((row) => row.userId !== where.userId) : [];
      const count = rows.length - kept.length;
      rows.splice(0, rows.length, ...kept);
      return { count };
    }
  };
};

const createPrismaMock = () => {
  const profile = {
    id: profileId,
    userId,
    language: "en",
    gender: null,
    diabetesProfile: "type2",
    fullName: "",
    heightCm: null,
    weightKg: null,
    onboardingCompleted: false,
    disclaimerAcceptedAt: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z")
  };
  const user = {
    id: userId,
    firebaseUid: "firebase-user-1",
    email: "test@diahealth.app",
    displayName: "Test User",
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    profile
  };
  const prisma = {
    user: {
      findUnique: async () => user,
      create: async () => user,
      update: async ({ data }: { data: Partial<typeof user> }) => Object.assign(user, data),
      deleteMany: async () => ({ count: 1 })
    },
    userProfile: {
      findUnique: async () => profile,
      create: async () => profile,
      update: async ({ data }: { data: Partial<typeof profile> }) => Object.assign(profile, data, { updatedAt: new Date() }),
      deleteMany: async () => ({ count: 1 })
    },
    reminderPreference: {
      row: null as null | Record<string, unknown>,
      findUnique: async function () {
        return this.row;
      },
      create: async function ({ data }: { data: Record<string, unknown> }) {
        this.row = { id: "33333333-3333-4333-8333-333333333333", ...data, createdAt: new Date(), updatedAt: new Date() };
        return this.row;
      },
      update: async function ({ data }: { data: Record<string, unknown> }) {
        this.row = { ...this.row, ...data, updatedAt: new Date() };
        return this.row;
      },
      deleteMany: async function () {
        this.row = null;
        return { count: 1 };
      }
    },
    glucoseLog: createModel(),
    healthMetric: createModel(),
    hydrationLog: createModel(),
    medicationLog: createModel(),
    medicationPlan: createModel(),
    mealLog: createModel(),
    activityLog: createModel(),
    devAuthCredential: {
      deleteMany: async () => ({ count: 0 })
    },
    $transaction: async function (callback: (tx: unknown) => Promise<void>) {
      await callback(this);
    }
  };

  return prisma as unknown as PrismaService;
};

describe("Phase 1 and 2 API", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideGuard(FirebaseAuthGuard)
      .useClass(MockAuthGuard)
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("exposes guarded profile and reminder preference routes", async () => {
    await request(app.getHttpServer()).get("/profile/me").expect(200);
    await request(app.getHttpServer())
      .put("/reminder-preferences/me")
      .send({
        measurementReminders: true,
        hydrationReminders: true,
        activityReminders: true,
        measurementReminderTime: "08:30",
        hydrationReminderTime: "12:00",
        activityReminderTime: "19:00"
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.measurementReminderTime).toBe("08:30");
      });
  });

  it("supports phase 1 glucose and metric CRUD routes", async () => {
    const measuredAt = new Date("2026-05-10T08:00:00.000Z").toISOString();
    const glucose = await request(app.getHttpServer())
      .post("/glucose")
      .send({ readingType: "morning_fasting", valueMgDl: 112, measuredAt, note: "test" })
      .expect(201);

    await request(app.getHttpServer()).patch(`/glucose/${glucose.body.id}`).send({ valueMgDl: 118, measuredAt }).expect(200);
    await request(app.getHttpServer()).get("/glucose").expect(200).expect((response) => {
      expect(response.body).toHaveLength(1);
      expect(response.body[0].valueMgDl).toBe(118);
    });

    await request(app.getHttpServer()).post("/metrics").send({ metricType: "weight", value: "78", measuredAt }).expect(201);
    await request(app.getHttpServer()).get("/metrics").expect(200).expect((response) => {
      expect(response.body[0].value).toBe("78");
    });
  });

  it("supports phase 2 daily-management CRUD routes", async () => {
    const measuredAt = new Date("2026-05-10T10:00:00.000Z").toISOString();
    const medicationAt = new Date("2026-05-10T21:00:00.000Z").toISOString();

    await request(app.getHttpServer()).post("/hydration").send({ amountMl: 300, measuredAt }).expect(201);
    await request(app.getHttpServer()).post("/meals").send({ mealType: "breakfast", mealName: "Yulaf", carbohydrateGrams: 33, calories: 188, measuredAt }).expect(201);
    await request(app.getHttpServer()).post("/activities").send({ activityType: "steps", steps: 4500, measuredAt }).expect(201);
    await request(app.getHttpServer()).post("/medications").send({ medicationName: "Metformin", dosage: "500 mg", scheduledFor: medicationAt, status: "scheduled" }).expect(201);
    await request(app.getHttpServer()).post("/medication-plans").send({ medicationName: "D Vitamini", dosage: "1000 IU", scheduleTime: "21:00", isActive: true }).expect(201);

    await request(app.getHttpServer()).get("/hydration").expect(200).expect((response) => expect(response.body).toHaveLength(1));
    await request(app.getHttpServer()).get("/meals").expect(200).expect((response) => expect(response.body[0].mealName).toBe("Yulaf"));
    await request(app.getHttpServer()).get("/activities").expect(200).expect((response) => expect(response.body[0].steps).toBe(4500));
    await request(app.getHttpServer()).get("/medications").expect(200).expect((response) => expect(response.body[0].medicationName).toBe("Metformin"));
    await request(app.getHttpServer()).get("/medication-plans").expect(200).expect((response) => expect(response.body[0].scheduleTime).toBe("21:00"));
  });

  it("pushes and pulls sync data for another device", async () => {
    const now = new Date("2026-05-10T12:00:00.000Z").toISOString();
    const glucoseId = "44444444-4444-4444-8444-444444444444";
    const mealId = "55555555-5555-4555-8555-555555555555";
    const payload = {
      lastPulledAt: null,
      changes: [
        {
          entity: "glucose",
          operation: "create",
          recordId: glucoseId,
          updatedAt: now,
          payload: {
            id: glucoseId,
            readingType: "morning_fasting",
            valueMgDl: 121,
            measuredAt: now,
            note: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null
          }
        },
        {
          entity: "meal",
          operation: "create",
          recordId: mealId,
          updatedAt: now,
          payload: {
            id: mealId,
            mealType: "lunch",
            mealName: "Salata",
            carbohydrateGrams: 15,
            calories: 220,
            measuredAt: now,
            note: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null
          }
        }
      ]
    };

    await request(app.getHttpServer()).post("/sync/push").send(payload).expect(201);
    await request(app.getHttpServer()).get("/sync/pull").expect(200).expect((response) => {
      expect(response.body.glucose.some((item: { id: string }) => item.id === glucoseId)).toBe(true);
      expect(response.body.meals.some((item: { id: string }) => item.id === mealId)).toBe(true);
    });
  });

  it("deletes account data without leaving phase-2 records behind", async () => {
    const measuredAt = new Date("2026-05-10T10:00:00.000Z").toISOString();

    await request(app.getHttpServer()).post("/hydration").send({ amountMl: 300, measuredAt }).expect(201);
    await request(app.getHttpServer()).post("/meals").send({ mealType: "breakfast", mealName: "Yulaf", carbohydrateGrams: 33, calories: 188, measuredAt }).expect(201);
    await request(app.getHttpServer()).delete("/profile/me").expect(200);
    await request(app.getHttpServer()).get("/hydration").expect(200).expect((response) => expect(response.body).toHaveLength(0));
    await request(app.getHttpServer()).get("/meals").expect(200).expect((response) => expect(response.body).toHaveLength(0));
  });
});
