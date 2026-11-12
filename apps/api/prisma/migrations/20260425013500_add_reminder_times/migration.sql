ALTER TABLE "ReminderPreference" ADD COLUMN "measurementReminderTime" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "ReminderPreference" ADD COLUMN "hydrationReminderTime" TEXT NOT NULL DEFAULT '11:00';
ALTER TABLE "ReminderPreference" ADD COLUMN "activityReminderTime" TEXT NOT NULL DEFAULT '18:00';
