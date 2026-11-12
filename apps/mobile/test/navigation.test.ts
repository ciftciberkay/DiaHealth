import { describe, expect, it } from "vitest";
import { bottomRouteForScreen } from "../src/navigation";

describe("persistent bottom menu", () => {
  it.each([
    ["Home", "Home"],
    ["SugarTracking", "SugarTracking"],
    ["Hba1cList", "SugarTracking"],
    ["HealthValues", "HealthValues"],
    ["WeightList", "HealthValues"],
    ["BloodPressureList", "HealthValues"],
    ["ActivityList", "HealthValues"],
    ["MedicationList", "HealthValues"],
    ["MedicationPlanList", "HealthValues"],
    ["MealList", "MealList"],
    ["HydrationList", "MealList"],
    ["RecipeList", "MealList"],
    ["GuideList", "MealList"],
    ["ReportScreen", "MealList"],
    ["Profile", "Profile"]
  ])("keeps the correct tab selected on %s", (screen, expected) => {
    expect(bottomRouteForScreen(screen)).toBe(expected);
  });

  it.each([
    "SignIn", "AddGlucose", "GlucoseEntryForm", "AddMetric", "AddMeal", "AddHydration",
    "AddActivity", "AddMedication", "AddMedicationPlan", "EmergencyCard", "Unknown", undefined
  ])("hides the menu on form and unauthenticated screens: %s", (screen) => {
    expect(bottomRouteForScreen(screen)).toBeNull();
  });
});
