export type BottomRoute = "Home" | "SugarTracking" | "HealthValues" | "MealList" | "Profile";

const bottomRouteByScreen: Record<string, BottomRoute> = {
  Home: "Home",
  SugarTracking: "SugarTracking",
  Hba1cList: "SugarTracking",
  HealthValues: "HealthValues",
  WeightList: "HealthValues",
  BloodPressureList: "HealthValues",
  ActivityList: "HealthValues",
  MedicationList: "HealthValues",
  MedicationPlanList: "HealthValues",
  MealList: "MealList",
  HydrationList: "MealList",
  RecipeList: "MealList",
  GuideList: "MealList",
  ReportScreen: "MealList",
  Profile: "Profile"
};

export const bottomRouteForScreen = (screen: string | undefined): BottomRoute | null =>
  screen && Object.hasOwn(bottomRouteByScreen, screen) ? bottomRouteByScreen[screen] : null;
