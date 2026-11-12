import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import {
  ActivityController,
  ActivityService,
  AuthController,
  DevAuthController,
  DevAuthService,
  GlucoseController,
  GlucoseService,
  HydrationController,
  HydrationService,
  MealController,
  MealService,
  MedicationController,
  MedicationPlanController,
  MedicationPlanService,
  MedicationService,
  MetricsController,
  MetricsService,
  ProfileController,
  ProfilesService,
  ReminderPreferencesController,
  ReminderPreferencesService,
  SyncController,
  SyncService,
  UsersService
} from "./features";

@Module({
  controllers: [AuthController, DevAuthController, ProfileController, ReminderPreferencesController, GlucoseController, MetricsController, HydrationController, MedicationController, MedicationPlanController, MealController, ActivityController, SyncController],
  providers: [PrismaService, UsersService, DevAuthService, ProfilesService, ReminderPreferencesService, GlucoseService, MetricsService, HydrationService, MedicationService, MedicationPlanService, MealService, ActivityService, SyncService]
})
export class AppModule {}
