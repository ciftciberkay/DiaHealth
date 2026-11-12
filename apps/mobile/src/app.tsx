import * as React from "react";
import { Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Constants from "expo-constants";
import * as SQLite from "expo-sqlite";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as Notifications from "expo-notifications";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CommonActions, NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { initReactI18next, useTranslation } from "react-i18next";
import i18n from "i18next";
import diaHealthLogo from "../assets/diahealth-logo.png";
import tabFoodDarkIcon from "../assets/tab-food-dark.png";
import tabFoodIcon from "../assets/tab-food.png";
import tabGlucoseDarkIcon from "../assets/tab-glucose-dark.png";
import tabGlucoseIcon from "../assets/tab-glucose.png";
import tabHealthDarkIcon from "../assets/tab-health-dark.png";
import tabHealthIcon from "../assets/tab-health.png";
import tabProfileDarkIcon from "../assets/tab-profile-dark.png";
import tabProfileIcon from "../assets/tab-profile.png";
import { initializeApp, getApps } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  OAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import {
  activityEntrySchema,
  activityFormSchema,
  emergencyCardSchema,
  glucoseEntrySchema,
  glucoseFormSchema,
  healthMetricEntrySchema,
  hydrationEntrySchema,
  hydrationFormSchema,
  mealEntrySchema,
  mealFormSchema,
  medicationEntrySchema,
  medicationFormSchema,
  medicationPlanEntrySchema,
  medicationPlanFormSchema,
  metricFormSchema,
  profileSettingsFormSchema,
  type GlucoseEntry,
  type HealthMetricEntry,
  type HydrationEntry,
  type MealEntry,
  type ActivityEntry,
  type EmergencyCard,
  type MedicationEntry,
  type MedicationPlanEntry,
  type ReminderPreference,
  type UserProfile
} from "@diahealth/shared";
import {
  createActivityEntry,
  createGlucoseEntry,
  createHydrationEntry,
  createMealEntry,
  createMedicationEntry,
  createMedicationPlanEntry,
  createMetricEntry,
  createSyncRecord
} from "./domain";
import rawFoodCatalog from "./foodCatalog.json";
import { createAssetCache } from "./assetCache";
import { bottomRouteForScreen, type BottomRoute } from "./navigation";

const darkPalette = {
  ink: "#F5F8FF",
  mist: "#07111F",
  surface: "#0D1B2E",
  surfaceElevated: "#12243A",
  surfaceSoft: "#172B45",
  navigationSurface: "#1A2E47",
  border: "#22344D",
  muted: "#9AA8BD",
  accent: "#2F80FF",
  accentSoft: "#17345F",
  accentBright: "#35D0FF",
  purple: "#7C5CFF",
  success: "#2ED47A",
  orange: "#FFB020",
  warning: "#FF5C7A"
};
const lightPalette: typeof darkPalette = {
  ink: "#152033",
  mist: "#F6FAF8",
  surface: "#FFFFFF",
  surfaceElevated: "#EEF7F3",
  surfaceSoft: "#E3F2EC",
  navigationSurface: "#FFFFFF",
  border: "#D5E5DF",
  muted: "#65758B",
  accent: "#18A76D",
  accentSoft: "#E4F7EF",
  accentBright: "#35D0A0",
  purple: "#5B5FEF",
  success: "#16A34A",
  orange: "#F59E0B",
  warning: "#DC2626"
};
type ThemeMode = "dark" | "light";
const themePalettes = {
  dark: darkPalette,
  light: lightPalette
} as const;
let activeThemeMode: ThemeMode = "dark";
let palette = themePalettes[activeThemeMode];
const currentThemeMode = () => activeThemeMode;

const database = SQLite.openDatabaseSync("diahealth.db");
const queryClient = new QueryClient();
const Stack = createNativeStackNavigator<RootStackParamList>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const createLocalUuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    const nextValue = value === "x" ? random : (random & 0x3) | 0x8;

    return nextValue.toString(16);
  });
const brandImageSources = [diaHealthLogo, tabGlucoseIcon, tabHealthIcon, tabFoodIcon, tabProfileIcon, tabGlucoseDarkIcon, tabHealthDarkIcon, tabFoodDarkIcon, tabProfileDarkIcon];
const brandImages = createAssetCache((source) => Image.loadAsync(source));
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? ""
};
const resolveExpoHostApiUrl = () => {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.linkingUri,
    Constants.expoConfig?.extra?.expoGo?.debuggerHost
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const match = candidate.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3})/);

    if (match?.[1]) {
      return `http://${match[1]}:3001`;
    }
  }

  return null;
};

const apiUrl = resolveExpoHostApiUrl() ?? process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3001";
const devAuthBypass = process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS === "true";
const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
const firebaseApp = hasFirebaseConfig ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});
const STORAGE_KEYS = {
  devSession: "dev.session",
  devAccounts: "dev.accounts",
  language: "language",
  profile: "profile",
  preferences: "preferences",
  syncCursor: "sync.cursor",
  activeUser: "active.user",
  activeAuthIdentity: "active.auth.identity",
  emergencyCard: "emergency.card",
  dailyReminderNotifications: "daily.reminder.notifications",
  theme: "theme",
  storageResetVersion: "storage.reset.version"
} as const;
const CLIENT_RESET_VERSION = "2026-10-17-all-accounts-reset-v2";
const defaultPreferences = {
  measurementReminders: false,
  medicationReminders: false,
  hydrationReminders: false,
  activityReminders: false,
  measurementReminderTime: "08:00",
  hydrationReminderTime: "11:00",
  activityReminderTime: "18:00",
  healthPermissionApproved: false
} as const;

const translations = {
  en: {
    title: "DiaHealth",
    subtitle: "Daily Diabetes Tracking",
    email: "Email",
    password: "Password",
    emailSignIn: "Sign in",
    emailSignUp: "Sign up",
    createAccount: "Create account",
    confirmPassword: "Confirm password",
    backToSignIn: "Back to sign in",
    firstName: "First name",
    lastName: "Last name",
    fullName: "Full name",
    permissions: "Permissions",
    remindersManualActivation: "Reminders Start Off. Enable Them Manually In Your Profile.",
    measurementReminders: "Measurement reminders",
    medicationReminders: "Medication reminders",
    hydrationReminders: "Water reminders",
    activityReminders: "Activity reminders",
    reminderTime: "Reminder Time",
    measurementReminderTitle: "Measurement Reminder",
    measurementReminderBody: "Time to check your blood sugar.",
    hydrationReminderTitle: "Water Reminder",
    hydrationReminderBody: "Remember to drink water.",
    activityReminderTitle: "Activity Reminder",
    activityReminderBody: "Time for a short walk.",
    healthPermissionApproved: "Health data permission",
    gender: "Gender",
    male: "Male",
    female: "Female",
    heightCm: "Height (cm)",
    weightKg: "Weight (kg)",
    bmi: "BMI",
    profile: "Profile",
    home: "Home",
    glucoseTab: "Blood Sugar",
    glucoseList: "Blood Sugar List",
    sugarTracking: "Sugar Tracking",
    healthValues: "Health Values",
    hydration: "Water Tracking",
    water: "Water",
    addHydration: "Add Water",
    amountMl: "Amount (mL)",
    meals: "Meal Tracking",
    meal: "Meal",
    nutrition: "Nutrition",
    foodCatalog: "Food Catalog",
    foodSearch: "Food Search",
    foodSearchPlaceholder: "Search food name",
    selectedFood: "Selected Food",
    chooseFood: "Choose",
    noFoodResults: "No food found.",
    foodPortion: "Portion",
    consumedAmount: "Consumed Amount",
    calculatedNutrition: "Calculated Nutrition",
    nutritionSummary: "Nutrition Summary",
    macroProtein: "Protein",
    macroFat: "Fat",
    macroFiber: "Fiber",
    addMeal: "Add Meal",
    recipes: "Recipes",
    guides: "Guides",
    reports: "Reports",
    recipeFilters: "Recipe Filters",
    allMeals: "All Meals",
    ingredients: "Ingredients",
    preparation: "Preparation",
    reportSummary: "Report Summary",
    generatePdfReport: "Generate PDF Report",
    reportGeneratedTitle: "Report Generated",
    reportGeneratedMessage: "PDF report is ready.",
    reportFailedTitle: "Report Failed",
    reportFailedMessage: "PDF report could not be generated.",
    latestRecords: "Latest Records",
    glucoseAverage: "Glucose Average",
    totalMeals: "Total Meals",
    totalHydration: "Total Hydration",
    totalActivity: "Total Activity",
    clinicalDisclaimer: "This report is informational and does not replace medical advice.",
    mealName: "Meal name",
    mealType: "Meal type",
    carbohydrateGrams: "Carbohydrate (g)",
    calories: "Calories",
    activity: "Activity",
    activities: "Activity Tracking",
    addActivity: "Add Activity",
    activityType: "Activity type",
    steps: "Steps",
    exercise: "Exercise",
    durationMinutes: "Duration (min)",
    emergencyCard: "Emergency Card",
    emergencyContactName: "Emergency contact name",
    emergencyContactPhone: "Emergency contact phone",
    relationship: "Relationship",
    medicalNotes: "Medical notes",
    callEmergencyContact: "Call emergency contact",
    emergencyCardSavedTitle: "Emergency card saved",
    emergencyCardSavedMessage: "Emergency card updated.",
    emergencyContactMissingTitle: "Missing phone",
    emergencyContactMissingMessage: "Add emergency contact phone.",
    medications: "Medication Tracking",
    medication: "Medication",
    addMedication: "Add Medication",
    medicationPlans: "Medication Plans",
    addMedicationPlan: "Add Medication Plan",
    medicationName: "Medication name",
    dosage: "Dosage",
    scheduleTime: "Schedule time",
    planStatus: "Plan status",
    active: "Active",
    inactive: "Inactive",
    scheduledFor: "Scheduled time",
    takenAt: "Taken time",
    skippedAt: "Skipped time",
    medicationStatus: "Status",
    scheduled: "Scheduled",
    taken: "Taken",
    skipped: "Skipped",
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
    changeTime: "Change time",
    hideTime: "Hide time",
    notificationPermissionTitle: "Notification permission",
    notificationPermissionMessage: "Allow notifications for medication reminders.",
    glucoseChart: "Daily Blood Sugar Chart",
    hba1cChart: "HbA1c Chart",
    glucoseChartDayTitle: "Daily Blood Sugar Chart",
    glucoseChartWeekTitle: "1 Week Blood Sugar Chart",
    glucoseChartMonthTitle: "1 Month Blood Sugar Chart",
    glucoseChartQuarterTitle: "3 Months Blood Sugar Chart",
    weightChartTitle: "All Time Weight Chart",
    hydrationChartDayTitle: "Daily Water Chart",
    hydrationChartWeekTitle: "1 Week Water Chart",
    hydrationChartMonthTitle: "1 Month Water Chart",
    mealChartDayTitle: "Daily Meal Chart",
    mealChartWeekTitle: "1 Week Meal Chart",
    mealChartMonthTitle: "1 Month Meal Chart",
    activityStepsChartDayTitle: "Daily Steps Chart",
    activityStepsChartWeekTitle: "1 Week Steps Chart",
    activityStepsChartMonthTitle: "1 Month Steps Chart",
    activityStepsChartQuarterTitle: "3 Months Steps Chart",
    activityExerciseChartDayTitle: "Daily Exercise Chart",
    activityExerciseChartWeekTitle: "1 Week Exercise Chart",
    activityExerciseChartMonthTitle: "1 Month Exercise Chart",
    activityExerciseChartQuarterTitle: "3 Months Exercise Chart",
    medicationChartDayTitle: "Daily Medication Chart",
    medicationChartWeekTitle: "1 Week Medication Chart",
    medicationChartMonthTitle: "1 Month Medication Chart",
    chartDay: "Day",
    chartWeek: "1 Week",
    chartMonth: "1 Month",
    chartQuarter: "3 Months",
    selectedDate: "Selected date",
    chartEmpty: "No chart data yet.",
    completionRate: "Completion rate",
    totalWater: "Total water",
    totalCarbs: "Total carbohydrate",
    totalSteps: "Total steps",
    totalExercise: "Total exercise",
    save: "Save",
    edit: "Edit",
    cancel: "Cancel",
    delete: "Delete",
    deleteAccount: "Delete Account",
    deleteAccountConfirmTitle: "Delete account",
    deleteAccountConfirmMessage: "Your account and all data will be permanently deleted.",
    deleteAccountFailedTitle: "Delete failed",
    deleteAccountFailedMessage: "Account could not be deleted.",
    welcome: "Welcome",
    profileSavedTitle: "Profile saved",
    profileSavedMessage: "Profile updated.",
    missingFieldsTitle: "Missing fields",
    missingFieldsMessage: "Enter email and password.",
    passwordMismatchTitle: "Password mismatch",
    passwordMismatchMessage: "Passwords do not match.",
    passwordPolicyTitle: "Invalid password",
    passwordPolicyMessage: "Password must be at least 8 characters and include uppercase, lowercase, and a number.",
    invalidEmailTitle: "Invalid email",
    invalidEmailMessage: "Enter a valid email.",
    signInFailedTitle: "Sign in failed",
    signInFailedMessage: "Sign in could not be completed.",
    signUpFailedTitle: "Sign up failed",
    signUpFailedMessage: "Account could not be created.",
    accountExistsTitle: "Account exists",
    accountExistsMessage: "An account already exists for this email.",
    onboardingFailedTitle: "Setup failed",
    onboardingFailedMessage: "Profile could not be saved.",
    formInvalidTitle: "Form incomplete",
    formInvalidMessage: "Fill required fields.",
    disclaimerRequiredMessage: "Accept disclaimer to continue.",
    googleSignIn: "Sign in with Google",
    appleSignIn: "Sign in with Apple",
    language: "Language",
    diabetesType: "Diabetes Profile",
    disclaimer: "I accept that DiaHealth does not replace a doctor.",
    continue: "Continue",
    glucose: "Blood Sugar Records",
    metrics: "Health Measurements",
    addGlucose: "Add Blood Sugar",
    addMetric: "Add Measurement",
    addValue: "Add Value",
    addWeight: "Add Weight",
    hba1cRecords: "HbA1c Records",
    syncNow: "Sync Now",
    loading: "Loading",
    signOut: "Sign Out",
    accepted: "Accepted",
    note: "Note",
    value: "Value",
    measurementDate: "Measurement date",
    changeDate: "Change date",
    hideCalendar: "Hide calendar",
    morning: "Morning",
    noon: "Noon",
    evening: "Evening",
    back: "Back",
    systolic: "Systolic",
    diastolic: "Diastolic",
    pulse: "Pulse",
    syncErrorTitle: "Sync Error",
    syncErrorMessage: "Check API and connection settings.",
    fasting: "Fasting",
    postprandial: "Postprandial",
    night: "Night",
    morning_fasting: "Morning fasting",
    morning_postprandial: "Morning post-meal",
    noon_fasting: "Noon fasting",
    noon_postprandial: "Noon post-meal",
    evening_fasting: "Evening fasting",
    evening_postprandial: "Evening post-meal",
    hba1c: "HbA1c",
    blood_pressure: "Blood Pressure",
    weight: "Weight",
    type1: "Type 1",
    type2: "Type 2",
    gestational: "Gestational Diabetes",
    turkish: "Turkish",
    english: "English",
    theme: "Theme",
    darkTheme: "Dark Theme",
    lightTheme: "Light Theme",
    enabled: "Enabled",
    disabled: "Disabled"
  },
  tr: {
    title: "DiaHealth",
    subtitle: "Günlük Diyabet Takibi",
    email: "E-Posta",
    password: "Şifre",
    emailSignIn: "Giriş Yap",
    emailSignUp: "Kayıt Ol",
    createAccount: "Hesap oluştur",
    confirmPassword: "Şifre tekrar",
    backToSignIn: "Girişe dön",
    firstName: "Ad",
    lastName: "Soyad",
    fullName: "Ad Soyad",
    permissions: "İzinler",
    remindersManualActivation: "Hatırlatmalar Kapalı Başlar. Profilinden Manuel Etkinleştirebilirsin.",
    measurementReminders: "Ölçüm Hatırlatmaları",
    medicationReminders: "İlaç Hatırlatmaları",
    hydrationReminders: "Su Hatırlatmaları",
    activityReminders: "Aktivite Hatırlatmaları",
    reminderTime: "Hatırlatma Saati",
    measurementReminderTitle: "Ölçüm Hatırlatması",
    measurementReminderBody: "Kan şekeri ölçüm zamanı.",
    hydrationReminderTitle: "Su Hatırlatması",
    hydrationReminderBody: "Su içmeyi unutma.",
    activityReminderTitle: "Aktivite Hatırlatması",
    activityReminderBody: "Kısa yürüyüş zamanı.",
    healthPermissionApproved: "Sağlık Verisi İzni",
    gender: "Cinsiyet",
    male: "Erkek",
    female: "Kadın",
    heightCm: "Boy (cm)",
    weightKg: "Kilo (kg)",
    bmi: "Vücut Kitle İndeksi",
    profile: "Profil",
    home: "Ana Sayfa",
    glucoseTab: "Kan Şekeri",
    glucoseList: "Kan Şekeri Listesi",
    sugarTracking: "Şeker Takibi",
    healthValues: "Sağlık Değerleri",
    hydration: "Su Takibi",
    water: "Su",
    addHydration: "Su Ekle",
    amountMl: "Miktar (mL)",
    meals: "Öğün Takibi",
    meal: "Öğün",
    nutrition: "Besin",
    foodCatalog: "Besin Kataloğu",
    foodSearch: "Besin Ara",
    foodSearchPlaceholder: "Besin adı ara",
    selectedFood: "Seçilen Besin",
    chooseFood: "Seç",
    noFoodResults: "Besin bulunamadı.",
    foodPortion: "Porsiyon",
    consumedAmount: "Tüketilen Miktar",
    calculatedNutrition: "Hesaplanan Değerler",
    nutritionSummary: "Besin Özeti",
    macroProtein: "Protein",
    macroFat: "Yağ",
    macroFiber: "Lif",
    addMeal: "Öğün Ekle",
    recipes: "Tarifler",
    guides: "Rehberler",
    reports: "Raporlar",
    recipeFilters: "Tarif Filtreleri",
    allMeals: "Tüm Öğünler",
    ingredients: "Malzemeler",
    preparation: "Hazırlanış",
    reportSummary: "Rapor Özeti",
    generatePdfReport: "PDF Rapor Oluştur",
    reportGeneratedTitle: "Rapor Oluşturuldu",
    reportGeneratedMessage: "PDF rapor hazır.",
    reportFailedTitle: "Rapor Hatası",
    reportFailedMessage: "PDF rapor oluşturulamadı.",
    latestRecords: "Son Kayıtlar",
    glucoseAverage: "Şeker Ortalaması",
    totalMeals: "Toplam Öğün",
    totalHydration: "Toplam Su",
    totalActivity: "Toplam Aktivite",
    clinicalDisclaimer: "Bu rapor bilgilendirme amaçlıdır ve doktor önerisi yerine geçmez.",
    mealName: "Öğün Adı",
    mealType: "Öğün Tipi",
    carbohydrateGrams: "Karbonhidrat (g)",
    calories: "Kalori",
    activity: "Aktivite",
    activities: "Aktivite Takibi",
    addActivity: "Aktivite Ekle",
    activityType: "Aktivite Tipi",
    steps: "Adım",
    exercise: "Egzersiz",
    durationMinutes: "Süre (dk)",
    emergencyCard: "Acil Durum Kartı",
    emergencyContactName: "Acil Kişi Adı",
    emergencyContactPhone: "Acil Kişi Telefonu",
    relationship: "Yakınlık",
    medicalNotes: "Tıbbi notlar",
    callEmergencyContact: "Acil kişiyi ara",
    emergencyCardSavedTitle: "Acil kart kaydedildi",
    emergencyCardSavedMessage: "Acil durum kartı güncellendi.",
    emergencyContactMissingTitle: "Telefon eksik",
    emergencyContactMissingMessage: "Acil kişi telefonu ekleyin.",
    medications: "İlaç Takibi",
    medication: "İlaç",
    addMedication: "İlaç Ekle",
    medicationPlans: "İlaç Planları",
    addMedicationPlan: "İlaç Planı Ekle",
    medicationName: "İlaç adı",
    dosage: "Doz",
    scheduleTime: "Plan saati",
    planStatus: "Plan durumu",
    active: "Aktif",
    inactive: "Pasif",
    scheduledFor: "Planlanan saat",
    takenAt: "Alınan saat",
    skippedAt: "Atlanan saat",
    medicationStatus: "Durum",
    scheduled: "Planlandı",
    taken: "Alındı",
    skipped: "Atlandı",
    breakfast: "Kahvaltı",
    lunch: "Öğle",
    dinner: "Akşam",
    snack: "Ara Öğün",
    changeTime: "Saati değiştir",
    hideTime: "Saati gizle",
    notificationPermissionTitle: "Bildirim izni",
    notificationPermissionMessage: "İlaç hatırlatmaları için bildirim izni ver.",
    glucoseChart: "Günlük Kan Şekeri Grafiği",
    hba1cChart: "HbA1c Grafiği",
    glucoseChartDayTitle: "Günlük Kan Şekeri Grafiği",
    glucoseChartWeekTitle: "1 Haftalık Kan Şekeri Grafiği",
    glucoseChartMonthTitle: "1 Aylık Kan Şekeri Grafiği",
    glucoseChartQuarterTitle: "3 Aylık Kan Şekeri Grafiği",
    weightChartTitle: "Tüm Zamanlar Kilo Grafiği",
    hydrationChartDayTitle: "Günlük Su Grafiği",
    hydrationChartWeekTitle: "1 Haftalık Su Grafiği",
    hydrationChartMonthTitle: "1 Aylık Su Grafiği",
    mealChartDayTitle: "Günlük Öğün Grafiği",
    mealChartWeekTitle: "1 Haftalık Öğün Grafiği",
    mealChartMonthTitle: "1 Aylık Öğün Grafiği",
    activityStepsChartDayTitle: "Günlük Adım Grafiği",
    activityStepsChartWeekTitle: "1 Haftalık Adım Grafiği",
    activityStepsChartMonthTitle: "1 Aylık Adım Grafiği",
    activityStepsChartQuarterTitle: "3 Aylık Adım Grafiği",
    activityExerciseChartDayTitle: "Günlük Egzersiz Grafiği",
    activityExerciseChartWeekTitle: "1 Haftalık Egzersiz Grafiği",
    activityExerciseChartMonthTitle: "1 Aylık Egzersiz Grafiği",
    activityExerciseChartQuarterTitle: "3 Aylık Egzersiz Grafiği",
    medicationChartDayTitle: "Günlük İlaç Grafiği",
    medicationChartWeekTitle: "1 Haftalık İlaç Grafiği",
    medicationChartMonthTitle: "1 Aylık İlaç Grafiği",
    chartDay: "Gün",
    chartWeek: "1 Hafta",
    chartMonth: "1 Ay",
    chartQuarter: "3 Ay",
    selectedDate: "Seçilen tarih",
    chartEmpty: "Henüz grafik verisi yok.",
    completionRate: "Tamamlanma oranı",
    totalWater: "Toplam su",
    totalCarbs: "Toplam karbonhidrat",
    totalSteps: "Toplam adım",
    totalExercise: "Toplam egzersiz",
    save: "Kaydet",
    edit: "Düzenle",
    cancel: "Vazgeç",
    delete: "Sil",
    deleteAccount: "Hesabı Sil",
    deleteAccountConfirmTitle: "Hesabı sil",
    deleteAccountConfirmMessage: "Hesabın ve tüm verilerin kalıcı olarak silinecek.",
    deleteAccountFailedTitle: "Silme hatası",
    deleteAccountFailedMessage: "Hesap silinemedi.",
    welcome: "Hoş geldin",
    profileSavedTitle: "Profil kaydedildi",
    profileSavedMessage: "Profil güncellendi.",
    missingFieldsTitle: "Eksik alan",
    missingFieldsMessage: "E-posta ve şifre gir.",
    passwordMismatchTitle: "Şifre uyumsuz",
    passwordMismatchMessage: "Şifreler aynı değil.",
    passwordPolicyTitle: "Geçersiz şifre",
    passwordPolicyMessage: "Şifre en az 8 karakter olmalı ve büyük harf, küçük harf, rakam içermeli.",
    invalidEmailTitle: "Geçersiz e-posta",
    invalidEmailMessage: "Geçerli e-posta gir.",
    signInFailedTitle: "Giriş hatası",
    signInFailedMessage: "Giriş yapılamadı.",
    signUpFailedTitle: "Kayıt hatası",
    signUpFailedMessage: "Hesap oluşturulamadı.",
    accountExistsTitle: "Hesap var",
    accountExistsMessage: "Bu e-posta için zaten hesap var.",
    onboardingFailedTitle: "Kurulum hatası",
    onboardingFailedMessage: "Profil kaydedilemedi.",
    formInvalidTitle: "Form eksik",
    formInvalidMessage: "Zorunlu alanları doldur.",
    disclaimerRequiredMessage: "Devam için uyarıyı kabul et.",
    googleSignIn: "Google ile giriş",
    appleSignIn: "Apple ile giriş",
    language: "Dil",
    diabetesType: "Diyabet Profili",
    disclaimer: "DiaHealth uygulamasının doktor yerine geçmediğini kabul ediyorum.",
    continue: "Devam Et",
    glucose: "Kan Şekeri Kayıtları",
    metrics: "Sağlık Ölçümleri",
    addGlucose: "Kan Şekeri Ekle",
    addMetric: "Ölçüm Ekle",
    addValue: "Değer Ekle",
    addWeight: "Kilo Ekle",
    hba1cRecords: "HbA1c Kayıtları",
    syncNow: "Şimdi Senkronla",
    loading: "Yükleniyor",
    signOut: "Çıkış Yap",
    accepted: "Kabul Edildi",
    note: "Not",
    value: "Değer",
    measurementDate: "Ölçüm tarihi",
    changeDate: "Tarih seç",
    hideCalendar: "Takvimi kapat",
    morning: "Sabah",
    noon: "Öğlen",
    evening: "Akşam",
    back: "Geri",
    systolic: "Büyük tansiyon",
    diastolic: "Küçük tansiyon",
    pulse: "Nabız",
    syncErrorTitle: "Senkron Hatası",
    syncErrorMessage: "API ve bağlantı ayarlarını kontrol et.",
    fasting: "Açlık",
    postprandial: "Tokluk",
    night: "Gece",
    morning_fasting: "Sabah Aç",
    morning_postprandial: "Sabah Tok",
    noon_fasting: "Öğlen Aç",
    noon_postprandial: "Öğlen Tok",
    evening_fasting: "Akşam Aç",
    evening_postprandial: "Akşam Tok",
    hba1c: "HbA1c",
    blood_pressure: "Tansiyon",
    weight: "Kilo",
    type1: "Tip 1",
    type2: "Tip 2",
    gestational: "Gebelik Diyabeti",
    turkish: "Türkçe",
    english: "İngilizce",
    theme: "Tema",
    darkTheme: "Karanlık Tema",
    lightTheme: "Aydınlık Tema",
    enabled: "Açık",
    disabled: "Kapalı"
  }
} as const;

type TranslationMap = Record<string, string>;
const titleCaseText = (value: string, language: "tr" | "en") =>
  value.replace(/(^|[\s(/•-])([\p{L}])/gu, (_match, prefix: string, character: string) => `${prefix}${character.toLocaleUpperCase(language === "tr" ? "tr-TR" : "en-US")}`);
const titleCaseTranslationMap = <T extends TranslationMap>(items: T, language: "tr" | "en") =>
  Object.fromEntries(Object.entries(items).map(([key, value]) => [key, titleCaseText(value, language)])) as T;
const displayTranslations = {
  en: titleCaseTranslationMap(translations.en, "en"),
  tr: titleCaseTranslationMap(translations.tr, "tr")
} as const;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    compatibilityJSON: "v4",
    lng: "tr",
    fallbackLng: "tr",
    resources: {
      en: { translation: displayTranslations.en },
      tr: { translation: displayTranslations.tr }
    }
  });
}

const currentLanguage = () => (i18n.language === "en" ? "en" : "tr");
type FoodCatalogItem = {
  id: string;
  name: string;
  portionAmount: number;
  portionUnit: string;
  calories: number;
  carbohydrateGrams: number;
  proteinGrams: number;
  fatGrams: number;
  fiberGrams: number;
  source: string;
};
const foodCatalog = rawFoodCatalog as FoodCatalogItem[];
const normalizeSearchText = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const formatFoodPortion = (food: FoodCatalogItem) => `${food.portionAmount} ${food.portionUnit}`;
const parsePortionAmount = (value: string) => Number(value.replace(",", "."));
const formatPortionInput = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ","));
const calculateFoodNutrition = (food: FoodCatalogItem, amountText: string) => {
  const parsedAmount = parsePortionAmount(amountText);
  const consumedAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : food.portionAmount;
  const ratio = consumedAmount / food.portionAmount;

  return {
    consumedAmount,
    calories: Math.round(food.calories * ratio),
    carbohydrateGrams: Number((food.carbohydrateGrams * ratio).toFixed(1)),
    proteinGrams: Number((food.proteinGrams * ratio).toFixed(1)),
    fatGrams: Number((food.fatGrams * ratio).toFixed(1)),
    fiberGrams: Number((food.fiberGrams * ratio).toFixed(1))
  };
};
const deriveInitialPortionAmount = (food: FoodCatalogItem | null, entry?: MealEntry) => {
  if (!food) {
    return "";
  }

  if (!entry) {
    return formatPortionInput(food.portionAmount);
  }

  const ratio =
    food.carbohydrateGrams > 0
      ? entry.carbohydrateGrams / food.carbohydrateGrams
      : food.calories > 0
        ? entry.calories / food.calories
        : 1;

  return formatPortionInput(food.portionAmount * ratio);
};
type LocalizedText = {
  tr: string;
  en: string;
};
type RecipeCategory = "breakfast" | "lunch" | "dinner" | "snack";
type RecipeContent = {
  id: string;
  title: LocalizedText;
  category: RecipeCategory;
  carbohydrates: number;
  calories: number;
  prepMinutes: number;
  ingredients: LocalizedText[];
  steps: LocalizedText[];
};
type GuideContent = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  steps: LocalizedText[];
};
const localized = (value: LocalizedText) => value[currentLanguage()];
const recipeContent: RecipeContent[] = [
  {
    id: "oat-yogurt-bowl",
    title: { tr: "Yulaflı Yoğurt Kasesi", en: "Oat Yogurt Bowl" },
    category: "breakfast",
    carbohydrates: 32,
    calories: 285,
    prepMinutes: 8,
    ingredients: [
      { tr: "40 g yulaf", en: "40 g oats" },
      { tr: "150 g yoğurt", en: "150 g yogurt" },
      { tr: "Yarım elma", en: "Half apple" },
      { tr: "Tarçın", en: "Cinnamon" }
    ],
    steps: [
      { tr: "Yoğurt ve yulafı karıştır.", en: "Mix yogurt and oats." },
      { tr: "Elmayı küçük doğra.", en: "Dice the apple." },
      { tr: "Tarçın ekleyip servis et.", en: "Add cinnamon and serve." }
    ]
  },
  {
    id: "lentil-salad",
    title: { tr: "Mercimekli Salata", en: "Lentil Salad" },
    category: "lunch",
    carbohydrates: 38,
    calories: 340,
    prepMinutes: 15,
    ingredients: [
      { tr: "120 g haşlanmış yeşil mercimek", en: "120 g boiled green lentils" },
      { tr: "Bol yeşillik", en: "Leafy greens" },
      { tr: "1 tatlı kaşığı zeytinyağı", en: "1 teaspoon olive oil" },
      { tr: "Limon suyu", en: "Lemon juice" }
    ],
    steps: [
      { tr: "Mercimeği yeşillikle karıştır.", en: "Mix lentils with greens." },
      { tr: "Zeytinyağı ve limon ekle.", en: "Add olive oil and lemon." },
      { tr: "Protein için yoğurtla tamamla.", en: "Pair with yogurt for protein." }
    ]
  },
  {
    id: "grilled-chicken-plate",
    title: { tr: "Izgara Tavuk Tabağı", en: "Grilled Chicken Plate" },
    category: "dinner",
    carbohydrates: 28,
    calories: 390,
    prepMinutes: 22,
    ingredients: [
      { tr: "120 g tavuk göğsü", en: "120 g chicken breast" },
      { tr: "4 yemek kaşığı bulgur", en: "4 tablespoons bulgur" },
      { tr: "Buharda sebze", en: "Steamed vegetables" },
      { tr: "Yoğurt", en: "Yogurt" }
    ],
    steps: [
      { tr: "Tavuğu ızgarada pişir.", en: "Grill the chicken." },
      { tr: "Bulguru ölçülü porsiyonla ekle.", en: "Add measured bulgur portion." },
      { tr: "Sebze ve yoğurtla dengele.", en: "Balance with vegetables and yogurt." }
    ]
  },
  {
    id: "almond-kefir-snack",
    title: { tr: "Bademli Kefir Ara Öğünü", en: "Almond Kefir Snack" },
    category: "snack",
    carbohydrates: 14,
    calories: 180,
    prepMinutes: 3,
    ingredients: [
      { tr: "200 mL sade kefir", en: "200 mL plain kefir" },
      { tr: "8 adet badem", en: "8 almonds" },
      { tr: "Tarçın", en: "Cinnamon" }
    ],
    steps: [
      { tr: "Kefiri bardağa al.", en: "Pour kefir into a glass." },
      { tr: "Badem ve tarçınla tüket.", en: "Serve with almonds and cinnamon." }
    ]
  }
];
const guideContent: GuideContent[] = [
  {
    id: "hypoglycemia",
    title: { tr: "Hipoglisemi Anında Ne Yapılmalı", en: "What To Do During Hypoglycemia" },
    summary: { tr: "70 mg/dL altı kan şekeri için hızlı aksiyon rehberi.", en: "Quick action guide for glucose below 70 mg/dL." },
    steps: [
      { tr: "15 g hızlı karbonhidrat al.", en: "Take 15 g fast carbohydrate." },
      { tr: "15 dakika sonra tekrar ölç.", en: "Recheck after 15 minutes." },
      { tr: "Düzelmezse işlemi tekrarla.", en: "Repeat if it does not improve." },
      { tr: "Bilinç kaybında acil yardım çağır.", en: "Call emergency help if consciousness changes." }
    ]
  },
  {
    id: "eating-out",
    title: { tr: "Dışarıda Yemek Seçimi", en: "Eating Out Choices" },
    summary: { tr: "Daha dengeli tabak seçimi için pratik ipuçları.", en: "Practical tips for balanced plate choices." },
    steps: [
      { tr: "Kızartma yerine ızgara seç.", en: "Choose grilled instead of fried." },
      { tr: "Şekerli içecekleri atla.", en: "Skip sugary drinks." },
      { tr: "Karbonhidrat porsiyonunu ölçülü tut.", en: "Keep carbohydrate portions measured." },
      { tr: "Salata ve proteinle denge kur.", en: "Balance with salad and protein." }
    ]
  },
  {
    id: "stress-illness",
    title: { tr: "Stres ve Hastalık Günleri", en: "Stress And Sick Days" },
    summary: { tr: "Stres ve enfeksiyon kan şekerini yükseltebilir.", en: "Stress and infection can raise blood glucose." },
    steps: [
      { tr: "Ölçüm sıklığını artır.", en: "Measure more often." },
      { tr: "Bol su iç.", en: "Drink enough water." },
      { tr: "İlaç planını doktor önerisi olmadan değiştirme.", en: "Do not change medication without clinical advice." },
      { tr: "Sürekli yüksek değerlerde doktora ulaş.", en: "Contact clinician for persistent high values." }
    ]
  },
  {
    id: "sleep-exercise",
    title: { tr: "Uyku ve Egzersiz Etkisi", en: "Sleep And Exercise Impact" },
    summary: { tr: "Düzensiz uyku ve egzersiz zamanlaması şekeri etkileyebilir.", en: "Irregular sleep and exercise timing can affect glucose." },
    steps: [
      { tr: "Egzersiz öncesi ve sonrası ölçüm yap.", en: "Measure before and after exercise." },
      { tr: "Geç saatte ağır öğünden kaçın.", en: "Avoid heavy late meals." },
      { tr: "Uyku düzenini notlarla takip et.", en: "Track sleep routine with notes." }
    ]
  }
];
const shortGlucoseLabel = (
  value:
    | "morning_fasting"
    | "morning_postprandial"
    | "noon_fasting"
    | "noon_postprandial"
    | "evening_fasting"
    | "evening_postprandial"
) => (value.includes("fasting") ? displayTranslations[currentLanguage()].fasting : displayTranslations[currentLanguage()].postprandial);
const labelForMetricType = (value: "hba1c" | "blood_pressure" | "weight") => displayTranslations[currentLanguage()][value];
const labelForMedicationStatus = (value: "scheduled" | "taken" | "skipped") => displayTranslations[currentLanguage()][value];
const labelForPlanStatus = (value: boolean) => displayTranslations[currentLanguage()][value ? "active" : "inactive"];
const labelForMealType = (value: "breakfast" | "lunch" | "dinner" | "snack") => displayTranslations[currentLanguage()][value];
const labelForActivityType = (value: "steps" | "exercise") => displayTranslations[currentLanguage()][value];
const labelForGender = (value: "male" | "female") => displayTranslations[currentLanguage()][value];
const labelForProfileType = (value: "type1" | "type2" | "gestational") => displayTranslations[currentLanguage()][value];
const profileOptionsForGender = (gender: "male" | "female" | null | undefined) =>
  gender === "male" ? (["type1", "type2"] as const) : (["type1", "type2", "gestational"] as const);
type ChartTone = "safe" | "warning" | "danger";
type GlucoseChartRange = "day" | "week" | "month" | "quarter";
type ActivityChartRange = "week" | "month" | "quarter";
const glucoseToneForValue = (value: number): ChartTone => {
  if (value < 70) {
    return "danger";
  }

  if (value <= 130) {
    return "safe";
  }

  if (value <= 180) {
    return "warning";
  }

  return "danger";
};
const hba1cToneForValue = (value: string): ChartTone | null => {
  const numericValue = Number.parseFloat(value.replace(",", "."));

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  if (numericValue <= 5.5) {
    return "warning";
  }

  if (numericValue < 7) {
    return "safe";
  }

  if (numericValue < 8) {
    return "warning";
  }

  return "danger";
};
const formatHba1cValue = (value: string) => {
  const numericValue = Number.parseFloat(value.replace(",", "."));

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return numericValue.toFixed(1).replace(".", ",");
};
const parseWeightValue = (value: string) => {
  const numericValue = Number.parseFloat(value.replace(",", "."));

  return Number.isFinite(numericValue) ? numericValue : null;
};
const formatWeightValue = (value: string) => {
  const numericValue = parseWeightValue(value);

  if (numericValue === null) {
    return value.toLocaleLowerCase("tr-TR").includes("kg") ? value : `${value} kg`;
  }

  const formattedValue = Number.isInteger(numericValue) ? numericValue.toFixed(0) : numericValue.toFixed(1).replace(".", ",");

  return `${formattedValue} kg`;
};

type RootStackParamList = {
  SignIn: undefined;
  Home: undefined;
  SugarTracking: undefined;
  Hba1cList: undefined;
  RecipeList: undefined;
  GuideList: undefined;
  ReportScreen: undefined;
  HealthValues: undefined;
  HydrationList: undefined;
  MealList: undefined;
  ActivityList: undefined;
  EmergencyCard: undefined;
  MedicationList: undefined;
  MedicationPlanList: undefined;
  WeightList: undefined;
  BloodPressureList: undefined;
  AddHydration: { entry?: HydrationEntry } | undefined;
  AddMeal: { entry?: MealEntry } | undefined;
  AddActivity: { entry?: ActivityEntry } | undefined;
  AddMedication: { entry?: MedicationEntry } | undefined;
  AddMedicationPlan: { entry?: MedicationPlanEntry } | undefined;
  AddGlucose: { entry?: GlucoseEntry } | undefined;
  GlucoseEntryForm: { entry?: GlucoseEntry; measuredAt?: string } | undefined;
  AddMetric:
    | {
        entry?: HealthMetricEntry;
        metricType?: "hba1c" | "blood_pressure" | "weight";
        lockMetricType?: boolean;
      }
    | undefined;
  Profile: undefined;
};

type PhaseTwoChartRange = "day" | "week" | "month";
type AppNavigate = {
  (route: "Home"): void;
  (route: "SugarTracking"): void;
  (route: "Hba1cList"): void;
  (route: "RecipeList"): void;
  (route: "GuideList"): void;
  (route: "ReportScreen"): void;
  (route: "HealthValues"): void;
  (route: "HydrationList"): void;
  (route: "MealList"): void;
  (route: "ActivityList"): void;
  (route: "EmergencyCard"): void;
  (route: "MedicationList"): void;
  (route: "MedicationPlanList"): void;
  (route: "WeightList"): void;
  (route: "BloodPressureList"): void;
  (route: "Profile"): void;
  (route: "AddHydration", params?: { entry?: HydrationEntry }): void;
  (route: "AddMeal", params?: { entry?: MealEntry }): void;
  (route: "AddActivity", params?: { entry?: ActivityEntry }): void;
  (route: "AddMedication", params?: { entry?: MedicationEntry }): void;
  (route: "AddMedicationPlan", params?: { entry?: MedicationPlanEntry }): void;
  (route: "AddGlucose", params?: { entry?: GlucoseEntry }): void;
  (route: "GlucoseEntryForm", params?: { entry?: GlucoseEntry; measuredAt?: string }): void;
  (
    route: "AddMetric",
    params?:
      | {
          entry?: HealthMetricEntry;
          metricType?: "hba1c" | "blood_pressure" | "weight";
          lockMetricType?: boolean;
        }
      | undefined
  ): void;
};
type AppNavigation = {
  navigate: AppNavigate;
  goBack: () => void;
};

type SessionState = {
  accountEmail: string | null;
  firebaseUser: User | null;
  hasDevSession: boolean;
  preferences: ReminderPreferenceDraft;
  profile: UserProfile | null;
  ready: boolean;
  themeMode: ThemeMode;
};

type ReminderPreferenceDraft = {
  measurementReminders: boolean;
  medicationReminders: boolean;
  hydrationReminders: boolean;
  activityReminders: boolean;
  measurementReminderTime: string;
  hydrationReminderTime: string;
  activityReminderTime: string;
  healthPermissionApproved: boolean;
};

const sessionContext = React.createContext<{
  state: SessionState;
  refresh: () => Promise<void>;
  applyProfile: (profile: UserProfile | null) => Promise<void>;
  applyPreferences: (preferences: ReminderPreferenceDraft) => Promise<void>;
  applyTheme: (themeMode: ThemeMode) => Promise<void>;
  deleteAccount: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogleToken: (token: string) => Promise<void>;
  signInWithAppleToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  state: {
    accountEmail: null,
    firebaseUser: null,
    hasDevSession: false,
    preferences: { ...defaultPreferences },
    profile: null,
    ready: false,
    themeMode: "dark"
  },
  refresh: async () => undefined,
  applyProfile: async () => undefined,
  applyPreferences: async () => undefined,
  applyTheme: async () => undefined,
  deleteAccount: async () => undefined,
  signInWithEmail: async () => undefined,
  signUpWithEmail: async () => undefined,
  signInWithGoogleToken: async () => undefined,
  signInWithAppleToken: async () => undefined,
  logout: async () => undefined
});

const initDatabase = () => {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS glucose_entries (
      id TEXT PRIMARY KEY NOT NULL,
      readingType TEXT NOT NULL,
      valueMgDl REAL NOT NULL,
      measuredAt TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS health_metric_entries (
      id TEXT PRIMARY KEY NOT NULL,
      metricType TEXT NOT NULL,
      value TEXT NOT NULL,
      measuredAt TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS hydration_entries (
      id TEXT PRIMARY KEY NOT NULL,
      amountMl INTEGER NOT NULL,
      measuredAt TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS meal_entries (
      id TEXT PRIMARY KEY NOT NULL,
      mealType TEXT NOT NULL,
      mealName TEXT NOT NULL,
      carbohydrateGrams REAL NOT NULL,
      calories INTEGER NOT NULL,
      measuredAt TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS activity_entries (
      id TEXT PRIMARY KEY NOT NULL,
      activityType TEXT NOT NULL,
      steps INTEGER,
      durationMinutes INTEGER,
      measuredAt TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS medication_entries (
      id TEXT PRIMARY KEY NOT NULL,
      medicationName TEXT NOT NULL,
      dosage TEXT NOT NULL,
      scheduledFor TEXT NOT NULL,
      status TEXT NOT NULL,
      takenAt TEXT,
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS medication_plan_entries (
      id TEXT PRIMARY KEY NOT NULL,
      medicationName TEXT NOT NULL,
      dosage TEXT NOT NULL,
      scheduleTime TEXT NOT NULL,
      isActive INTEGER NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS medication_notification_links (
      entryId TEXT PRIMARY KEY NOT NULL,
      notificationId TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS medication_plan_notification_links (
      planId TEXT PRIMARY KEY NOT NULL,
      notificationId TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      entity TEXT NOT NULL,
      operation TEXT NOT NULL,
      recordId TEXT NOT NULL,
      payload TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
  normalizeLocalEntryIds();
};

const normalizeLocalEntryIds = () => {
  const normalizeTable = (tableName: string, linkTableName?: string, linkColumnName?: string) => {
    const rows = database.getAllSync<{ id: string }>(`SELECT id FROM ${tableName}`);

    rows.forEach((row) => {
      if (uuidPattern.test(row.id)) {
        return;
      }

      const nextId = createLocalUuid();
      database.runSync(`UPDATE ${tableName} SET id = ? WHERE id = ?`, [nextId, row.id]);
      database.runSync("DELETE FROM sync_queue WHERE recordId = ?", [row.id]);

      if (linkTableName && linkColumnName) {
        database.runSync(`UPDATE ${linkTableName} SET ${linkColumnName} = ? WHERE ${linkColumnName} = ?`, [nextId, row.id]);
      }
    });
  };

  normalizeTable("glucose_entries");
  normalizeTable("health_metric_entries");
  normalizeTable("hydration_entries");
  normalizeTable("meal_entries");
  normalizeTable("activity_entries");
  normalizeTable("medication_entries", "medication_notification_links", "entryId");
  normalizeTable("medication_plan_entries", "medication_plan_notification_links", "planId");
};

const mapRows = <T,>(statement: string) => database.getAllSync<T>(statement);

const saveGlucoseLocally = (entry: GlucoseEntry) => {
  database.runSync(
    `INSERT OR REPLACE INTO glucose_entries (id, readingType, valueMgDl, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.readingType, entry.valueMgDl, entry.measuredAt, entry.note ?? null, entry.createdAt, entry.updatedAt, entry.deletedAt ?? null]
  );
  queueSync(createSyncRecord("glucose", "create", entry.id, entry));
};

const saveMetricLocally = (entry: HealthMetricEntry) => {
  database.runSync(
    `INSERT OR REPLACE INTO health_metric_entries (id, metricType, value, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.metricType, entry.value, entry.measuredAt, entry.note ?? null, entry.createdAt, entry.updatedAt, entry.deletedAt ?? null]
  );
  queueSync(createSyncRecord("metric", "create", entry.id, entry));
};

const saveHydrationLocally = (entry: HydrationEntry) => {
  database.runSync(
    `INSERT OR REPLACE INTO hydration_entries (id, amountMl, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.amountMl, entry.measuredAt, entry.note ?? null, entry.createdAt, entry.updatedAt, entry.deletedAt ?? null]
  );
  queueSync(createSyncRecord("hydration", "create", entry.id, entry));
};

const saveMealLocally = (entry: MealEntry) => {
  database.runSync(
    `INSERT OR REPLACE INTO meal_entries (id, mealType, mealName, carbohydrateGrams, calories, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.mealType,
      entry.mealName,
      entry.carbohydrateGrams,
      entry.calories,
      entry.measuredAt,
      entry.note ?? null,
      entry.createdAt,
      entry.updatedAt,
      entry.deletedAt ?? null
    ]
  );
  queueSync(createSyncRecord("meal", "create", entry.id, entry));
};

const saveActivityLocally = (entry: ActivityEntry) => {
  database.runSync(
    `INSERT OR REPLACE INTO activity_entries (id, activityType, steps, durationMinutes, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.activityType,
      entry.steps ?? null,
      entry.durationMinutes ?? null,
      entry.measuredAt,
      entry.note ?? null,
      entry.createdAt,
      entry.updatedAt,
      entry.deletedAt ?? null
    ]
  );
  queueSync(createSyncRecord("activity", "create", entry.id, entry));
};

const saveMedicationLocally = (entry: MedicationEntry) => {
  database.runSync(
    `INSERT OR REPLACE INTO medication_entries (id, medicationName, dosage, scheduledFor, status, takenAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.medicationName,
      entry.dosage,
      entry.scheduledFor,
      entry.status,
      entry.takenAt ?? null,
      entry.note ?? null,
      entry.createdAt,
      entry.updatedAt,
      entry.deletedAt ?? null
    ]
  );
  queueSync(createSyncRecord("medication", "create", entry.id, entry));
};

const saveMedicationPlanLocally = (entry: MedicationPlanEntry) => {
  database.runSync(
    `INSERT OR REPLACE INTO medication_plan_entries (id, medicationName, dosage, scheduleTime, isActive, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.medicationName,
      entry.dosage,
      entry.scheduleTime,
      entry.isActive ? 1 : 0,
      entry.note ?? null,
      entry.createdAt,
      entry.updatedAt,
      entry.deletedAt ?? null
    ]
  );
  queueSync(createSyncRecord("medication_plan", "create", entry.id, entry));
};

const updateGlucoseLocally = (entry: GlucoseEntry) => {
  const nextEntry = {
    ...entry,
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };

  database.runSync(
    `INSERT OR REPLACE INTO glucose_entries (id, readingType, valueMgDl, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [nextEntry.id, nextEntry.readingType, nextEntry.valueMgDl, nextEntry.measuredAt, nextEntry.note ?? null, nextEntry.createdAt, nextEntry.updatedAt, nextEntry.deletedAt]
  );
  queueSync(createSyncRecord("glucose", "update", nextEntry.id, nextEntry));
};

const updateMetricLocally = (entry: HealthMetricEntry) => {
  const nextEntry = {
    ...entry,
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };

  database.runSync(
    `INSERT OR REPLACE INTO health_metric_entries (id, metricType, value, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [nextEntry.id, nextEntry.metricType, nextEntry.value, nextEntry.measuredAt, nextEntry.note ?? null, nextEntry.createdAt, nextEntry.updatedAt, nextEntry.deletedAt]
  );
  queueSync(createSyncRecord("metric", "update", nextEntry.id, nextEntry));
};

const updateHydrationLocally = (entry: HydrationEntry) => {
  const nextEntry = {
    ...entry,
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };

  database.runSync(
    `INSERT OR REPLACE INTO hydration_entries (id, amountMl, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nextEntry.id, nextEntry.amountMl, nextEntry.measuredAt, nextEntry.note ?? null, nextEntry.createdAt, nextEntry.updatedAt, nextEntry.deletedAt]
  );
  queueSync(createSyncRecord("hydration", "update", nextEntry.id, nextEntry));
};

const updateMealLocally = (entry: MealEntry) => {
  const nextEntry = {
    ...entry,
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };

  database.runSync(
    `INSERT OR REPLACE INTO meal_entries (id, mealType, mealName, carbohydrateGrams, calories, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextEntry.id,
      nextEntry.mealType,
      nextEntry.mealName,
      nextEntry.carbohydrateGrams,
      nextEntry.calories,
      nextEntry.measuredAt,
      nextEntry.note ?? null,
      nextEntry.createdAt,
      nextEntry.updatedAt,
      nextEntry.deletedAt
    ]
  );
  queueSync(createSyncRecord("meal", "update", nextEntry.id, nextEntry));
};

const updateActivityLocally = (entry: ActivityEntry) => {
  const nextEntry = {
    ...entry,
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };

  database.runSync(
    `INSERT OR REPLACE INTO activity_entries (id, activityType, steps, durationMinutes, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextEntry.id,
      nextEntry.activityType,
      nextEntry.steps ?? null,
      nextEntry.durationMinutes ?? null,
      nextEntry.measuredAt,
      nextEntry.note ?? null,
      nextEntry.createdAt,
      nextEntry.updatedAt,
      nextEntry.deletedAt
    ]
  );
  queueSync(createSyncRecord("activity", "update", nextEntry.id, nextEntry));
};

const updateMedicationLocally = (entry: MedicationEntry) => {
  const nextEntry = {
    ...entry,
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };

  database.runSync(
    `INSERT OR REPLACE INTO medication_entries (id, medicationName, dosage, scheduledFor, status, takenAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextEntry.id,
      nextEntry.medicationName,
      nextEntry.dosage,
      nextEntry.scheduledFor,
      nextEntry.status,
      nextEntry.takenAt ?? null,
      nextEntry.note ?? null,
      nextEntry.createdAt,
      nextEntry.updatedAt,
      nextEntry.deletedAt
    ]
  );
  queueSync(createSyncRecord("medication", "update", nextEntry.id, nextEntry));
};

const updateMedicationPlanLocally = (entry: MedicationPlanEntry) => {
  const nextEntry = {
    ...entry,
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };

  database.runSync(
    `INSERT OR REPLACE INTO medication_plan_entries (id, medicationName, dosage, scheduleTime, isActive, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextEntry.id,
      nextEntry.medicationName,
      nextEntry.dosage,
      nextEntry.scheduleTime,
      nextEntry.isActive ? 1 : 0,
      nextEntry.note ?? null,
      nextEntry.createdAt,
      nextEntry.updatedAt,
      nextEntry.deletedAt
    ]
  );
  queueSync(createSyncRecord("medication_plan", "update", nextEntry.id, nextEntry));
};

const deleteGlucoseLocally = (entry: GlucoseEntry) => {
  const deletedAt = new Date().toISOString();
  const nextEntry = {
    ...entry,
    updatedAt: deletedAt,
    deletedAt
  };

  database.runSync(
    `INSERT OR REPLACE INTO glucose_entries (id, readingType, valueMgDl, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [nextEntry.id, nextEntry.readingType, nextEntry.valueMgDl, nextEntry.measuredAt, nextEntry.note ?? null, nextEntry.createdAt, nextEntry.updatedAt, nextEntry.deletedAt]
  );
  queueSync(createSyncRecord("glucose", "update", nextEntry.id, nextEntry));
};

const deleteMetricLocally = (entry: HealthMetricEntry) => {
  const deletedAt = new Date().toISOString();
  const nextEntry = {
    ...entry,
    updatedAt: deletedAt,
    deletedAt
  };

  database.runSync(
    `INSERT OR REPLACE INTO health_metric_entries (id, metricType, value, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [nextEntry.id, nextEntry.metricType, nextEntry.value, nextEntry.measuredAt, nextEntry.note ?? null, nextEntry.createdAt, nextEntry.updatedAt, nextEntry.deletedAt]
  );
  queueSync(createSyncRecord("metric", "update", nextEntry.id, nextEntry));
};

const deleteHydrationLocally = (entry: HydrationEntry) => {
  const deletedAt = new Date().toISOString();
  const nextEntry = {
    ...entry,
    updatedAt: deletedAt,
    deletedAt
  };

  database.runSync(
    `INSERT OR REPLACE INTO hydration_entries (id, amountMl, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nextEntry.id, nextEntry.amountMl, nextEntry.measuredAt, nextEntry.note ?? null, nextEntry.createdAt, nextEntry.updatedAt, nextEntry.deletedAt]
  );
  queueSync(createSyncRecord("hydration", "update", nextEntry.id, nextEntry));
};

const deleteMealLocally = (entry: MealEntry) => {
  const deletedAt = new Date().toISOString();
  const nextEntry = {
    ...entry,
    updatedAt: deletedAt,
    deletedAt
  };

  database.runSync(
    `INSERT OR REPLACE INTO meal_entries (id, mealType, mealName, carbohydrateGrams, calories, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextEntry.id,
      nextEntry.mealType,
      nextEntry.mealName,
      nextEntry.carbohydrateGrams,
      nextEntry.calories,
      nextEntry.measuredAt,
      nextEntry.note ?? null,
      nextEntry.createdAt,
      nextEntry.updatedAt,
      nextEntry.deletedAt
    ]
  );
  queueSync(createSyncRecord("meal", "update", nextEntry.id, nextEntry));
};

const deleteActivityLocally = (entry: ActivityEntry) => {
  const deletedAt = new Date().toISOString();
  const nextEntry = {
    ...entry,
    updatedAt: deletedAt,
    deletedAt
  };

  database.runSync(
    `INSERT OR REPLACE INTO activity_entries (id, activityType, steps, durationMinutes, measuredAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextEntry.id,
      nextEntry.activityType,
      nextEntry.steps ?? null,
      nextEntry.durationMinutes ?? null,
      nextEntry.measuredAt,
      nextEntry.note ?? null,
      nextEntry.createdAt,
      nextEntry.updatedAt,
      nextEntry.deletedAt
    ]
  );
  queueSync(createSyncRecord("activity", "update", nextEntry.id, nextEntry));
};

const deleteMedicationLocally = (entry: MedicationEntry) => {
  const deletedAt = new Date().toISOString();
  const nextEntry = {
    ...entry,
    updatedAt: deletedAt,
    deletedAt
  };

  database.runSync(
    `INSERT OR REPLACE INTO medication_entries (id, medicationName, dosage, scheduledFor, status, takenAt, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextEntry.id,
      nextEntry.medicationName,
      nextEntry.dosage,
      nextEntry.scheduledFor,
      nextEntry.status,
      nextEntry.takenAt ?? null,
      nextEntry.note ?? null,
      nextEntry.createdAt,
      nextEntry.updatedAt,
      nextEntry.deletedAt
    ]
  );
  queueSync(createSyncRecord("medication", "update", nextEntry.id, nextEntry));
};

const deleteMedicationPlanLocally = (entry: MedicationPlanEntry) => {
  const deletedAt = new Date().toISOString();
  const nextEntry = {
    ...entry,
    updatedAt: deletedAt,
    deletedAt
  };

  database.runSync(
    `INSERT OR REPLACE INTO medication_plan_entries (id, medicationName, dosage, scheduleTime, isActive, note, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextEntry.id,
      nextEntry.medicationName,
      nextEntry.dosage,
      nextEntry.scheduleTime,
      nextEntry.isActive ? 1 : 0,
      nextEntry.note ?? null,
      nextEntry.createdAt,
      nextEntry.updatedAt,
      nextEntry.deletedAt
    ]
  );
  queueSync(createSyncRecord("medication_plan", "update", nextEntry.id, nextEntry));
};

const medicationReminderChannelId = "medication-reminders";
const dailyReminderChannelId = "daily-reminders";
type DailyReminderKind = "measurement" | "hydration" | "activity";

const ensureMedicationReminderChannel = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(medicationReminderChannelId, {
    name: currentLanguage() === "tr" ? "İlaç Hatırlatmaları" : "Medication Reminders",
    importance: Notifications.AndroidImportance.HIGH
  });
};

const ensureDailyReminderChannel = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(dailyReminderChannelId, {
    name: currentLanguage() === "tr" ? "Günlük Hatırlatmalar" : "Daily Reminders",
    importance: Notifications.AndroidImportance.DEFAULT
  });
};

const getMedicationNotificationId = (entryId: string) =>
  database.getAllSync<{ notificationId: string }>("SELECT notificationId FROM medication_notification_links WHERE entryId = ?", [entryId])[0]
    ?.notificationId ?? null;

const getMedicationPlanNotificationId = (planId: string) =>
  database.getAllSync<{ notificationId: string }>("SELECT notificationId FROM medication_plan_notification_links WHERE planId = ?", [planId])[0]
    ?.notificationId ?? null;

const saveMedicationNotificationId = (entryId: string, notificationId: string) => {
  database.runSync("INSERT OR REPLACE INTO medication_notification_links (entryId, notificationId) VALUES (?, ?)", [entryId, notificationId]);
};

const saveMedicationPlanNotificationId = (planId: string, notificationId: string) => {
  database.runSync("INSERT OR REPLACE INTO medication_plan_notification_links (planId, notificationId) VALUES (?, ?)", [planId, notificationId]);
};

const deleteMedicationNotificationId = (entryId: string) => {
  database.runSync("DELETE FROM medication_notification_links WHERE entryId = ?", [entryId]);
};

const deleteMedicationPlanNotificationId = (planId: string) => {
  database.runSync("DELETE FROM medication_plan_notification_links WHERE planId = ?", [planId]);
};

const getDailyReminderNotificationIds = async () => {
  const stored = await AsyncStorage.getItem(STORAGE_KEYS.dailyReminderNotifications);

  if (!stored) {
    return {} as Partial<Record<DailyReminderKind, string>>;
  }

  try {
    return JSON.parse(stored) as Partial<Record<DailyReminderKind, string>>;
  } catch {
    return {} as Partial<Record<DailyReminderKind, string>>;
  }
};

const saveDailyReminderNotificationIds = async (items: Partial<Record<DailyReminderKind, string>>) => {
  await AsyncStorage.setItem(STORAGE_KEYS.dailyReminderNotifications, JSON.stringify(items));
};

const shouldScheduleMedicationNotification = (entry: MedicationEntry) =>
  !entry.deletedAt && entry.status === "scheduled" && new Date(entry.scheduledFor).getTime() > Date.now();

const shouldScheduleMedicationPlanNotification = (entry: MedicationPlanEntry) => !entry.deletedAt && entry.isActive;
const parseScheduleTime = (value: string) => {
  const [hourText, minuteText] = value.split(":");

  return {
    hour: Number(hourText),
    minute: Number(minuteText)
  };
};

const ensureNotificationPermission = async (requestIfNeeded: boolean) => {
  const permissions = await Notifications.getPermissionsAsync();

  if (permissions.granted) {
    return true;
  }

  if (!requestIfNeeded) {
    return false;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true
    }
  });

  return requested.granted;
};

const cancelMedicationNotification = async (entryId: string) => {
  const notificationId = getMedicationNotificationId(entryId);

  if (!notificationId) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Local mapping can outlive cancelled notifications.
  }

  deleteMedicationNotificationId(entryId);
};

const cancelMedicationPlanNotification = async (planId: string) => {
  const notificationId = getMedicationPlanNotificationId(planId);

  if (!notificationId) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Local mapping can outlive cancelled notifications.
  }

  deleteMedicationPlanNotificationId(planId);
};

const cancelAllDailyReminderNotifications = async () => {
  const ids = await getDailyReminderNotificationIds();

  for (const notificationId of Object.values(ids)) {
    if (!notificationId) {
      continue;
    }

    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // Local mapping can outlive cancelled notifications.
    }
  }

  await AsyncStorage.removeItem(STORAGE_KEYS.dailyReminderNotifications);
};

const dailyReminderContent = (kind: DailyReminderKind) => {
  const language = currentLanguage();
  const text = displayTranslations[language];

  if (kind === "measurement") {
    return { title: text.measurementReminderTitle, body: text.measurementReminderBody };
  }

  if (kind === "hydration") {
    return { title: text.hydrationReminderTitle, body: text.hydrationReminderBody };
  }

  return { title: text.activityReminderTitle, body: text.activityReminderBody };
};

const syncDailyReminderNotifications = async (preferences: ReminderPreferenceDraft, requestPermission: boolean) => {
  await cancelAllDailyReminderNotifications();

  const enabledKinds: DailyReminderKind[] = [
    preferences.measurementReminders ? "measurement" : null,
    preferences.hydrationReminders ? "hydration" : null,
    preferences.activityReminders ? "activity" : null
  ].filter(Boolean) as DailyReminderKind[];

  if (enabledKinds.length === 0) {
    return true;
  }

  const hasPermission = await ensureNotificationPermission(requestPermission);

  if (!hasPermission) {
    return false;
  }

  await ensureDailyReminderChannel();

  const nextIds: Partial<Record<DailyReminderKind, string>> = {};

  for (const kind of enabledKinds) {
    const schedule = parseScheduleTime(
      kind === "measurement"
        ? preferences.measurementReminderTime
        : kind === "hydration"
          ? preferences.hydrationReminderTime
          : preferences.activityReminderTime
    );
    const content = dailyReminderContent(kind);
    nextIds[kind] = await Notifications.scheduleNotificationAsync({
      content: {
        ...content,
        sound: true
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: schedule.hour,
        minute: schedule.minute,
        repeats: true,
        ...(Platform.OS === "android" ? { channelId: dailyReminderChannelId } : {})
      }
    });
  }

  await saveDailyReminderNotificationIds(nextIds);
  return true;
};

const syncMedicationNotification = async (entry: MedicationEntry, requestPermission: boolean) => {
  await cancelMedicationNotification(entry.id);
  const preferences = parseStoredPreferences(await AsyncStorage.getItem(STORAGE_KEYS.preferences));

  if (preferences.medicationReminders !== true || !shouldScheduleMedicationNotification(entry)) {
    return true;
  }

  const hasPermission = await ensureNotificationPermission(requestPermission);

  if (!hasPermission) {
    return false;
  }

  await ensureMedicationReminderChannel();

  const language = currentLanguage();
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: entry.medicationName,
      body: language === "tr" ? `${entry.dosage} zamanı.` : `Time for ${entry.dosage}.`,
      sound: true
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(entry.scheduledFor),
      ...(Platform.OS === "android" ? { channelId: medicationReminderChannelId } : {})
    }
  });

  saveMedicationNotificationId(entry.id, notificationId);
  return true;
};

const syncMedicationPlanNotification = async (entry: MedicationPlanEntry, requestPermission: boolean) => {
  await cancelMedicationPlanNotification(entry.id);
  const preferences = parseStoredPreferences(await AsyncStorage.getItem(STORAGE_KEYS.preferences));

  if (preferences.medicationReminders !== true || !shouldScheduleMedicationPlanNotification(entry)) {
    return true;
  }

  const hasPermission = await ensureNotificationPermission(requestPermission);

  if (!hasPermission) {
    return false;
  }

  await ensureMedicationReminderChannel();

  const language = currentLanguage();
  const schedule = parseScheduleTime(entry.scheduleTime);
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: entry.medicationName,
      body: language === "tr" ? `${entry.dosage} zamanı.` : `Time For ${entry.dosage}.`,
      sound: true
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: schedule.hour,
      minute: schedule.minute,
      repeats: true,
      ...(Platform.OS === "android" ? { channelId: medicationReminderChannelId } : {})
    }
  });

  saveMedicationPlanNotificationId(entry.id, notificationId);
  return true;
};

const syncAllMedicationNotifications = async (requestPermission: boolean) => {
  const medicationEntries = listMedicationEntries();
  const medicationPlanEntries = listMedicationPlanEntries();
  let allScheduled = true;

  for (const entry of medicationEntries) {
    const scheduled = await syncMedicationNotification(entry, requestPermission);

    if (!scheduled) {
      allScheduled = false;
    }
  }

  for (const entry of medicationPlanEntries) {
    const scheduled = await syncMedicationPlanNotification(entry, requestPermission);

    if (!scheduled) {
      allScheduled = false;
    }
  }

  return allScheduled;
};

const saveMedicationLocallyWithReminder = async (entry: MedicationEntry) => {
  saveMedicationLocally(entry);
  return syncMedicationNotification(entry, true);
};

const updateMedicationLocallyWithReminder = async (entry: MedicationEntry) => {
  updateMedicationLocally(entry);
  return syncMedicationNotification(entry, true);
};

const deleteMedicationLocallyWithReminder = async (entry: MedicationEntry) => {
  deleteMedicationLocally(entry);
  await cancelMedicationNotification(entry.id);
};

const saveMedicationPlanLocallyWithReminder = async (entry: MedicationPlanEntry) => {
  saveMedicationPlanLocally(entry);
  return syncMedicationPlanNotification(entry, true);
};

const updateMedicationPlanLocallyWithReminder = async (entry: MedicationPlanEntry) => {
  updateMedicationPlanLocally(entry);
  return syncMedicationPlanNotification(entry, true);
};

const deleteMedicationPlanLocallyWithReminder = async (entry: MedicationPlanEntry) => {
  deleteMedicationPlanLocally(entry);
  await cancelMedicationPlanNotification(entry.id);
};

const listGlucoseEntries = () =>
  mapRows<GlucoseEntry>("SELECT * FROM glucose_entries WHERE deletedAt IS NULL ORDER BY measuredAt DESC");

const listMetricEntries = () =>
  mapRows<HealthMetricEntry>("SELECT * FROM health_metric_entries WHERE deletedAt IS NULL ORDER BY measuredAt DESC");

const listHydrationEntries = () =>
  mapRows<HydrationEntry>("SELECT * FROM hydration_entries WHERE deletedAt IS NULL ORDER BY measuredAt DESC");

const listMealEntries = () =>
  mapRows<MealEntry>("SELECT * FROM meal_entries WHERE deletedAt IS NULL ORDER BY measuredAt DESC");

const listActivityEntries = () =>
  mapRows<ActivityEntry>("SELECT * FROM activity_entries WHERE deletedAt IS NULL ORDER BY measuredAt DESC");

const listMedicationEntries = () =>
  mapRows<MedicationEntry>("SELECT * FROM medication_entries WHERE deletedAt IS NULL ORDER BY scheduledFor DESC");

type StoredMedicationPlanEntry = Omit<MedicationPlanEntry, "isActive"> & { isActive: number | boolean };

const normalizeMedicationPlanEntry = (entry: StoredMedicationPlanEntry): MedicationPlanEntry => ({
  ...entry,
  isActive: Boolean(entry.isActive)
});

const listMedicationPlanEntries = () =>
  mapRows<StoredMedicationPlanEntry>("SELECT * FROM medication_plan_entries WHERE deletedAt IS NULL ORDER BY isActive DESC, scheduleTime ASC").map(normalizeMedicationPlanEntry);

const hasLocalSyncData = () =>
  [
    "glucose_entries",
    "health_metric_entries",
    "hydration_entries",
    "meal_entries",
    "activity_entries",
    "medication_entries",
    "medication_plan_entries"
  ].some((tableName) => {
    const row = database.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM ${tableName} WHERE deletedAt IS NULL`);

    return Number(row?.count ?? 0) > 0;
  });

const queueSync = (record: ReturnType<typeof createSyncRecord>) => {
  database.runSync(
    `INSERT OR REPLACE INTO sync_queue (id, entity, operation, recordId, payload, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [record.recordId, record.entity, record.operation, record.recordId, JSON.stringify(record.payload), record.updatedAt]
  );
  scheduleQueuedSync();
};

const queueSyncWithoutSchedule = (record: ReturnType<typeof createSyncRecord>) => {
  database.runSync(
    `INSERT OR REPLACE INTO sync_queue (id, entity, operation, recordId, payload, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [record.recordId, record.entity, record.operation, record.recordId, JSON.stringify(record.payload), record.updatedAt]
  );
};

const backfillLocalRecordsToSyncQueue = () => {
  const enqueueRecord = (
    entity: ReturnType<typeof createSyncRecord>["entity"],
    record: { id: string; updatedAt: string }
  ) => {
    queueSyncWithoutSchedule({
      entity,
      operation: "update",
      recordId: record.id,
      payload: record as Record<string, unknown>,
      updatedAt: record.updatedAt
    });
  };

  listGlucoseEntries().forEach((entry) => enqueueRecord("glucose", entry));
  listMetricEntries().forEach((entry) => enqueueRecord("metric", entry));
  listHydrationEntries().forEach((entry) => enqueueRecord("hydration", entry));
  listMealEntries().forEach((entry) => enqueueRecord("meal", entry));
  listActivityEntries().forEach((entry) => enqueueRecord("activity", entry));
  listMedicationEntries().forEach((entry) => enqueueRecord("medication", entry));
  listMedicationPlanEntries().forEach((entry) => enqueueRecord("medication_plan", entry));
};

let queuedSyncTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleQueuedSync = () => {
  if (queuedSyncTimer) {
    clearTimeout(queuedSyncTimer);
  }

  queuedSyncTimer = setTimeout(() => {
    queuedSyncTimer = null;
    void pushQueuedChangesToRemote().catch(() => undefined);
  }, 800);
};

const latestWeightMetric = () =>
  listMetricEntries()
    .filter((item) => item.metricType === "weight")
    .sort((left, right) => new Date(right.measuredAt).getTime() - new Date(left.measuredAt).getTime())[0] ?? null;

const syncProfileWeightFromLatestMetric = async (
  profile: UserProfile | null,
  applyProfile: (profile: UserProfile | null) => Promise<void>
) => {
  const latestWeight = latestWeightMetric();
  const latestWeightKg = latestWeight ? parseWeightValue(latestWeight.value) : null;

  if (!profile || latestWeightKg === null || profile.weightKg === latestWeightKg) {
    return;
  }

  const now = new Date().toISOString();
  const nextProfile: UserProfile = {
    ...profile,
    weightKg: latestWeightKg,
    updatedAt: now
  };

  await applyProfile(nextProfile);
  queueSync(createSyncRecord("profile", "update", nextProfile.id ?? "profile", { weightKg: latestWeightKg }));
};

const listQueuedChanges = () =>
  mapRows<{
    id: string;
    entity: "profile" | "glucose" | "metric" | "hydration" | "medication" | "medication_plan" | "meal" | "activity";
    operation: "create" | "update";
    recordId: string;
    payload: string;
    updatedAt: string;
  }>("SELECT * FROM sync_queue ORDER BY updatedAt ASC").map((row) => ({
    entity: row.entity,
    operation: row.operation,
    recordId: row.recordId,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    updatedAt: row.updatedAt
  }));

const clearQueuedChanges = (ids: string[]) => {
  ids.forEach((id) => {
    database.runSync("DELETE FROM sync_queue WHERE id = ?", [id]);
  });
};

const parseStoredPreferences = (value: string | null): ReminderPreferenceDraft => {
  if (!value) {
    return { ...defaultPreferences };
  }

  try {
    const parsed = JSON.parse(value) as Partial<ReminderPreferenceDraft>;

    return {
      measurementReminders: parsed.measurementReminders === true,
      medicationReminders: parsed.medicationReminders === true,
      hydrationReminders: parsed.hydrationReminders === true,
      activityReminders: parsed.activityReminders === true,
      measurementReminderTime: parsed.measurementReminderTime ?? defaultPreferences.measurementReminderTime,
      hydrationReminderTime: parsed.hydrationReminderTime ?? defaultPreferences.hydrationReminderTime,
      activityReminderTime: parsed.activityReminderTime ?? defaultPreferences.activityReminderTime,
      healthPermissionApproved: parsed.healthPermissionApproved ?? defaultPreferences.healthPermissionApproved
    };
  } catch {
    return { ...defaultPreferences };
  }
};

const parseStoredTheme = (value: string | null): ThemeMode => (value === "light" ? "light" : "dark");
const applyRuntimeTheme = (themeMode: ThemeMode) => {
  activeThemeMode = themeMode;
  palette = themePalettes[themeMode];
  styles = createAppStyles(palette);
};

const saveLocalPreferences = async (preferences: ReminderPreferenceDraft) => {
  await AsyncStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences));
};

const loadEmergencyCard = async (): Promise<EmergencyCard | null> => {
  const stored = await AsyncStorage.getItem(STORAGE_KEYS.emergencyCard);

  if (!stored) {
    return null;
  }

  const parsed = emergencyCardSchema.safeParse(JSON.parse(stored));

  return parsed.success ? parsed.data : null;
};

const saveEmergencyCard = async (card: EmergencyCard) => {
  const parsed = emergencyCardSchema.parse(card);
  await AsyncStorage.setItem(STORAGE_KEYS.emergencyCard, JSON.stringify(parsed));

  return parsed;
};

const saveReminderPreferencesRemote = async (payload: ReminderPreferenceDraft) => {
  const response = await fetch(`${apiUrl}/reminder-preferences/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders())
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Reminder preferences could not be saved");
  }

  const parsed = (await response.json()) as ReminderPreference;

  return {
    measurementReminders: parsed.measurementReminders,
    medicationReminders: parsed.medicationReminders,
    hydrationReminders: parsed.hydrationReminders,
    activityReminders: parsed.activityReminders,
    measurementReminderTime: parsed.measurementReminderTime,
    hydrationReminderTime: parsed.hydrationReminderTime,
    activityReminderTime: parsed.activityReminderTime,
    healthPermissionApproved: parsed.healthPermissionApproved
  };
};

const getCurrentAuthIdentity = (firebaseUser: User | null, devSessionEmail?: string | null) => {
  if (firebaseUser?.uid) {
    return `firebase:${firebaseUser.uid}`;
  }

  if (devSessionEmail?.trim()) {
    return `dev:${devSessionEmail.trim().toLowerCase()}`;
  }

  return null;
};

const sanitizeQueuedChanges = () => {
  const queued = listQueuedChanges();
  const validChanges = queued.filter((change) => {
    if (change.entity === "glucose") {
      return glucoseEntrySchema.safeParse(change.payload).success;
    }

    if (change.entity === "metric") {
      return healthMetricEntrySchema.safeParse(change.payload).success;
    }

    if (change.entity === "hydration") {
      return hydrationEntrySchema.safeParse(change.payload).success;
    }

    if (change.entity === "medication") {
      return medicationEntrySchema.safeParse(change.payload).success;
    }

    if (change.entity === "medication_plan") {
      return medicationPlanEntrySchema.safeParse(change.payload).success;
    }

    if (change.entity === "meal") {
      return mealEntrySchema.safeParse(change.payload).success;
    }

    if (change.entity === "activity") {
      return activityEntrySchema.safeParse(change.payload).success;
    }

    return true;
  });
  const invalidIds = queued
    .filter((change) => !validChanges.includes(change))
    .map((change) => change.recordId);

  if (invalidIds.length > 0) {
    clearQueuedChanges(invalidIds);
  }

  return validChanges;
};

const clearLocalData = async () => {
  const medicationNotificationIds = database.getAllSync<{ notificationId: string }>("SELECT notificationId FROM medication_notification_links");
  const medicationPlanNotificationIds = database.getAllSync<{ notificationId: string }>("SELECT notificationId FROM medication_plan_notification_links");

  for (const item of [...medicationNotificationIds, ...medicationPlanNotificationIds]) {
    try {
      await Notifications.cancelScheduledNotificationAsync(item.notificationId);
    } catch {
      // Notification may already be gone.
    }
  }

  database.runSync("DELETE FROM glucose_entries");
  database.runSync("DELETE FROM health_metric_entries");
  database.runSync("DELETE FROM hydration_entries");
  database.runSync("DELETE FROM meal_entries");
  database.runSync("DELETE FROM activity_entries");
  database.runSync("DELETE FROM medication_entries");
  database.runSync("DELETE FROM medication_plan_entries");
  database.runSync("DELETE FROM medication_notification_links");
  database.runSync("DELETE FROM medication_plan_notification_links");
  database.runSync("DELETE FROM sync_queue");
  await AsyncStorage.removeItem(STORAGE_KEYS.profile);
  await AsyncStorage.removeItem(STORAGE_KEYS.preferences);
  await AsyncStorage.removeItem(STORAGE_KEYS.emergencyCard);
  await AsyncStorage.removeItem(STORAGE_KEYS.syncCursor);
  await cancelAllDailyReminderNotifications();
};

const clearSessionState = async () => {
  await clearLocalData();
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.profile,
    STORAGE_KEYS.syncCursor,
    STORAGE_KEYS.activeUser,
    STORAGE_KEYS.activeAuthIdentity,
    STORAGE_KEYS.devSession,
    STORAGE_KEYS.devAccounts
  ]);
};

const clearAuthOnlyState = async () => {
  await AsyncStorage.removeItem(STORAGE_KEYS.devSession);
};

const resetLegacyLocalStateIfNeeded = async () => {
  const appliedResetVersion = await AsyncStorage.getItem(STORAGE_KEYS.storageResetVersion);

  if (appliedResetVersion === CLIENT_RESET_VERSION) {
    return;
  }

  await clearSessionState();
  await AsyncStorage.setItem(STORAGE_KEYS.storageResetVersion, CLIENT_RESET_VERSION);
};

const upsertRemoteState = async (response: {
  profile: UserProfile | null;
  glucose: GlucoseEntry[];
  metrics: HealthMetricEntry[];
  hydration: HydrationEntry[];
  medication: MedicationEntry[];
  medicationPlans: MedicationPlanEntry[];
  meals: MealEntry[];
  activities: ActivityEntry[];
  cursor: string;
}) => {
  response.glucose.forEach((entry) => {
    database.runSync(
      `INSERT OR REPLACE INTO glucose_entries (id, readingType, valueMgDl, measuredAt, note, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.readingType, entry.valueMgDl, entry.measuredAt, entry.note ?? null, entry.createdAt, entry.updatedAt, entry.deletedAt ?? null]
    );
  });

  response.metrics.forEach((entry) => {
    database.runSync(
      `INSERT OR REPLACE INTO health_metric_entries (id, metricType, value, measuredAt, note, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.metricType, entry.value, entry.measuredAt, entry.note ?? null, entry.createdAt, entry.updatedAt, entry.deletedAt ?? null]
    );
  });

  response.hydration.forEach((entry) => {
    database.runSync(
      `INSERT OR REPLACE INTO hydration_entries (id, amountMl, measuredAt, note, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.amountMl, entry.measuredAt, entry.note ?? null, entry.createdAt, entry.updatedAt, entry.deletedAt ?? null]
    );
  });

  for (const entry of response.medication) {
    database.runSync(
      `INSERT OR REPLACE INTO medication_entries (id, medicationName, dosage, scheduledFor, status, takenAt, note, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.medicationName,
        entry.dosage,
        entry.scheduledFor,
        entry.status,
        entry.takenAt ?? null,
        entry.note ?? null,
        entry.createdAt,
        entry.updatedAt,
        entry.deletedAt ?? null
      ]
    );
    await syncMedicationNotification(entry, false);
  }

  for (const entry of response.medicationPlans) {
    database.runSync(
      `INSERT OR REPLACE INTO medication_plan_entries (id, medicationName, dosage, scheduleTime, isActive, note, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.medicationName,
        entry.dosage,
        entry.scheduleTime,
        entry.isActive ? 1 : 0,
        entry.note ?? null,
        entry.createdAt,
        entry.updatedAt,
        entry.deletedAt ?? null
      ]
    );
    await syncMedicationPlanNotification(entry, false);
  }

  for (const entry of response.meals) {
    database.runSync(
      `INSERT OR REPLACE INTO meal_entries (id, mealType, mealName, carbohydrateGrams, calories, measuredAt, note, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.mealType,
        entry.mealName,
        entry.carbohydrateGrams,
        entry.calories,
        entry.measuredAt,
        entry.note ?? null,
        entry.createdAt,
        entry.updatedAt,
        entry.deletedAt ?? null
      ]
    );
  }

  response.activities.forEach((entry) => {
    database.runSync(
      `INSERT OR REPLACE INTO activity_entries (id, activityType, steps, durationMinutes, measuredAt, note, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.activityType,
        entry.steps ?? null,
        entry.durationMinutes ?? null,
        entry.measuredAt,
        entry.note ?? null,
        entry.createdAt,
        entry.updatedAt,
        entry.deletedAt ?? null
      ]
    );
  });

  if (response.profile) {
    await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(response.profile));
  }

  await AsyncStorage.setItem(STORAGE_KEYS.syncCursor, response.cursor);
};

const pushQueuedChangesToRemote = async () => {
  backfillLocalRecordsToSyncQueue();
  const queued = sanitizeQueuedChanges();

  if (queued.length === 0) {
    return;
  }

  const headers = await getAuthHeaders();
  const pushResponse = await fetch(`${apiUrl}/sync/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify({
      lastPulledAt: await AsyncStorage.getItem(STORAGE_KEYS.syncCursor),
      changes: queued
    })
  });

  if (!pushResponse.ok) {
    throw new Error("Queued sync failed");
  }

  const pushPayload = await pushResponse.json();
  await upsertRemoteState(pushPayload);
  clearQueuedChanges(queued.map((change) => change.recordId));
};

const saveProfileRemote = async (payload: {
  language: "tr" | "en";
  gender: "male" | "female";
  diabetesProfile: "type1" | "type2" | "gestational";
  fullName: string;
  heightCm: number;
  weightKg: number;
  onboardingCompleted: boolean;
  disclaimerAcceptedAt: string | null;
}) => {
  const response = await fetch(`${apiUrl}/profile/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders())
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Profile could not be saved");
  }

  const profile = (await response.json()) as UserProfile;
  await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  return profile;
};

const deleteProfileRemote = async () => {
  const response = await fetch(`${apiUrl}/profile/me`, {
    method: "DELETE",
    headers: await getAuthHeaders()
  });

  if (!response.ok) {
    throw new Error("Delete account failed");
  }
};

const useSession = () => React.useContext(sessionContext);

const signInDevAccount = async (email: string, password: string) => {
  const response = await fetch(`${apiUrl}/auth/dev/sign-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password
    })
  });

  if (!response.ok) {
    throw new Error("Invalid credentials");
  }

  await AsyncStorage.setItem(
    STORAGE_KEYS.devSession,
    JSON.stringify({
      email: email.trim().toLowerCase()
    })
  );
};

const signUpDevAccount = async (email: string, password: string) => {
  const response = await fetch(`${apiUrl}/auth/dev/sign-up`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(payload?.message) ? payload?.message.join(", ") : payload?.message;

    throw new Error(message ?? "Account could not be created");
  }

  await AsyncStorage.setItem(
    STORAGE_KEYS.devSession,
    JSON.stringify({
      email: email.trim().toLowerCase()
    })
  );
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  if (devAuthBypass) {
    const storedDevSession = await AsyncStorage.getItem(STORAGE_KEYS.devSession);
    const parsedDevSession = storedDevSession ? (JSON.parse(storedDevSession) as { email?: string }) : null;
    const storedProfile = await AsyncStorage.getItem(STORAGE_KEYS.profile);
    const parsedProfile = storedProfile ? (JSON.parse(storedProfile) as { fullName?: string }) : null;

    if (!parsedDevSession?.email?.trim()) {
      throw new Error("Missing dev session");
    }

    return {
      "x-dev-auth": "true",
      "x-dev-auth-email": parsedDevSession.email.trim().toLowerCase(),
      "x-dev-auth-name": parsedProfile?.fullName?.trim() ?? "DiaHealth Dev"
    };
  }

  if (!auth?.currentUser) {
    throw new Error("Missing authenticated user");
  }

  const idToken = await auth.currentUser.getIdToken();

  return {
    Authorization: `Bearer ${idToken}`
  };
};

const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = React.useState<SessionState>({
    accountEmail: null,
    firebaseUser: null,
    hasDevSession: false,
    preferences: { ...defaultPreferences },
    profile: null,
    ready: false,
    themeMode: currentThemeMode()
  });

  const refresh = React.useCallback(async () => {
    const storedProfile = await AsyncStorage.getItem(STORAGE_KEYS.profile);
    let cachedProfile = storedProfile ? (JSON.parse(storedProfile) as UserProfile) : null;
    const storedPreferences = await AsyncStorage.getItem(STORAGE_KEYS.preferences);
    let cachedPreferences = parseStoredPreferences(storedPreferences);
    const cachedThemeMode = parseStoredTheme(await AsyncStorage.getItem(STORAGE_KEYS.theme));
    const storedDevSession = await AsyncStorage.getItem(STORAGE_KEYS.devSession);
    const parsedDevSession = storedDevSession ? (JSON.parse(storedDevSession) as { email?: string }) : null;
    const firebaseUser = auth?.currentUser ?? null;
    const previousAuthIdentity = await AsyncStorage.getItem(STORAGE_KEYS.activeAuthIdentity);
    const nextAuthIdentity = getCurrentAuthIdentity(firebaseUser, parsedDevSession?.email ?? null);
    const authChanged = Boolean(previousAuthIdentity && nextAuthIdentity && previousAuthIdentity !== nextAuthIdentity);

    if (authChanged) {
      await clearLocalData();
      cachedProfile = null;
      cachedPreferences = { ...defaultPreferences };
    }
    applyRuntimeTheme(cachedThemeMode);

    if (!firebaseUser && (!devAuthBypass || !parsedDevSession?.email?.trim())) {
      setState({
        accountEmail: null,
        firebaseUser: null,
        hasDevSession: false,
        preferences: cachedPreferences,
        profile: null,
        ready: true,
        themeMode: cachedThemeMode
      });
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/auth/session`, {
        method: "POST",
        headers
      });
      if (devAuthBypass && response.status === 401) {
        await clearSessionState();
        queryClient.clear();
        setState({
          accountEmail: null,
          firebaseUser: null,
          hasDevSession: false,
          preferences: { ...defaultPreferences },
          profile: null,
          ready: true,
          themeMode: cachedThemeMode
        });
        return;
      }

      if (!response.ok) {
        throw new Error("Session request failed");
      }

      const session = await response.json();
      const nextProfile = session.profile ?? null;
      const nextPreferences = session.reminderPreferences
        ? parseStoredPreferences(JSON.stringify(session.reminderPreferences))
        : cachedPreferences;
      const nextUserId = session.user?.id ?? nextProfile?.userId ?? firebaseUser?.uid ?? parsedDevSession?.email ?? null;
      const activeUser = await AsyncStorage.getItem(STORAGE_KEYS.activeUser);
      const userChanged = Boolean(activeUser && nextUserId && activeUser !== nextUserId);

      if (userChanged) {
        await clearLocalData();
      }

      await saveLocalPreferences(nextPreferences);

      if (!userChanged) {
        await pushQueuedChangesToRemote();
      }

      if (!hasLocalSyncData()) {
        await AsyncStorage.removeItem(STORAGE_KEYS.syncCursor);
      }

      const pullResponse = await fetch(`${apiUrl}/sync/pull`, {
        method: "GET",
        headers
      });
      const pullPayload = await pullResponse.json();

      await upsertRemoteState(pullPayload);
      await syncAllMedicationNotifications(false);
      await syncDailyReminderNotifications(nextPreferences, false);

      if (nextProfile) {
        await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(nextProfile));
        await AsyncStorage.setItem(STORAGE_KEYS.language, nextProfile.language);
        await i18n.changeLanguage(nextProfile.language);
      }

      if (nextUserId) {
        await AsyncStorage.setItem(STORAGE_KEYS.activeUser, nextUserId);
      }

      if (nextAuthIdentity) {
        await AsyncStorage.setItem(STORAGE_KEYS.activeAuthIdentity, nextAuthIdentity);
      }

      setState({
        accountEmail: firebaseUser?.email ?? parsedDevSession?.email?.trim().toLowerCase() ?? session.user?.email ?? null,
        firebaseUser,
        hasDevSession: Boolean(storedDevSession),
        preferences: nextPreferences,
        profile: nextProfile,
        ready: true,
        themeMode: cachedThemeMode
      });
    } catch {
      if (cachedProfile?.language) {
        await i18n.changeLanguage(cachedProfile.language);
      }

      setState({
        accountEmail: firebaseUser?.email ?? parsedDevSession?.email?.trim().toLowerCase() ?? null,
        firebaseUser,
        hasDevSession: Boolean(storedDevSession),
        preferences: cachedPreferences,
        profile: cachedProfile,
        ready: true,
        themeMode: cachedThemeMode
      });
    }
  }, []);

  const applyProfile = React.useCallback(async (profile: UserProfile | null) => {
    if (profile) {
      await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.profile);
    }

    setState((current) => ({
      ...current,
      profile
    }));
  }, []);

  const applyPreferences = React.useCallback(async (preferences: ReminderPreferenceDraft) => {
    await saveLocalPreferences(preferences);
    await syncAllMedicationNotifications(true);
    await syncDailyReminderNotifications(preferences, true);

    setState((current) => ({
      ...current,
      preferences
    }));
  }, []);

  const applyTheme = React.useCallback(async (themeMode: ThemeMode) => {
    await AsyncStorage.setItem(STORAGE_KEYS.theme, themeMode);
    applyRuntimeTheme(themeMode);

    setState((current) => ({
      ...current,
      themeMode
    }));
  }, []);

  const deleteAccountHandler = React.useCallback(async () => {
    await deleteProfileRemote();

    if (auth?.currentUser) {
      try {
        await deleteUser(auth.currentUser);
      } catch {
        await signOut(auth);
      }
    }

    await clearSessionState();
    queryClient.clear();
    setState({
      accountEmail: null,
      firebaseUser: null,
      hasDevSession: false,
      preferences: { ...defaultPreferences },
      profile: null,
      ready: true,
      themeMode: currentThemeMode()
    });
  }, []);

  React.useEffect(() => {
    initDatabase();
    let unsubscribe: undefined | (() => void);

    void resetLegacyLocalStateIfNeeded().then(() => {
      if (!auth || devAuthBypass) {
        void refresh();
        return;
      }

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          setState({
            accountEmail: null,
            firebaseUser: null,
            hasDevSession: false,
            preferences: { ...defaultPreferences },
            profile: null,
            ready: true,
            themeMode: currentThemeMode()
          });
          return;
        }

        await refresh();
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, [refresh]);

  const signInWithEmailHandler = async (email: string, password: string) => {
    if (devAuthBypass || !auth) {
      await signInDevAccount(email, password);
      await refresh();
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
    await refresh();
  };

  const signUpWithEmailHandler = async (email: string, password: string) => {
    if (devAuthBypass || !auth) {
      await signUpDevAccount(email, password);
      await refresh();
      return;
    }

    await createUserWithEmailAndPassword(auth, email, password);
    await refresh();
  };

  const signInWithGoogleToken = async (idToken: string) => {
    if (!auth) {
      await refresh();
      return;
    }

    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
    await refresh();
  };

  const signInWithAppleToken = async (idToken: string) => {
    if (!auth) {
      await refresh();
      return;
    }

    const provider = new OAuthProvider("apple.com");
    const credential = provider.credential({ idToken });
    await signInWithCredential(auth, credential);
    await refresh();
  };

  const logout = async () => {
    await pushQueuedChangesToRemote().catch(() => undefined);

    if (auth) {
      await signOut(auth);
    }

    await clearAuthOnlyState();
    setState({
      accountEmail: null,
      firebaseUser: null,
      hasDevSession: false,
      preferences: { ...defaultPreferences },
      profile: null,
      ready: true,
      themeMode: currentThemeMode()
    });
  };

  return (
      <sessionContext.Provider
        value={{
        state,
        refresh,
        applyProfile,
        applyPreferences,
        applyTheme,
        deleteAccount: deleteAccountHandler,
        signInWithEmail: signInWithEmailHandler,
        signUpWithEmail: signUpWithEmailHandler,
        signInWithGoogleToken,
        signInWithAppleToken,
        logout
      }}
    >
      {children}
    </sessionContext.Provider>
  );
};

const FormField = ({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType,
  editable = true
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "numeric" | "decimal-pad" | "email-address" | "phone-pad";
  editable?: boolean;
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      secureTextEntry={secureTextEntry}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
      editable={editable}
      style={styles.input}
    />
  </View>
);

const ReadonlyField = ({ label, value, tone }: { label: string; value: string; tone?: ChartTone | null }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View
      style={[
        styles.readonlyField,
        tone === "safe" && styles.readonlyFieldSafe,
        tone === "warning" && styles.readonlyFieldWarning,
        tone === "danger" && styles.readonlyFieldDanger
      ]}
    >
      <Text
        style={[
          styles.readonlyValue,
          tone === "safe" && styles.readonlyValueSafe,
          tone === "warning" && styles.readonlyValueWarning,
          tone === "danger" && styles.readonlyValueDanger
        ]}
      >
        {value}
      </Text>
    </View>
  </View>
);

const DateField = ({
  label,
  value,
  onChange,
  alwaysVisible = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  alwaysVisible?: boolean;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(alwaysVisible && Platform.OS === "ios");
  const language = currentLanguage();
  const showPicker = (alwaysVisible && Platform.OS === "ios") || open;
  const pickerLocale = language === "tr" ? "tr-TR" : "en-US";

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setOpen((current) => !current)} style={styles.dateTrigger}>
        <Text style={styles.dateValue}>{formatDateLabel(value, language)}</Text>
        <Text style={styles.dateAction}>{showPicker ? t("hideCalendar") : t("changeDate")}</Text>
      </Pressable>
      {showPicker ? (
        <View style={styles.datePickerCard}>
          <DateTimePicker
            value={clampDateToToday(new Date(value))}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            locale={pickerLocale}
            accentColor={palette.accent}
            themeVariant={currentThemeMode()}
            maximumDate={new Date()}
            onChange={(event, selectedDate) => {
              if (Platform.OS === "android") {
                setOpen(false);
              }

              if (!selectedDate || event.type === "dismissed") {
                return;
              }

              onChange(mergeDateWithCurrentTime(value, clampDateToToday(selectedDate)));
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

const mergeTimeWithCurrentDate = (currentIso: string, selectedTime: Date) => {
  const currentDate = new Date(currentIso);
  const nextDate = new Date(currentDate);

  nextDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

  return nextDate.toISOString();
};

const DateTimeField = ({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const { t } = useTranslation();
  const [dateOpen, setDateOpen] = React.useState(false);
  const [timeOpen, setTimeOpen] = React.useState(false);
  const language = currentLanguage();
  const pickerLocale = language === "tr" ? "tr-TR" : "en-US";

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inline}>
        <View style={styles.flexItem}>
          <Pressable onPress={() => setDateOpen((current) => !current)} style={styles.dateTrigger}>
            <Text style={styles.dateValue}>{formatDateLabel(value, language)}</Text>
            <Text style={styles.dateAction}>{dateOpen ? t("hideCalendar") : t("changeDate")}</Text>
          </Pressable>
        </View>
        <View style={styles.flexItem}>
          <Pressable onPress={() => setTimeOpen((current) => !current)} style={styles.dateTrigger}>
            <Text style={styles.dateValue}>{formatTimeLabel(value, language)}</Text>
            <Text style={styles.dateAction}>{timeOpen ? t("hideTime") : t("changeTime")}</Text>
          </Pressable>
        </View>
      </View>
      {dateOpen ? (
        <View style={styles.datePickerCard}>
          <DateTimePicker
            value={new Date(value)}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            locale={pickerLocale}
            accentColor={palette.accent}
            themeVariant={currentThemeMode()}
            onChange={(event, selectedDate) => {
              if (Platform.OS === "android") {
                setDateOpen(false);
              }

              if (!selectedDate || event.type === "dismissed") {
                return;
              }

              onChange(mergeDateWithCurrentTime(value, selectedDate));
            }}
          />
        </View>
      ) : null}
      {timeOpen ? (
        <View style={styles.datePickerCard}>
          <DateTimePicker
            value={new Date(value)}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            locale={pickerLocale}
            accentColor={palette.accent}
            themeVariant={currentThemeMode()}
            onChange={(event, selectedTime) => {
              if (Platform.OS === "android") {
                setTimeOpen(false);
              }

              if (!selectedTime || event.type === "dismissed") {
                return;
              }

              onChange(mergeTimeWithCurrentDate(value, selectedTime));
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

const ScreenHeader = ({ title, onBack }: { title: string; onBack: () => void }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <ActionButton label={t("back")} tone="secondary" onPress={onBack} />
    </View>
  );
};

const ToggleField = ({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={styles.toggleRow}>
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
    </View>
    <Text style={styles.toggleLabel}>{label}</Text>
  </Pressable>
);

const BrandLogo = ({ compact = false }: { compact?: boolean }) => (
  <Image source={brandImages.get(diaHealthLogo)} style={compact ? styles.brandLogoCompact : styles.brandLogo} contentFit="contain" cachePolicy="memory-disk" transition={0} />
);

const ActionButton = ({ label, onPress, tone = "primary" }: { label: string; onPress: () => void; tone?: "primary" | "secondary" | "danger" }) => (
  <Pressable
    onPress={onPress}
    style={[styles.button, tone === "secondary" && styles.buttonSecondary, tone === "danger" && styles.buttonDanger]}
  >
    <Text style={[styles.buttonText, tone === "secondary" && styles.buttonSecondaryText, tone === "danger" && styles.buttonDangerText]}>{label}</Text>
  </Pressable>
);

const FormScreen = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaView style={styles.screen}>
    <KeyboardAvoidingView style={styles.screenLayout} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.stack}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);

const HomeBottomBar = ({
  currentRoute,
  navigate
}: {
  currentRoute: BottomRoute;
  navigate: (route: BottomRoute) => void;
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const darkTheme = currentThemeMode() === "dark";
  const items: Array<{ route: BottomRoute; label: string; icon?: number; glyph?: string }> = [
    { route: "Home", label: t("home") },
    { route: "SugarTracking", label: t("sugarTracking"), icon: darkTheme ? tabGlucoseDarkIcon : tabGlucoseIcon },
    { route: "HealthValues", label: t("healthValues"), icon: darkTheme ? tabHealthDarkIcon : tabHealthIcon },
    { route: "MealList", label: t("nutrition"), icon: darkTheme ? tabFoodDarkIcon : tabFoodIcon },
    { route: "Profile", label: t("profile"), icon: darkTheme ? tabProfileDarkIcon : tabProfileIcon }
  ];

  return (
    <View style={styles.bottomBarWrap}>
      <View style={[styles.bottomBar, { paddingBottom: 10 + insets.bottom }]}>
        <View style={styles.bottomBarItems}>
          {items.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => navigate(item.route)}
              accessibilityRole="tab"
              accessibilityState={{ selected: currentRoute === item.route }}
              style={[styles.bottomBarButton, currentRoute === item.route && styles.bottomBarButtonActive]}
            >
              {item.route === "Home" ? (
                <View style={[styles.bottomBarIcon, styles.bottomBarHomeIcon, currentRoute === item.route && styles.bottomBarIconActive]}>
                  <View style={styles.bottomBarHomeRoof} />
                  <View style={styles.bottomBarHomeBody}>
                    <View style={styles.bottomBarHomeDoor} />
                  </View>
                </View>
              ) : item.icon ? (
                <Image
                  source={brandImages.get(item.icon)}
                  cachePolicy="memory-disk"
                  transition={0}
                  style={[styles.bottomBarIcon, currentRoute === item.route && styles.bottomBarIconActive]}
                  contentFit="contain"
                />
              ) : (
                <Text style={[styles.bottomBarGlyph, currentRoute === item.route && styles.bottomBarGlyphActive]}>{item.glyph}</Text>
              )}
              <View style={styles.bottomBarLabelWrap}>
                <Text
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={[styles.bottomBarLabel, currentRoute === item.route && styles.bottomBarLabelActive]}
                >
                  {item.label}
                </Text>
              </View>
              <View style={[styles.bottomBarIndicator, currentRoute === item.route && styles.bottomBarIndicatorActive]} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
};

const MainScreenLayout = ({
  children,
  keyboardAware = false
}: {
  children: React.ReactNode;
  keyboardAware?: boolean;
}) => {
  const scrollView = (
    <ScrollView
      contentContainerStyle={styles.mainScreenContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.screenLayout}>
        {keyboardAware ? (
          <KeyboardAvoidingView style={styles.screenLayout} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            {scrollView}
          </KeyboardAvoidingView>
        ) : (
          scrollView
        )}
      </View>
    </SafeAreaView>
  );
};

const LineChart = ({
  sectionTitle,
  sectionMeta,
  points,
  yTicks,
  xLabelEvery = 1
}: {
  sectionTitle: string;
  sectionMeta?: string;
  points: Array<{ id: string; label: string; value: number; tone?: "safe" | "warning" | "danger" | null }>;
  yTicks: number[];
  xLabelEvery?: number;
}) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const chartHeight = 220;
  const paddingLeft = 34;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 34;
  const chartWidth = Math.max(width - 92, 240, paddingLeft + paddingRight + Math.max(points.length - 1, 1) * 28);
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const yMin = Math.min(...yTicks);
  const yMax = Math.max(...yTicks);
  const chartPoints = points.map((point, index) => {
    const normalizedValue = Math.max(yMin, Math.min(yMax, point.value));
    const x = paddingLeft + (points.length === 1 ? plotWidth / 2 : (plotWidth / Math.max(points.length - 1, 1)) * index);
    const y = paddingTop + plotHeight * (1 - (normalizedValue - yMin) / Math.max(yMax - yMin, 1));

    return {
      ...point,
      x,
      y
    };
  });

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
      {sectionMeta ? <Text style={styles.chartMeta}>{sectionMeta}</Text> : null}
      {chartPoints.length === 0 ? (
        <View style={styles.chartEmptyWrap}>
          <Text style={styles.chartEmptyText}>{t("chartEmpty")}</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScrollContent}>
          <View style={[styles.chartFrame, { width: chartWidth, height: chartHeight }]}>
            {yTicks.map((tick) => {
              const y = paddingTop + plotHeight * (1 - (tick - yMin) / Math.max(yMax - yMin, 1));

              return (
                <React.Fragment key={tick}>
                  <View style={[styles.chartGridLine, { top: y, left: paddingLeft, width: plotWidth }]} />
                  <Text style={[styles.chartYAxisLabel, { top: y - 8 }]}>{tick}</Text>
                </React.Fragment>
              );
            })}
            <View style={[styles.chartAxisVertical, { left: paddingLeft, top: paddingTop, height: plotHeight }]} />
            <View style={[styles.chartAxisHorizontal, { left: paddingLeft, top: paddingTop + plotHeight, width: plotWidth }]} />
            {chartPoints.slice(1).map((point, index) => {
              const previousPoint = chartPoints[index];
              const dx = point.x - previousPoint.x;
              const dy = point.y - previousPoint.y;
              const segmentWidth = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx);

              return (
                <View
                  key={`${previousPoint.id}-${point.id}`}
                  style={[
                    styles.chartLineSegment,
                    {
                      left: (previousPoint.x + point.x) / 2 - segmentWidth / 2,
                      top: (previousPoint.y + point.y) / 2 - 1,
                      width: segmentWidth,
                      backgroundColor: toneColor(point.tone),
                      transform: [{ rotateZ: `${angle}rad` }]
                    }
                  ]}
                />
              );
            })}
            {chartPoints.map((point, index) => (
              <React.Fragment key={point.id}>
                <View
                  style={[
                    styles.chartPoint,
                    {
                      left: point.x - 5,
                      top: point.y - 5,
                      backgroundColor: toneColor(point.tone)
                    }
                  ]}
                />
                {index % xLabelEvery === 0 || index === chartPoints.length - 1 ? (
                  <Text style={[styles.chartXAxisLabel, { left: point.x - 18, top: paddingTop + plotHeight + 8 }]}>{point.label}</Text>
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const GoogleSignInButton = ({ onSuccess }: { onSuccess: (token: string) => Promise<void> }) => {
  const { t } = useTranslation();
  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  });

  React.useEffect(() => {
    const idToken = response?.type === "success" ? response.params.id_token : undefined;

    if (idToken) {
      void onSuccess(idToken);
    }
  }, [onSuccess, response]);

  return <ActionButton label={t("googleSignIn")} tone="secondary" onPress={() => void promptAsync()} />;
};

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());
const isValidReminderTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());

const splitFullName = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ")
  };
};

const capitalizeNameInput = (value: string) =>
  value.replace(/(^|\s|-)([a-zA-ZçğıöşüÇĞİÖŞÜ])/g, (match, prefix: string, character: string) => `${prefix}${character.toLocaleUpperCase("tr-TR")}`);
const isStrongPassword = (value: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);

const formatDateLabel = (value: string, language: "tr" | "en") =>
  new Date(value).toLocaleDateString(language === "en" ? "en-US" : "tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
const formatShortDateLabel = (value: string, language: "tr" | "en") =>
  new Date(value).toLocaleDateString(language === "en" ? "en-US" : "tr-TR", {
    day: "2-digit",
    month: "2-digit"
  });
const formatTimeLabel = (value: string, language: "tr" | "en") =>
  new Date(value).toLocaleTimeString(language === "en" ? "en-US" : "tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  });
const timeInputValue = (value: string) =>
  new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
const localDayKey = (value: string) => {
  const date = new Date(value);

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};
const phaseTwoRangeDays = (range: PhaseTwoChartRange) => (range === "week" ? 7 : range === "month" ? 30 : 1);
const toneColor = (tone?: "safe" | "warning" | "danger" | null) => {
  if (tone === "safe") {
    return palette.success;
  }

  if (tone === "warning") {
    return palette.orange;
  }

  if (tone === "danger") {
    return palette.warning;
  }

  return palette.accent;
};

const mergeDateWithCurrentTime = (currentIso: string, selectedDate: Date) => {
  const currentDate = new Date(currentIso);
  const nextDate = new Date(selectedDate);

  nextDate.setHours(
    currentDate.getHours(),
    currentDate.getMinutes(),
    currentDate.getSeconds(),
    currentDate.getMilliseconds()
  );

  return nextDate.toISOString();
};

const clampDateToToday = (value: Date) => {
  const today = new Date();
  const safeDate = new Date(value);

  if (safeDate.getTime() > today.getTime()) {
    return today;
  }

  return safeDate;
};

const startOfDay = (value: Date) => {
  const nextDate = new Date(value);

  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
};

const endOfDay = (value: Date) => {
  const nextDate = new Date(value);

  nextDate.setHours(23, 59, 59, 999);

  return nextDate;
};

const addDays = (value: Date, days: number) => {
  const nextDate = new Date(value);

  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
};

const phaseTwoChartRangeButtons = (
  t: (key: string) => string
): Array<{ value: PhaseTwoChartRange; label: string }> => [
  { value: "day", label: t("chartDay") },
  { value: "week", label: t("chartWeek") },
  { value: "month", label: t("chartMonth") }
];

const activityChartRangeButtons = (
  t: (key: string) => string
): Array<{ value: ActivityChartRange; label: string }> => [
  { value: "week", label: t("chartWeek") },
  { value: "month", label: t("chartMonth") },
  { value: "quarter", label: t("chartQuarter") }
];

const activityRangeDays = (range: ActivityChartRange) => (range === "week" ? 7 : range === "month" ? 30 : 90);

const phaseTwoChartMeta = (range: PhaseTwoChartRange, language: "tr" | "en", referenceDateIso: string) => {
  if (range === "day") {
    return formatDateLabel(referenceDateIso, language);
  }

  const rangeDays = phaseTwoRangeDays(range);

  return `${formatDateLabel(addDays(new Date(referenceDateIso), -(rangeDays - 1)).toISOString(), language)} - ${formatDateLabel(referenceDateIso, language)}`;
};

const activityChartMeta = (range: ActivityChartRange, language: "tr" | "en", referenceDateIso: string) =>
  `${formatDateLabel(addDays(new Date(referenceDateIso), -(activityRangeDays(range) - 1)).toISOString(), language)} - ${formatDateLabel(referenceDateIso, language)}`;

const phaseTwoChartTitle = (
  range: PhaseTwoChartRange,
  titles: { day: string; week: string; month: string }
) => (range === "day" ? titles.day : range === "week" ? titles.week : titles.month);

const activityChartTitle = (
  range: ActivityChartRange,
  titles: { week: string; month: string; quarter: string }
) => (range === "week" ? titles.week : range === "month" ? titles.month : titles.quarter);

const buildRangeAnchors = (referenceDate: Date, rangeDays: number) =>
  Array.from({ length: rangeDays }, (_, index) => addDays(referenceDate, -(rangeDays - 1) + index));

const numberTicks = (maxValue: number, segments = 4) => {
  const safeMax = Math.max(maxValue, 1);
  const step = Math.max(1, Math.ceil(safeMax / segments));
  const ticks = Array.from({ length: segments + 1 }, (_, index) => index * step);
  const lastTick = ticks[ticks.length - 1] ?? step;

  if (lastTick < safeMax) {
    ticks.push(lastTick + step);
  }

  return ticks;
};

const ChartRangeTabs = <T extends string,>({
  options,
  value,
  onChange
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) => (
  <View style={styles.metricTabRow}>
    {options.map((item) => (
      <Pressable key={item.value} onPress={() => onChange(item.value)} style={[styles.metricTabButton, value === item.value && styles.metricTabButtonActive]}>
        <Text style={[styles.metricTabText, value === item.value && styles.metricTabTextActive]}>{item.label}</Text>
      </Pressable>
    ))}
  </View>
);

const calculateBmi = (heightCm?: number | null, weightKg?: number | null) => {
  if (!heightCm || !weightKg) {
    return null;
  }

  const heightMeters = heightCm / 100;

  return (weightKg / (heightMeters * heightMeters)).toFixed(1);
};
const bmiToneForValue = (value?: string | null): ChartTone | null => {
  if (!value) {
    return null;
  }

  const numericValue = Number.parseFloat(value.replace(",", "."));

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  if (numericValue < 18.5) {
    return "warning";
  }

  if (numericValue <= 24.9) {
    return "safe";
  }

  if (numericValue <= 29.9) {
    return "warning";
  }

  return "danger";
};
const bmiToneForWeight = (heightCm: number | null | undefined, weightKg: number | null) =>
  heightCm && weightKg ? bmiToneForValue(calculateBmi(heightCm, weightKg)) : null;

const parseBloodPressureValue = (value: string) => {
  const match = value.match(/(\d+)\s*\/\s*(\d+).*?(\d+)/);

  return {
    systolic: match?.[1] ? Number(match[1]) : undefined,
    diastolic: match?.[2] ? Number(match[2]) : undefined,
    pulse: match?.[3] ? Number(match[3]) : undefined
  };
};

type ProfileFormValues = {
  language: "tr" | "en";
  gender: "male" | "female";
  diabetesProfile: "type1" | "type2" | "gestational";
  fullName: string;
  heightCm: number;
  weightKg: number;
};

const SignInScreen = () => {
  const { t } = useTranslation();
  const { signInWithEmail, signUpWithEmail, signInWithGoogleToken, signInWithAppleToken, refresh, applyProfile, applyPreferences } = useSession();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isRegisterMode, setIsRegisterMode] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [language, setLanguage] = React.useState<"tr" | "en">("tr");
  const [gender, setGender] = React.useState<"male" | "female">("female");
  const [diabetesProfile, setDiabetesProfile] = React.useState<"type1" | "type2" | "gestational">("type2");
  const [heightCm, setHeightCm] = React.useState("170");
  const [weightKg, setWeightKg] = React.useState("70");
  const [notificationPermission, setNotificationPermission] = React.useState(false);
  const [healthPermissionApproved, setHealthPermissionApproved] = React.useState(false);
  const [acceptsDisclaimer, setAcceptsDisclaimer] = React.useState(false);
  const hasGoogleAuthConfig = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  );

  const ensureBaseFields = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t("missingFieldsTitle"), t("missingFieldsMessage"));
      return false;
    }

    if (!isValidEmail(email)) {
      Alert.alert(t("invalidEmailTitle"), t("invalidEmailMessage"));
      return false;
    }

    return true;
  };

  const buildProfileValues = (): ProfileFormValues | null => {
    const parsed = profileSettingsFormSchema.safeParse({
      language,
      gender,
      diabetesProfile,
      fullName,
      heightCm,
      weightKg
    });

    if (!parsed.success) {
      Alert.alert(t("missingFieldsTitle"), `${t("fullName")}, ${t("heightCm")}, ${t("weightKg")}`);
      return null;
    }

    return parsed.data;
  };

  const handleEmailSignIn = async () => {
    if (!ensureBaseFields()) {
      return;
    }

    try {
      await signInWithEmail(email.trim(), password);
    } catch {
      Alert.alert(t("signInFailedTitle"), t("signInFailedMessage"));
    }
  };

  const handleEmailSignUp = async () => {
    if (!ensureBaseFields()) {
      return;
    }

    if (!isStrongPassword(password)) {
      Alert.alert(t("passwordPolicyTitle"), t("passwordPolicyMessage"));
      return;
    }

    if (!confirmPassword.trim() || password !== confirmPassword) {
      Alert.alert(t("passwordMismatchTitle"), t("passwordMismatchMessage"));
      return;
    }

    const profileValues = buildProfileValues();

    if (!profileValues) {
      return;
    }

    if (!acceptsDisclaimer) {
      Alert.alert(t("formInvalidTitle"), t("disclaimerRequiredMessage"));
      return;
    }

    try {
      await signUpWithEmail(email.trim(), password);
      const profile = await saveProfileRemote({
        ...profileValues,
        onboardingCompleted: true,
        disclaimerAcceptedAt: new Date().toISOString()
      });
      const preferences = await saveReminderPreferencesRemote({
        ...defaultPreferences,
        healthPermissionApproved
      });
      await applyProfile(profile);
      await applyPreferences(preferences);
      if (notificationPermission) {
        await ensureNotificationPermission(true).catch(() => false);
      }
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (message.toLowerCase().includes("already exists")) {
        Alert.alert(t("accountExistsTitle"), t("accountExistsMessage"));
        return;
      }

      Alert.alert(t("signUpFailedTitle"), t("signUpFailedMessage"));
    }
  };

  const handleApple = async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME
      ]
    });

    if (credential.identityToken) {
      await signInWithAppleToken(credential.identityToken);
    }
  };

  return (
    <FormScreen>
        <BrandLogo />
        <Text style={styles.subtitle}>{t("subtitle")}</Text>
        <FormField label={t("email")} value={email} onChangeText={setEmail} keyboardType="email-address" />
        {isRegisterMode ? (
          <>
            <FormField label={t("fullName")} value={fullName} onChangeText={(value) => setFullName(capitalizeNameInput(value))} />
            <FormField label={t("password")} value={password} onChangeText={setPassword} secureTextEntry />
            <FormField label={t("confirmPassword")} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
            <View style={styles.card}>
              <Text style={styles.label}>{t("language")}</Text>
              <View style={styles.inline}>
                <View style={styles.flexItem}>
                  <ActionButton label={t("turkish")} tone={language === "tr" ? "primary" : "secondary"} onPress={() => setLanguage("tr")} />
                </View>
                <View style={styles.flexItem}>
                  <ActionButton label={t("english")} tone={language === "en" ? "primary" : "secondary"} onPress={() => setLanguage("en")} />
                </View>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>{t("gender")}</Text>
              <View style={styles.inline}>
                {["female", "male"].map((value) => (
                  <View key={value} style={styles.flexItem}>
                    <ActionButton
                      label={labelForGender(value as "male" | "female")}
                      tone={gender === value ? "primary" : "secondary"}
                      onPress={() => {
                        setGender(value as "male" | "female");
                        if (value === "male" && diabetesProfile === "gestational") {
                          setDiabetesProfile("type2");
                        }
                      }}
                    />
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>{t("diabetesType")}</Text>
              <View style={styles.stackSm}>
                {profileOptionsForGender(gender).map((value) => (
                  <ActionButton
                    key={value}
                    label={labelForProfileType(value as "type1" | "type2" | "gestational")}
                    tone={diabetesProfile === value ? "primary" : "secondary"}
                    onPress={() => setDiabetesProfile(value as "type1" | "type2" | "gestational")}
                  />
                ))}
              </View>
            </View>
            <FormField label={t("heightCm")} value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" />
            <FormField label={t("weightKg")} value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" />
            <View style={styles.card}>
              <Text style={styles.label}>{t("permissions")}</Text>
              <View style={styles.stackSm}>
                <ToggleField
                  label={t("notificationPermissionTitle")}
                  checked={notificationPermission}
                  onPress={() => setNotificationPermission((current) => !current)}
                />
                <Text style={styles.subtitle}>{t("remindersManualActivation")}</Text>
                <ToggleField
                  label={t("healthPermissionApproved")}
                  checked={healthPermissionApproved}
                  onPress={() => setHealthPermissionApproved((current) => !current)}
                />
              </View>
            </View>
            <ToggleField label={t("disclaimer")} checked={acceptsDisclaimer} onPress={() => setAcceptsDisclaimer((current) => !current)} />
            <ActionButton label={t("createAccount")} onPress={() => void handleEmailSignUp()} />
            <ActionButton
              label={t("backToSignIn")}
              tone="secondary"
              onPress={() => {
                setIsRegisterMode(false);
                setConfirmPassword("");
                setAcceptsDisclaimer(false);
              }}
            />
          </>
        ) : (
          <>
            <FormField label={t("password")} value={password} onChangeText={setPassword} secureTextEntry />
            <ActionButton label={t("emailSignIn")} onPress={() => void handleEmailSignIn()} />
            <ActionButton label={t("emailSignUp")} tone="secondary" onPress={() => setIsRegisterMode(true)} />
          </>
        )}
        {!devAuthBypass && hasGoogleAuthConfig ? <GoogleSignInButton onSuccess={signInWithGoogleToken} /> : null}
        {!devAuthBypass ? <ActionButton label={t("appleSignIn")} tone="secondary" onPress={() => void handleApple()} /> : null}
    </FormScreen>
  );
};

const HomeScreen = () => {
  const { t } = useTranslation();
  const { state, logout } = useSession();
  const language = currentLanguage();
  const glucoseQuery = useQuery({
    queryKey: ["glucose"],
    queryFn: async () => listGlucoseEntries()
  });
  const todayIso = new Date().toISOString();
  const todayGlucosePoints = [...(glucoseQuery.data ?? [])]
    .filter((item) => localDayKey(item.measuredAt) === localDayKey(todayIso))
    .sort((left, right) => new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime())
    .map((item) => ({
      id: item.id,
      label: formatTimeLabel(item.measuredAt, language),
      value: item.valueMgDl,
      tone: glucoseToneForValue(item.valueMgDl)
    }));

  return (
    <MainScreenLayout>
      <View>
        <View style={styles.row}>
          <View style={styles.homeHeaderContent}>
            <Image source={brandImages.get(diaHealthLogo)} style={styles.homeBrandLogo} contentFit="contain" cachePolicy="memory-disk" transition={0} accessibilityLabel="DiaHealth" />
          </View>
          <ActionButton label={t("signOut")} tone="danger" onPress={() => void logout()} />
        </View>
        <Text style={[styles.homeHeaderText, styles.homeWelcome]}>
          {t("welcome")} {splitFullName(state.profile?.fullName?.trim() || state.firebaseUser?.displayName || "").firstName}
        </Text>
        <Text style={[styles.homeHeaderText, styles.homeDiabetesType]}>{labelForProfileType((state.profile?.diabetesProfile ?? "type2") as "type1" | "type2" | "gestational")}</Text>
      </View>
      <LineChart
        sectionTitle={t("glucoseChart")}
        sectionMeta={formatDateLabel(todayIso, language)}
        points={todayGlucosePoints}
        yTicks={[50, 100, 150, 200, 250]}
      />
    </MainScreenLayout>
  );
};

const SugarTrackingScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const language = currentLanguage();
  const [selectedGlucoseChartDate, setSelectedGlucoseChartDate] = React.useState(new Date().toISOString());
  const [glucoseChartRange, setGlucoseChartRange] = React.useState<GlucoseChartRange>("day");
  const [showDailyChartCalendar, setShowDailyChartCalendar] = React.useState(false);
  const glucoseQuery = useQuery({
    queryKey: ["glucose"],
    queryFn: async () => listGlucoseEntries()
  });
  const metricQuery = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => listMetricEntries()
  });
  const glucoseRecords = [...(glucoseQuery.data ?? [])].sort((left, right) => new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime());
  const chartDate = clampDateToToday(new Date(selectedGlucoseChartDate));
  const chartDateIso = chartDate.toISOString();
  const glucoseChartRangeButtons: Array<{ value: GlucoseChartRange; label: string }> = [
    { value: "day", label: t("chartDay") },
    { value: "week", label: t("chartWeek") },
    { value: "month", label: t("chartMonth") },
    { value: "quarter", label: t("chartQuarter") }
  ];
  const glucoseChartPoints = React.useMemo(() => {
    if (glucoseChartRange === "day") {
      return glucoseRecords
        .filter((item) => localDayKey(item.measuredAt) === localDayKey(chartDateIso))
        .map((item) => ({
          id: item.id,
          label: formatTimeLabel(item.measuredAt, language),
          value: item.valueMgDl,
          tone: glucoseToneForValue(item.valueMgDl)
        }));
    }

    const rangeDays = glucoseChartRange === "week" ? 7 : glucoseChartRange === "month" ? 30 : 90;
    const rangeStart = startOfDay(addDays(chartDate, -(rangeDays - 1)));
    const rangeEnd = endOfDay(chartDate);
    const groupedRecords = new Map<string, GlucoseEntry[]>();

    glucoseRecords.forEach((item) => {
      const measuredAt = new Date(item.measuredAt);

      if (measuredAt < rangeStart || measuredAt > rangeEnd) {
        return;
      }

      const dayKey = localDayKey(item.measuredAt);
      const currentItems = groupedRecords.get(dayKey) ?? [];

      currentItems.push(item);
      groupedRecords.set(dayKey, currentItems);
    });

    return Array.from(groupedRecords.values())
      .sort((left, right) => new Date(left[0].measuredAt).getTime() - new Date(right[0].measuredAt).getTime())
      .map((items, index) => {
        const averageValue = Math.round(items.reduce((total, item) => total + item.valueMgDl, 0) / items.length);
        const anchorDate = items[items.length - 1]?.measuredAt ?? `${rangeStart.toISOString()}-${index}`;

        return {
          id: `${localDayKey(anchorDate)}-${index}`,
          label: formatShortDateLabel(anchorDate, language),
          value: averageValue,
          tone: glucoseToneForValue(averageValue)
        };
      });
  }, [chartDate, chartDateIso, glucoseChartRange, glucoseRecords, language]);
  const glucoseRangeDays = glucoseChartRange === "week" ? 7 : glucoseChartRange === "month" ? 30 : 90;
  const glucoseChartMeta =
    glucoseChartRange === "day"
      ? formatDateLabel(chartDateIso, language)
      : `${formatDateLabel(addDays(chartDate, -(glucoseRangeDays - 1)).toISOString(), language)} - ${formatDateLabel(chartDateIso, language)}`;
  const glucoseChartLabelStep = glucoseChartRange === "month" ? 5 : glucoseChartRange === "quarter" ? 10 : 1;
  const glucoseChartTitle =
    glucoseChartRange === "day"
      ? t("glucoseChartDayTitle")
      : glucoseChartRange === "week"
        ? t("glucoseChartWeekTitle")
        : glucoseChartRange === "month"
          ? t("glucoseChartMonthTitle")
          : t("glucoseChartQuarterTitle");
  const hba1cChartPoints = [...(metricQuery.data ?? [])]
    .filter((item) => item.metricType === "hba1c")
    .sort((left, right) => new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime())
    .map((item) => ({
      id: item.id,
      label: formatDateLabel(item.measuredAt, language).slice(0, 5),
      value: Number.parseFloat(item.value.replace(",", ".")),
      tone: hba1cToneForValue(item.value)
    }));

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("sugarTracking")} onBack={() => navigation.navigate("Home")} />
      <View style={styles.inline}>
        <View style={styles.flexItem}>
          <ActionButton label={t("glucoseList")} onPress={() => navigation.navigate("AddGlucose")} />
        </View>
        <View style={styles.flexItem}>
          <ActionButton label={t("hba1c")} onPress={() => navigation.navigate("Hba1cList")} />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{glucoseChartTitle}</Text>
        <View style={styles.metricTabRow}>
          {glucoseChartRangeButtons.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => {
                setGlucoseChartRange(item.value);
                setShowDailyChartCalendar(item.value === "day");
              }}
              style={[styles.metricTabButton, glucoseChartRange === item.value && styles.metricTabButtonActive]}
            >
              <Text style={[styles.metricTabText, glucoseChartRange === item.value && styles.metricTabTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {glucoseChartRange === "day" && showDailyChartCalendar ? (
          <View style={styles.field}>
            <Text style={styles.label}>{t("selectedDate")}</Text>
            <View style={[styles.datePickerCard, styles.chartDatePickerCard]}>
              <DateTimePicker
                value={chartDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "calendar"}
                locale={language === "tr" ? "tr-TR" : "en-US"}
                accentColor={palette.accent}
                themeVariant={currentThemeMode()}
                maximumDate={new Date()}
                style={styles.chartDatePicker}
                onChange={(event, nextDate) => {
                  if (!nextDate || event.type === "dismissed") {
                    return;
                  }

                  setSelectedGlucoseChartDate(clampDateToToday(nextDate).toISOString());
                }}
              />
            </View>
          </View>
        ) : null}
      </View>
      <LineChart
        sectionTitle={glucoseChartTitle}
        sectionMeta={glucoseChartMeta}
        points={glucoseChartPoints}
        yTicks={[50, 100, 150, 200, 250]}
        xLabelEvery={glucoseChartLabelStep}
      />
      <LineChart sectionTitle={t("hba1cChart")} points={hba1cChartPoints} yTicks={[4, 6, 8, 10, 12]} />
    </MainScreenLayout>
  );
};

const Hba1cListScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const language = currentLanguage();
  const queryClientValue = useQueryClient();
  const metricQuery = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => listMetricEntries()
  });
  const hba1cRecords = React.useMemo(
    () =>
      [...(metricQuery.data ?? [])]
        .filter((item) => item.metricType === "hba1c")
        .sort((left, right) => new Date(right.measuredAt).getTime() - new Date(left.measuredAt).getTime()),
    [metricQuery.data]
  );
  const deleteMetricMutation = useMutation({
    mutationFn: async (entry: HealthMetricEntry) => {
      deleteMetricLocally(entry);
      await queryClientValue.invalidateQueries({ queryKey: ["metrics"] });
    }
  });

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("hba1cRecords")} onBack={() => navigation.navigate("SugarTracking")} />
      <ActionButton label={t("addValue")} onPress={() => navigation.navigate("AddMetric", { metricType: "hba1c", lockMetricType: true })} />
      <View style={styles.card}>
        <FlatList
          data={hba1cRecords}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.listBody}>
                <Text style={[styles.listTitle, { color: toneColor(hba1cToneForValue(item.value)) }]}>{formatHba1cValue(item.value)}</Text>
                <Text style={styles.listMeta}>{formatDateLabel(item.measuredAt, language)}</Text>
                {item.note ? <Text style={styles.listNote}>{item.note}</Text> : null}
              </View>
              <View style={styles.listActions}>
                <Pressable
                  onPress={() => navigation.navigate("AddMetric", { entry: item, metricType: "hba1c", lockMetricType: true })}
                  style={styles.editListButton}
                >
                  <Text style={styles.editListButtonText}>{t("edit")}</Text>
                </Pressable>
                <Pressable onPress={() => deleteMetricMutation.mutate(item)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>{t("delete")}</Text>
                </Pressable>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      </View>
    </MainScreenLayout>
  );
};

const HealthValuesScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("healthValues")} onBack={() => navigation.navigate("Home")} />
      <View style={styles.stackSm}>
        <ActionButton label={t("weight")} onPress={() => navigation.navigate("WeightList")} />
        <ActionButton label={t("blood_pressure")} onPress={() => navigation.navigate("BloodPressureList")} />
        <ActionButton label={t("activity")} onPress={() => navigation.navigate("ActivityList")} />
        <ActionButton label={t("medication")} onPress={() => navigation.navigate("MedicationList")} />
        <ActionButton label={t("emergencyCard")} tone="danger" onPress={() => navigation.navigate("EmergencyCard")} />
      </View>
    </MainScreenLayout>
  );
};

const WeightListScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const language = currentLanguage();
  const { state, applyProfile } = useSession();
  const queryClientValue = useQueryClient();
  const metricQuery = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => listMetricEntries()
  });
  const weightRecords = React.useMemo(
    () =>
      [...(metricQuery.data ?? [])]
        .filter((item) => item.metricType === "weight")
        .sort((left, right) => new Date(right.measuredAt).getTime() - new Date(left.measuredAt).getTime()),
    [metricQuery.data]
  );
  const weightChartPoints = React.useMemo(
    () =>
      [...weightRecords]
        .sort((left, right) => new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime())
        .map((item) => {
          const value = parseWeightValue(item.value) ?? 0;

          return {
            id: item.id,
            label: formatShortDateLabel(item.measuredAt, language),
            value,
            tone: bmiToneForWeight(state.profile?.heightCm, value)
          };
        }),
    [language, state.profile?.heightCm, weightRecords]
  );
  const weightChartTitle = t("weightChartTitle");
  const deleteMetricMutation = useMutation({
    mutationFn: async (entry: HealthMetricEntry) => {
      deleteMetricLocally(entry);
      await syncProfileWeightFromLatestMetric(state.profile, applyProfile);
      await queryClientValue.invalidateQueries({ queryKey: ["metrics"] });
    }
  });

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("weight")} onBack={() => navigation.navigate("HealthValues")} />
      <ActionButton label={t("addWeight")} onPress={() => navigation.navigate("AddMetric", { metricType: "weight", lockMetricType: true })} />
      <LineChart
        sectionTitle={weightChartTitle}
        points={weightChartPoints}
        yTicks={numberTicks(Math.max(...weightChartPoints.map((item) => item.value), 0))}
      />
      <View style={styles.card}>
        <FlatList
          data={weightRecords}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.listBody}>
                <Text style={styles.listTitle}>{formatWeightValue(item.value)}</Text>
                <Text style={styles.listMeta}>{formatDateLabel(item.measuredAt, language)}</Text>
                {item.note ? <Text style={styles.listNote}>{item.note}</Text> : null}
              </View>
              <View style={styles.listActions}>
                <Pressable
                  onPress={() => navigation.navigate("AddMetric", { entry: item, metricType: "weight", lockMetricType: true })}
                  style={styles.editListButton}
                >
                  <Text style={styles.editListButtonText}>{t("edit")}</Text>
                </Pressable>
                <Pressable onPress={() => deleteMetricMutation.mutate(item)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>{t("delete")}</Text>
                </Pressable>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      </View>
    </MainScreenLayout>
  );
};

const BloodPressureListScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const queryClientValue = useQueryClient();
  const metricQuery = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => listMetricEntries()
  });
  const bloodPressureRecords = (metricQuery.data ?? []).filter((item) => item.metricType === "blood_pressure");
  const deleteMetricMutation = useMutation({
    mutationFn: async (entry: HealthMetricEntry) => {
      deleteMetricLocally(entry);
      await queryClientValue.invalidateQueries({ queryKey: ["metrics"] });
    }
  });

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("blood_pressure")} onBack={() => navigation.navigate("HealthValues")} />
      <ActionButton
        label={t("addMetric")}
        onPress={() => navigation.navigate("AddMetric", { metricType: "blood_pressure", lockMetricType: true })}
      />
      <View style={styles.card}>
        <FlatList
          data={bloodPressureRecords}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.listBody}>
                <Text style={styles.listTitle}>{item.value}</Text>
                <Text style={styles.listMeta}>{new Date(item.measuredAt).toLocaleString()}</Text>
                {item.note ? <Text style={styles.listNote}>{item.note}</Text> : null}
              </View>
              <View style={styles.listActions}>
                <Pressable
                  onPress={() => navigation.navigate("AddMetric", { entry: item, metricType: "blood_pressure", lockMetricType: true })}
                  style={styles.editListButton}
                >
                  <Text style={styles.editListButtonText}>{t("edit")}</Text>
                </Pressable>
                <Pressable onPress={() => deleteMetricMutation.mutate(item)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>{t("delete")}</Text>
                </Pressable>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      </View>
    </MainScreenLayout>
  );
};

const HydrationListScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const language = currentLanguage();
  const [chartRange, setChartRange] = React.useState<PhaseTwoChartRange>("day");
  const queryClientValue = useQueryClient();
  const hydrationQuery = useQuery({
    queryKey: ["hydration"],
    queryFn: async () => listHydrationEntries()
  });
  const hydrationRecords = React.useMemo(() => hydrationQuery.data ?? [], [hydrationQuery.data]);
  const chartOptions = phaseTwoChartRangeButtons(t);
  const referenceDateIso = new Date().toISOString();
  const hydrationChartPoints = React.useMemo(() => {
    if (chartRange === "day") {
      return [...hydrationRecords]
        .filter((item) => localDayKey(item.measuredAt) === localDayKey(referenceDateIso))
        .sort((left, right) => new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime())
        .map((item) => ({
          id: item.id,
          label: formatTimeLabel(item.measuredAt, language),
          value: item.amountMl,
          tone: "safe" as const
        }));
    }

    const rangeDays = phaseTwoRangeDays(chartRange);
    const referenceDate = new Date(referenceDateIso);
    const rangeStart = startOfDay(addDays(referenceDate, -(rangeDays - 1)));
    const rangeEnd = endOfDay(referenceDate);

    return buildRangeAnchors(referenceDate, rangeDays).map((anchorDate, index) => {
      const total = hydrationRecords
        .filter((item) => {
          const measuredAt = new Date(item.measuredAt);
          return measuredAt >= rangeStart && measuredAt <= rangeEnd && localDayKey(item.measuredAt) === localDayKey(anchorDate.toISOString());
        })
        .reduce((sum, item) => sum + item.amountMl, 0);

      return {
        id: `${localDayKey(anchorDate.toISOString())}-${index}`,
        label: formatShortDateLabel(anchorDate.toISOString(), language),
        value: total,
        tone: total >= 2000 ? ("safe" as const) : total > 0 ? ("warning" as const) : ("danger" as const)
      };
    });
  }, [chartRange, hydrationRecords, language, referenceDateIso]);
  const hydrationChartTitle = phaseTwoChartTitle(chartRange, {
    day: t("hydrationChartDayTitle"),
    week: t("hydrationChartWeekTitle"),
    month: t("hydrationChartMonthTitle")
  });
  const deleteHydrationMutation = useMutation({
    mutationFn: async (entry: HydrationEntry) => {
      deleteHydrationLocally(entry);
      await queryClientValue.invalidateQueries({ queryKey: ["hydration"] });
    }
  });

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("water")} onBack={() => navigation.navigate("HealthValues")} />
      <ActionButton label={t("addHydration")} onPress={() => navigation.navigate("AddHydration")} />
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{hydrationChartTitle}</Text>
        <ChartRangeTabs options={chartOptions} value={chartRange} onChange={setChartRange} />
      </View>
      <LineChart
        sectionTitle={hydrationChartTitle}
        sectionMeta={phaseTwoChartMeta(chartRange, language, referenceDateIso)}
        points={hydrationChartPoints}
        yTicks={numberTicks(Math.max(...hydrationChartPoints.map((item) => item.value), 0))}
        xLabelEvery={chartRange === "month" ? 5 : 1}
      />
      <View style={styles.card}>
        <FlatList
          data={hydrationRecords}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.listBody}>
                <Text style={styles.listTitle}>{item.amountMl} mL</Text>
                <Text style={styles.listMeta}>{new Date(item.measuredAt).toLocaleString()}</Text>
                {item.note ? <Text style={styles.listNote}>{item.note}</Text> : null}
              </View>
              <View style={styles.listActions}>
                <Pressable onPress={() => navigation.navigate("AddHydration", { entry: item })} style={styles.editListButton}>
                  <Text style={styles.editListButtonText}>{t("edit")}</Text>
                </Pressable>
                <Pressable onPress={() => deleteHydrationMutation.mutate(item)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>{t("delete")}</Text>
                </Pressable>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      </View>
    </MainScreenLayout>
  );
};

const MealListScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const language = currentLanguage();
  const [chartRange, setChartRange] = React.useState<PhaseTwoChartRange>("day");
  const queryClientValue = useQueryClient();
  const mealQuery = useQuery({
    queryKey: ["meals"],
    queryFn: async () => listMealEntries()
  });
  const hydrationQuery = useQuery({
    queryKey: ["hydration"],
    queryFn: async () => listHydrationEntries()
  });
  const mealRecords = React.useMemo(() => mealQuery.data ?? [], [mealQuery.data]);
  const hydrationRecords = React.useMemo(() => hydrationQuery.data ?? [], [hydrationQuery.data]);
  const chartOptions = phaseTwoChartRangeButtons(t);
  const referenceDateIso = new Date().toISOString();
  const mealChartPoints = React.useMemo(() => {
    if (chartRange === "day") {
      return [...mealRecords]
        .filter((item) => localDayKey(item.measuredAt) === localDayKey(referenceDateIso))
        .sort((left, right) => new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime())
        .map((item) => ({
          id: item.id,
          label: formatTimeLabel(item.measuredAt, language),
          value: item.carbohydrateGrams,
          tone: null
        }));
    }

    const rangeDays = phaseTwoRangeDays(chartRange);
    const referenceDate = new Date(referenceDateIso);
    const rangeStart = startOfDay(addDays(referenceDate, -(rangeDays - 1)));
    const rangeEnd = endOfDay(referenceDate);

    return buildRangeAnchors(referenceDate, rangeDays).map((anchorDate, index) => {
      const totalCarbs = mealRecords
        .filter((item) => {
          const measuredAt = new Date(item.measuredAt);
          return measuredAt >= rangeStart && measuredAt <= rangeEnd && localDayKey(item.measuredAt) === localDayKey(anchorDate.toISOString());
        })
        .reduce((sum, item) => sum + item.carbohydrateGrams, 0);

      return {
        id: `${localDayKey(anchorDate.toISOString())}-${index}`,
        label: formatShortDateLabel(anchorDate.toISOString(), language),
        value: totalCarbs,
        tone: null
      };
    });
  }, [chartRange, language, mealRecords, referenceDateIso]);
  const mealChartTitle = phaseTwoChartTitle(chartRange, {
    day: t("mealChartDayTitle"),
    week: t("mealChartWeekTitle"),
    month: t("mealChartMonthTitle")
  });
  const deleteMealMutation = useMutation({
    mutationFn: async (entry: MealEntry) => {
      deleteMealLocally(entry);
      await queryClientValue.invalidateQueries({ queryKey: ["meals"] });
    }
  });
  const deleteHydrationMutation = useMutation({
    mutationFn: async (entry: HydrationEntry) => {
      deleteHydrationLocally(entry);
      await queryClientValue.invalidateQueries({ queryKey: ["hydration"] });
    }
  });
  const todayMeals = mealRecords.filter((item) => localDayKey(item.measuredAt) === localDayKey(referenceDateIso));
  const todayHydration = hydrationRecords.filter((item) => localDayKey(item.measuredAt) === localDayKey(referenceDateIso));
  const nutritionSummary = [
    {
      label: t("calories"),
      value: `${todayMeals.reduce((sum, item) => sum + item.calories, 0)} kcal`
    },
    {
      label: t("carbohydrateGrams"),
      value: `${todayMeals.reduce((sum, item) => sum + item.carbohydrateGrams, 0).toFixed(1)} g`
    },
    {
      label: t("water"),
      value: `${todayHydration.reduce((sum, item) => sum + item.amountMl, 0)} mL`
    },
    {
      label: t("macroProtein"),
      value: `${todayMeals.reduce((sum, item) => {
        const matchedFood = foodCatalog.find((food) => food.name === item.mealName);

        if (!matchedFood || matchedFood.carbohydrateGrams <= 0) {
          return sum;
        }

        return sum + matchedFood.proteinGrams * (item.carbohydrateGrams / matchedFood.carbohydrateGrams);
      }, 0).toFixed(1)} g`
    }
  ];

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("nutrition")} onBack={() => navigation.navigate("HealthValues")} />
      <View style={styles.nutritionHero}>
        <Text style={styles.nutritionHeroTitle}>{t("nutritionSummary")}</Text>
        <Text style={styles.nutritionHeroText}>{formatDateLabel(referenceDateIso, language)}</Text>
        <View style={styles.nutritionSummaryGrid}>
          {nutritionSummary.map((item) => (
            <View key={item.label} style={styles.nutritionSummaryCard}>
              <Text style={styles.nutritionSummaryValue}>{item.value}</Text>
              <Text style={styles.nutritionSummaryLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.inline}>
        <View style={styles.flexItem}>
          <ActionButton label={t("addMeal")} onPress={() => navigation.navigate("AddMeal")} />
        </View>
        <View style={styles.flexItem}>
          <ActionButton label={t("addHydration")} tone="secondary" onPress={() => navigation.navigate("AddHydration")} />
        </View>
      </View>
      <View style={styles.contentActionGrid}>
        <Pressable onPress={() => navigation.navigate("RecipeList")} style={styles.contentActionCard}>
          <Text style={styles.contentActionIcon}>🍽</Text>
          <Text style={styles.contentActionTitle}>{t("recipes")}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("GuideList")} style={styles.contentActionCard}>
          <Text style={styles.contentActionIcon}>✚</Text>
          <Text style={styles.contentActionTitle}>{t("guides")}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("ReportScreen")} style={styles.contentActionCard}>
          <Text style={styles.contentActionIcon}>PDF</Text>
          <Text style={styles.contentActionTitle}>{t("reports")}</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{mealChartTitle}</Text>
        <ChartRangeTabs options={chartOptions} value={chartRange} onChange={setChartRange} />
      </View>
      <LineChart
        sectionTitle={mealChartTitle}
        sectionMeta={phaseTwoChartMeta(chartRange, language, referenceDateIso)}
        points={mealChartPoints}
        yTicks={numberTicks(Math.max(...mealChartPoints.map((item) => item.value), 0))}
        xLabelEvery={chartRange === "month" ? 5 : 1}
      />
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("water")}</Text>
        <FlatList
          data={hydrationRecords}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.listBody}>
                <Text style={styles.listTitle}>{item.amountMl} mL</Text>
                <Text style={styles.listMeta}>{formatDateLabel(item.measuredAt, language)}</Text>
                {item.note ? <Text style={styles.listNote}>{item.note}</Text> : null}
              </View>
              <View style={styles.listActions}>
                <Pressable onPress={() => navigation.navigate("AddHydration", { entry: item })} style={styles.editListButton}>
                  <Text style={styles.editListButtonText}>{t("edit")}</Text>
                </Pressable>
                <Pressable onPress={() => deleteHydrationMutation.mutate(item)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>{t("delete")}</Text>
                </Pressable>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("meals")}</Text>
        <FlatList
          data={mealRecords}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.listBody}>
                <Text style={styles.listTitle}>{item.mealName}</Text>
                <Text style={styles.listMeta}>
                  {labelForMealType(item.mealType)} • {item.carbohydrateGrams} g • {item.calories} kcal
                </Text>
                <Text style={styles.listMeta}>{formatDateLabel(item.measuredAt, language)}</Text>
                {item.note ? <Text style={styles.listNote}>{item.note}</Text> : null}
              </View>
              <View style={styles.listActions}>
                <Pressable onPress={() => navigation.navigate("AddMeal", { entry: item })} style={styles.editListButton}>
                  <Text style={styles.editListButtonText}>{t("edit")}</Text>
                </Pressable>
                <Pressable onPress={() => deleteMealMutation.mutate(item)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>{t("delete")}</Text>
                </Pressable>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      </View>
    </MainScreenLayout>
  );
};

const RecipeListScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = React.useState<RecipeCategory | "all">("all");
  const categories: Array<{ value: RecipeCategory | "all"; label: string }> = [
    { value: "all", label: t("allMeals") },
    { value: "breakfast", label: labelForMealType("breakfast") },
    { value: "lunch", label: labelForMealType("lunch") },
    { value: "dinner", label: labelForMealType("dinner") },
    { value: "snack", label: labelForMealType("snack") }
  ];
  const recipes = selectedCategory === "all" ? recipeContent : recipeContent.filter((item) => item.category === selectedCategory);

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("recipes")} onBack={() => navigation.navigate("MealList")} />
      <View style={styles.contentHero}>
        <Text style={styles.contentHeroEyebrow}>{t("recipeFilters")}</Text>
        <View style={styles.recipeFilterRow}>
          {categories.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setSelectedCategory(item.value)}
              style={[styles.recipeFilterButton, selectedCategory === item.value && styles.recipeFilterButtonActive]}
            >
              <Text
                style={[styles.recipeFilterText, selectedCategory === item.value && styles.recipeFilterTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {recipes.map((recipe) => (
        <View key={recipe.id} style={styles.recipeCard}>
          <View style={styles.row}>
            <View style={styles.listBody}>
              <Text style={styles.recipeTitle}>{localized(recipe.title)}</Text>
              <Text style={styles.listMeta}>
                {labelForMealType(recipe.category)} • {recipe.prepMinutes} dk
              </Text>
            </View>
            <View style={styles.recipeMacroBadge}>
              <Text style={styles.recipeMacroValue}>{recipe.carbohydrates} g</Text>
              <Text style={styles.recipeMacroLabel}>{t("carbohydrateGrams")}</Text>
            </View>
          </View>
          <View style={styles.foodMacroGrid}>
            <View style={styles.foodMacroPill}>
              <Text style={styles.foodMacroValue}>{recipe.calories} kcal</Text>
              <Text style={styles.foodMacroLabel}>{t("calories")}</Text>
            </View>
            <View style={styles.foodMacroPill}>
              <Text style={styles.foodMacroValue}>{recipe.carbohydrates} g</Text>
              <Text style={styles.foodMacroLabel}>{t("carbohydrateGrams")}</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>{t("ingredients")}</Text>
          {recipe.ingredients.map((item) => (
            <Text key={localized(item)} style={styles.contentBullet}>
              • {localized(item)}
            </Text>
          ))}
          <Text style={styles.sectionTitle}>{t("preparation")}</Text>
          {recipe.steps.map((item, index) => (
            <Text key={localized(item)} style={styles.contentBullet}>
              {index + 1}. {localized(item)}
            </Text>
          ))}
        </View>
      ))}
    </MainScreenLayout>
  );
};

const GuideListScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("guides")} onBack={() => navigation.navigate("MealList")} />
      <View style={styles.contentHero}>
        <Text style={styles.contentHeroEyebrow}>{t("clinicalDisclaimer")}</Text>
        <Text style={styles.contentHeroTitle}>{t("guides")}</Text>
      </View>
      {guideContent.map((guide) => (
        <View key={guide.id} style={styles.guideCard}>
          <Text style={styles.recipeTitle}>{localized(guide.title)}</Text>
          <Text style={styles.listMeta}>{localized(guide.summary)}</Text>
          {guide.steps.map((item, index) => (
            <View key={localized(item)} style={styles.guideStepRow}>
              <Text style={styles.guideStepIndex}>{index + 1}</Text>
              <Text style={styles.guideStepText}>{localized(item)}</Text>
            </View>
          ))}
        </View>
      ))}
    </MainScreenLayout>
  );
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const reportList = (title: string, rows: string[]) => `
  <section>
    <h2>${escapeHtml(title)}</h2>
    <ul>${rows.map((row) => `<li>${escapeHtml(row)}</li>`).join("")}</ul>
  </section>
`;
const glucoseReportColumns = [
  "morning_fasting",
  "morning_postprandial",
  "noon_fasting",
  "noon_postprandial",
  "evening_fasting",
  "evening_postprandial"
] as const;
const glucoseReportColumnLabel = (value: (typeof glucoseReportColumns)[number], language: "tr" | "en") => {
  const periodMap = {
    morning_fasting: language === "tr" ? "Sabah" : "Morning",
    morning_postprandial: language === "tr" ? "Sabah" : "Morning",
    noon_fasting: language === "tr" ? "Öğle" : "Noon",
    noon_postprandial: language === "tr" ? "Öğle" : "Noon",
    evening_fasting: language === "tr" ? "Akşam" : "Evening",
    evening_postprandial: language === "tr" ? "Akşam" : "Evening"
  };
  const stateLabel = value.includes("fasting")
    ? displayTranslations[language].fasting
    : displayTranslations[language].postprandial;

  return `${periodMap[value]} ${stateLabel}`;
};
const buildGlucoseReportTable = (glucose: GlucoseEntry[], language: "tr" | "en", title: string) => {
  const grouped = new Map<string, GlucoseEntry[]>();

  glucose.forEach((entry) => {
    const dayKey = localDayKey(entry.measuredAt);
    const current = grouped.get(dayKey) ?? [];

    current.push(entry);
    grouped.set(dayKey, current);
  });

  const rows = Array.from(grouped.entries())
    .sort(([left], [right]) => (left < right ? 1 : -1))
    .slice(0, 14)
    .map(([dayKey, entries]) => {
      const cells = glucoseReportColumns.map((column) => {
        const entry = entries
          .filter((item) => item.readingType === column)
          .sort((left, right) => new Date(right.measuredAt).getTime() - new Date(left.measuredAt).getTime())[0];

        return `<td>${entry ? `${entry.valueMgDl} mg/dL` : "-"}</td>`;
      });

      return `<tr>${cells.join("")}<td class="date-cell">${escapeHtml(formatDateLabel(new Date(`${dayKey}T12:00:00`).toISOString(), language))}</td></tr>`;
    })
    .join("");

  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead>
          <tr>
            ${glucoseReportColumns.map((column) => `<th>${escapeHtml(glucoseReportColumnLabel(column, language))}</th>`).join("")}
            <th>${language === "tr" ? "Tarih" : "Date"}</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="7">-</td></tr>`}</tbody>
      </table>
    </section>
  `;
};

const buildReportHtml = ({
  profile,
  glucose,
  metrics,
  hydration,
  activities,
  medications,
  language,
  t
}: {
  profile: UserProfile | null;
  glucose: GlucoseEntry[];
  metrics: HealthMetricEntry[];
  hydration: HydrationEntry[];
  activities: ActivityEntry[];
  medications: MedicationEntry[];
  language: "tr" | "en";
  t: (key: string) => string;
}) => {
  const generatedAt = formatDateLabel(new Date().toISOString(), language);
  const averageGlucose = glucose.length
    ? Math.round(glucose.reduce((sum, item) => sum + item.valueMgDl, 0) / glucose.length)
    : 0;
  const totalHydration = hydration.reduce((sum, item) => sum + item.amountMl, 0);
  const totalSteps = activities.reduce((sum, item) => sum + (item.steps ?? 0), 0);

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 28px; color: #142033; }
          header { background: linear-gradient(135deg, #0f7f5c, #35d0a0); color: white; padding: 24px; border-radius: 24px; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          h2 { margin-top: 24px; color: #0f7f5c; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
          .card { border: 1px solid #d5e5df; border-radius: 18px; padding: 14px; background: #f6faf8; }
          .value { font-size: 22px; font-weight: 800; color: #0f7f5c; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
          th { background: #0f7f5c; color: white; padding: 8px; border: 1px solid #d5e5df; }
          td { padding: 8px; border: 1px solid #d5e5df; text-align: center; }
          .date-cell { font-weight: 800; color: #0f7f5c; white-space: nowrap; }
          li { margin-bottom: 8px; }
          footer { margin-top: 32px; color: #65758b; font-size: 12px; }
        </style>
      </head>
      <body>
        <header>
          <h1>DiaHealth ${escapeHtml(t("reports"))}</h1>
          <div>${escapeHtml(profile?.fullName ?? "")}</div>
          <div>${escapeHtml(generatedAt)}</div>
        </header>
        <div class="grid">
          <div class="card"><div>${escapeHtml(t("glucoseAverage"))}</div><div class="value">${averageGlucose || "-"} mg/dL</div></div>
          <div class="card"><div>${escapeHtml(t("totalHydration"))}</div><div class="value">${totalHydration} mL</div></div>
          <div class="card"><div>${escapeHtml(t("totalActivity"))}</div><div class="value">${totalSteps}</div></div>
        </div>
        ${buildGlucoseReportTable(glucose, language, t("glucoseTab"))}
        ${reportList(t("healthValues"), metrics.slice(0, 8).map((item) => `${formatDateLabel(item.measuredAt, language)} - ${labelForMetricType(item.metricType)}: ${item.value}`))}
        ${reportList(t("medications"), medications.slice(0, 8).map((item) => `${formatDateLabel(item.scheduledFor, language)} - ${item.medicationName} ${item.dosage}`))}
        <footer>${escapeHtml(t("clinicalDisclaimer"))}</footer>
      </body>
    </html>
  `;
};

const ReportScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const language = currentLanguage();
  const { state } = useSession();
  const glucose = useQuery({ queryKey: ["glucose"], queryFn: async () => listGlucoseEntries() }).data ?? [];
  const metrics = useQuery({ queryKey: ["metrics"], queryFn: async () => listMetricEntries() }).data ?? [];
  const meals = useQuery({ queryKey: ["meals"], queryFn: async () => listMealEntries() }).data ?? [];
  const hydration = useQuery({ queryKey: ["hydration"], queryFn: async () => listHydrationEntries() }).data ?? [];
  const activities = useQuery({ queryKey: ["activities"], queryFn: async () => listActivityEntries() }).data ?? [];
  const medications = useQuery({ queryKey: ["medications"], queryFn: async () => listMedicationEntries() }).data ?? [];
  const averageGlucose = glucose.length ? Math.round(glucose.reduce((sum, item) => sum + item.valueMgDl, 0) / glucose.length) : 0;
  const totalHydration = hydration.reduce((sum, item) => sum + item.amountMl, 0);
  const totalSteps = activities.reduce((sum, item) => sum + (item.steps ?? 0), 0);
  const reportSummary = [
    { label: t("glucoseAverage"), value: averageGlucose ? `${averageGlucose} mg/dL` : "-" },
    { label: t("totalMeals"), value: String(meals.length) },
    { label: t("totalHydration"), value: `${totalHydration} mL` },
    { label: t("totalActivity"), value: String(totalSteps) }
  ];
  const handleGenerateReport = async () => {
    try {
      const html = buildReportHtml({
        profile: state.profile,
        glucose,
        metrics,
        hydration,
        activities,
        medications,
        language,
        t
      });
      const file = await Print.printToFileAsync({ html, base64: false });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/pdf",
          dialogTitle: t("reports")
        });
      }

      Alert.alert(t("reportGeneratedTitle"), t("reportGeneratedMessage"));
    } catch {
      Alert.alert(t("reportFailedTitle"), t("reportFailedMessage"));
    }
  };

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("reports")} onBack={() => navigation.navigate("MealList")} />
      <View style={styles.contentHero}>
        <Text style={styles.contentHeroEyebrow}>{t("clinicalDisclaimer")}</Text>
        <Text style={styles.contentHeroTitle}>{t("reportSummary")}</Text>
      </View>
      <View style={styles.nutritionSummaryGrid}>
        {reportSummary.map((item) => (
          <View key={item.label} style={styles.nutritionSummaryCard}>
            <Text style={styles.nutritionSummaryValue}>{item.value}</Text>
            <Text style={styles.nutritionSummaryLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
      <ActionButton label={t("generatePdfReport")} onPress={() => void handleGenerateReport()} />
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("latestRecords")}</Text>
        {[...glucose.slice(0, 3).map((item) => `${formatDateLabel(item.measuredAt, language)} • ${item.valueMgDl} mg/dL`), ...meals.slice(0, 3).map((item) => `${formatDateLabel(item.measuredAt, language)} • ${item.mealName}`)].map((item) => (
          <Text key={item} style={styles.contentBullet}>
            • {item}
          </Text>
        ))}
      </View>
    </MainScreenLayout>
  );
};

const ActivityListScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const language = currentLanguage();
  const [chartRange, setChartRange] = React.useState<ActivityChartRange>("week");
  const queryClientValue = useQueryClient();
  const activityQuery = useQuery({
    queryKey: ["activities"],
    queryFn: async () => listActivityEntries()
  });
  const activityRecords = React.useMemo(() => activityQuery.data ?? [], [activityQuery.data]);
  const chartOptions = activityChartRangeButtons(t);
  const referenceDateIso = new Date().toISOString();
  const buildActivityPoints = React.useCallback(
    (type: "steps" | "exercise") => {
      const rangeDays = activityRangeDays(chartRange);
      const referenceDate = new Date(referenceDateIso);
      const rangeStart = startOfDay(addDays(referenceDate, -(rangeDays - 1)));
      const rangeEnd = endOfDay(referenceDate);

      return buildRangeAnchors(referenceDate, rangeDays)
        .map((anchorDate, index) => {
          const total = activityRecords
            .filter((item) => {
              const measuredAt = new Date(item.measuredAt);
              return item.activityType === type && measuredAt >= rangeStart && measuredAt <= rangeEnd && localDayKey(item.measuredAt) === localDayKey(anchorDate.toISOString());
            })
            .reduce((sum, item) => sum + (type === "steps" ? item.steps ?? 0 : item.durationMinutes ?? 0), 0);

          return {
            id: `${type}-${localDayKey(anchorDate.toISOString())}-${index}`,
            label: formatShortDateLabel(anchorDate.toISOString(), language),
            value: total,
            tone:
              type === "steps"
                ? null
                : total >= 30
                  ? ("safe" as const)
                  : total >= 10
                    ? ("warning" as const)
                    : ("danger" as const)
          };
        })
        .filter((item) => item.value > 0);
    },
    [activityRecords, chartRange, language, referenceDateIso]
  );
  const stepsChartPoints = React.useMemo(() => buildActivityPoints("steps"), [buildActivityPoints]);
  const exerciseChartPoints = React.useMemo(() => buildActivityPoints("exercise"), [buildActivityPoints]);
  const stepsChartTitle = activityChartTitle(chartRange, {
    week: t("activityStepsChartWeekTitle"),
    month: t("activityStepsChartMonthTitle"),
    quarter: t("activityStepsChartQuarterTitle")
  });
  const exerciseChartTitle = activityChartTitle(chartRange, {
    week: t("activityExerciseChartWeekTitle"),
    month: t("activityExerciseChartMonthTitle"),
    quarter: t("activityExerciseChartQuarterTitle")
  });
  const deleteActivityMutation = useMutation({
    mutationFn: async (entry: ActivityEntry) => {
      deleteActivityLocally(entry);
      await queryClientValue.invalidateQueries({ queryKey: ["activities"] });
    }
  });

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("activities")} onBack={() => navigation.navigate("HealthValues")} />
      <ActionButton label={t("addActivity")} onPress={() => navigation.navigate("AddActivity")} />
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{stepsChartTitle}</Text>
        <ChartRangeTabs options={chartOptions} value={chartRange} onChange={setChartRange} />
      </View>
      <LineChart
        sectionTitle={stepsChartTitle}
        sectionMeta={activityChartMeta(chartRange, language, referenceDateIso)}
        points={stepsChartPoints}
        yTicks={numberTicks(Math.max(...stepsChartPoints.map((item) => item.value), 0))}
        xLabelEvery={chartRange === "month" ? 5 : chartRange === "quarter" ? 10 : 1}
      />
      <LineChart
        sectionTitle={exerciseChartTitle}
        sectionMeta={activityChartMeta(chartRange, language, referenceDateIso)}
        points={exerciseChartPoints}
        yTicks={numberTicks(Math.max(...exerciseChartPoints.map((item) => item.value), 0))}
        xLabelEvery={chartRange === "month" ? 5 : chartRange === "quarter" ? 10 : 1}
      />
      <View style={styles.card}>
        <FlatList
          data={activityRecords}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.listBody}>
                <Text style={styles.listTitle}>{labelForActivityType(item.activityType)}</Text>
                <Text style={styles.listMeta}>
                  {item.activityType === "steps" ? `${item.steps ?? 0} ${t("steps")}` : `${item.durationMinutes ?? 0} ${t("durationMinutes")}`}
                </Text>
                <Text style={styles.listMeta}>{formatDateLabel(item.measuredAt, language)}</Text>
                {item.note ? <Text style={styles.listNote}>{item.note}</Text> : null}
              </View>
              <View style={styles.listActions}>
                <Pressable onPress={() => navigation.navigate("AddActivity", { entry: item })} style={styles.editListButton}>
                  <Text style={styles.editListButtonText}>{t("edit")}</Text>
                </Pressable>
                <Pressable onPress={() => deleteActivityMutation.mutate(item)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>{t("delete")}</Text>
                </Pressable>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      </View>
    </MainScreenLayout>
  );
};

const MedicationListScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const language = currentLanguage();
  const queryClientValue = useQueryClient();
  const medicationQuery = useQuery({
    queryKey: ["medication"],
    queryFn: async () => listMedicationEntries()
  });
  const medicationRecords = React.useMemo(() => medicationQuery.data ?? [], [medicationQuery.data]);
  const deleteMedicationMutation = useMutation({
    mutationFn: async (entry: MedicationEntry) => {
      await deleteMedicationLocallyWithReminder(entry);
      await queryClientValue.invalidateQueries({ queryKey: ["medication"] });
    }
  });

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("medications")} onBack={() => navigation.navigate("HealthValues")} />
      <ActionButton label={t("addMedication")} onPress={() => navigation.navigate("AddMedication")} />
      <View style={styles.card}>
        <FlatList
          data={medicationRecords}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.listBody}>
                <Text style={styles.listTitle}>{item.medicationName}</Text>
                <Text style={styles.listMeta}>
                  {item.dosage} • {labelForMedicationStatus(item.status)}
                </Text>
                <Text style={styles.listMeta}>
                  {formatDateLabel(item.scheduledFor, language)} • {formatTimeLabel(item.scheduledFor, language)}
                </Text>
                {item.takenAt ? (
                  <Text style={styles.listMeta}>
                    {t("takenAt")}: {formatDateLabel(item.takenAt, language)} • {formatTimeLabel(item.takenAt, language)}
                  </Text>
                ) : null}
                {item.note ? <Text style={styles.listNote}>{item.note}</Text> : null}
              </View>
              <View style={styles.listActions}>
                <Pressable onPress={() => navigation.navigate("AddMedication", { entry: item })} style={styles.editListButton}>
                  <Text style={styles.editListButtonText}>{t("edit")}</Text>
                </Pressable>
                <Pressable onPress={() => deleteMedicationMutation.mutate(item)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>{t("delete")}</Text>
                </Pressable>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      </View>
    </MainScreenLayout>
  );
};

const MedicationPlanListScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const queryClientValue = useQueryClient();
  const medicationPlansQuery = useQuery({
    queryKey: ["medication-plans"],
    queryFn: async () => listMedicationPlanEntries()
  });
  const medicationPlans = medicationPlansQuery.data ?? [];
  const deletePlanMutation = useMutation({
    mutationFn: async (entry: MedicationPlanEntry) => {
      await deleteMedicationPlanLocallyWithReminder(entry);
      await queryClientValue.invalidateQueries({ queryKey: ["medication-plans"] });
    }
  });

  return (
    <MainScreenLayout>
      <ScreenHeader title={t("medicationPlans")} onBack={() => navigation.navigate("MedicationList")} />
      <ActionButton label={t("addMedicationPlan")} onPress={() => navigation.navigate("AddMedicationPlan")} />
      <View style={styles.card}>
        <FlatList
          data={medicationPlans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={styles.listBody}>
                <Text style={styles.listTitle}>{item.medicationName}</Text>
                <Text style={styles.listMeta}>
                  {item.dosage} • {item.scheduleTime} • {labelForPlanStatus(item.isActive)}
                </Text>
                {item.note ? <Text style={styles.listNote}>{item.note}</Text> : null}
              </View>
              <View style={styles.listActions}>
                <Pressable onPress={() => navigation.navigate("AddMedicationPlan", { entry: item })} style={styles.editListButton}>
                  <Text style={styles.editListButtonText}>{t("edit")}</Text>
                </Pressable>
                <Pressable onPress={() => deletePlanMutation.mutate(item)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>{t("delete")}</Text>
                </Pressable>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      </View>
    </MainScreenLayout>
  );
};

const AddMedicationPlanScreen = ({
  navigation,
  route
}: {
  navigation: AppNavigation;
  route: { params?: { entry?: MedicationPlanEntry } };
}) => {
  const { t } = useTranslation();
  const queryClientValue = useQueryClient();
  const editingEntry = route.params?.entry;
  const form = useForm<{
    medicationName: string;
    dosage: string;
    scheduleTime: string;
    isActive: boolean;
    note?: string;
  }>({
    resolver: zodResolver(medicationPlanFormSchema),
    defaultValues: {
      medicationName: editingEntry?.medicationName ?? "",
      dosage: editingEntry?.dosage ?? "",
      scheduleTime: editingEntry?.scheduleTime ?? timeInputValue(new Date().toISOString()),
      isActive: editingEntry?.isActive ?? true,
      note: editingEntry?.note ?? ""
    }
  });

  return (
    <FormScreen>
      <ScreenHeader title={editingEntry ? t("edit") : t("addMedicationPlan")} onBack={navigation.goBack} />
      <Controller
        control={form.control}
        name="medicationName"
        render={({ field }) => <FormField label={t("medicationName")} value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="dosage"
        render={({ field }) => <FormField label={t("dosage")} value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="scheduleTime"
        render={({ field }) => <FormField label={t("scheduleTime")} value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="isActive"
        render={({ field }) => (
          <View style={styles.inline}>
            <View style={styles.flexItem}>
              <ActionButton label={t("active")} tone={field.value ? "primary" : "secondary"} onPress={() => field.onChange(true)} />
            </View>
            <View style={styles.flexItem}>
              <ActionButton label={t("inactive")} tone={!field.value ? "primary" : "secondary"} onPress={() => field.onChange(false)} />
            </View>
          </View>
        )}
      />
      <Controller
        control={form.control}
        name="note"
        render={({ field }) => <FormField label={t("note")} value={field.value ?? ""} onChangeText={field.onChange} />}
      />
      <ActionButton
        label={t("continue")}
        onPress={form.handleSubmit(async (values) => {
          let notificationScheduled = true;

          if (editingEntry) {
            const nextEntry = createMedicationPlanEntry(values);
            notificationScheduled = await updateMedicationPlanLocallyWithReminder({
              ...editingEntry,
              medicationName: nextEntry.medicationName,
              dosage: nextEntry.dosage,
              scheduleTime: nextEntry.scheduleTime,
              isActive: nextEntry.isActive,
              note: nextEntry.note ?? null,
              deletedAt: null
            });
          } else {
            notificationScheduled = await saveMedicationPlanLocallyWithReminder(createMedicationPlanEntry(values));
          }

          if (!notificationScheduled) {
            Alert.alert(t("notificationPermissionTitle"), t("notificationPermissionMessage"));
          }

          await queryClientValue.invalidateQueries({ queryKey: ["medication-plans"] });
          navigation.goBack();
        })}
      />
    </FormScreen>
  );
};

const AddMealScreen = ({
  navigation,
  route
}: {
  navigation: AppNavigation;
  route: { params?: { entry?: MealEntry } };
}) => {
  const { t } = useTranslation();
  const queryClientValue = useQueryClient();
  const editingEntry = route.params?.entry;
  const form = useForm<{
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    mealName: string;
    carbohydrateGrams: number;
    calories: number;
    measuredAt: string;
    note?: string;
  }>({
    resolver: zodResolver(mealFormSchema),
    defaultValues: {
      mealType: editingEntry?.mealType ?? "breakfast",
      mealName: editingEntry?.mealName ?? "",
      carbohydrateGrams: editingEntry?.carbohydrateGrams ?? 0,
      calories: editingEntry?.calories ?? 0,
      measuredAt: editingEntry?.measuredAt ?? new Date().toISOString(),
      note: editingEntry?.note ?? ""
    }
  });
  const initialFood = React.useMemo(
    () =>
      editingEntry
        ? foodCatalog.find(
            (item) =>
              item.name === editingEntry.mealName &&
              item.calories === editingEntry.calories &&
              item.carbohydrateGrams === editingEntry.carbohydrateGrams
          ) ?? null
        : null,
    [editingEntry]
  );
  const [foodSearch, setFoodSearch] = React.useState(editingEntry?.mealName ?? "");
  const [selectedFood, setSelectedFood] = React.useState<FoodCatalogItem | null>(initialFood);
  const [portionAmount, setPortionAmount] = React.useState(deriveInitialPortionAmount(initialFood, editingEntry));
  const deferredFoodSearch = React.useDeferredValue(foodSearch);
  const selectedFoodNutrition = React.useMemo(
    () => (selectedFood ? calculateFoodNutrition(selectedFood, portionAmount) : null),
    [portionAmount, selectedFood]
  );
  const filteredFoodCatalog = React.useMemo(() => {
    const normalizedSearch = normalizeSearchText(deferredFoodSearch);

    if (!normalizedSearch) {
      return foodCatalog.slice(0, 12);
    }

    return foodCatalog
      .filter((item) => normalizeSearchText(item.name).includes(normalizedSearch))
      .slice(0, 12);
  }, [deferredFoodSearch]);
  const handleFoodSelect = (food: FoodCatalogItem) => {
    const defaultAmount = formatPortionInput(food.portionAmount);
    const nutrition = calculateFoodNutrition(food, defaultAmount);

    setSelectedFood(food);
    setFoodSearch(food.name);
    setPortionAmount(defaultAmount);
    form.setValue("mealName", food.name, { shouldValidate: true });
    form.setValue("carbohydrateGrams", nutrition.carbohydrateGrams, { shouldValidate: true });
    form.setValue("calories", nutrition.calories, { shouldValidate: true });
  };
  const handlePortionAmountChange = (value: string) => {
    setPortionAmount(value);

    if (!selectedFood) {
      return;
    }

    const nutrition = calculateFoodNutrition(selectedFood, value);
    form.setValue("carbohydrateGrams", nutrition.carbohydrateGrams, { shouldValidate: true });
    form.setValue("calories", nutrition.calories, { shouldValidate: true });
  };

  return (
    <FormScreen>
      <ScreenHeader title={editingEntry ? t("edit") : t("addMeal")} onBack={navigation.goBack} />
      <View style={styles.foodSearchCard}>
        <Text style={styles.sectionTitle}>{t("foodSearch")}</Text>
        <FormField label={t("foodCatalog")} value={foodSearch} onChangeText={setFoodSearch} />
        <FlatList
          data={filteredFoodCatalog}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const active = selectedFood?.id === item.id;

            return (
              <Pressable onPress={() => handleFoodSelect(item)} style={[styles.foodResultCard, active && styles.foodResultCardActive]}>
                <View style={styles.listBody}>
                  <Text style={styles.foodResultTitle}>{item.name}</Text>
                  <Text style={styles.listMeta}>
                    {formatFoodPortion(item)} • {item.carbohydrateGrams} g • {item.calories} kcal
                  </Text>
                  <Text style={styles.listMeta}>
                    {t("macroProtein")}: {item.proteinGrams} g • {t("macroFat")}: {item.fatGrams} g • {t("macroFiber")}: {item.fiberGrams} g
                  </Text>
                </View>
                <Text style={styles.editListButtonText}>{t("chooseFood")}</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.listMeta}>{t("noFoodResults")}</Text>}
          scrollEnabled={false}
        />
      </View>
      {selectedFood ? (
        <View style={styles.selectedFoodCard}>
          <Text style={styles.sectionTitle}>{t("selectedFood")}</Text>
          <Text style={styles.listTitle}>{selectedFood.name}</Text>
          <FormField
            label={`${t("consumedAmount")} (${selectedFood.portionUnit})`}
            value={portionAmount}
            onChangeText={handlePortionAmountChange}
            keyboardType="decimal-pad"
          />
          <Text style={styles.sectionTitle}>{t("calculatedNutrition")}</Text>
          <View style={styles.foodMacroGrid}>
            <View style={styles.foodMacroPill}>
              <Text style={styles.foodMacroValue}>
                {formatPortionInput(selectedFoodNutrition?.consumedAmount ?? selectedFood.portionAmount)} {selectedFood.portionUnit}
              </Text>
              <Text style={styles.foodMacroLabel}>{t("foodPortion")}</Text>
            </View>
            <View style={styles.foodMacroPill}>
              <Text style={styles.foodMacroValue}>{selectedFoodNutrition?.carbohydrateGrams ?? selectedFood.carbohydrateGrams} g</Text>
              <Text style={styles.foodMacroLabel}>{t("carbohydrateGrams")}</Text>
            </View>
            <View style={styles.foodMacroPill}>
              <Text style={styles.foodMacroValue}>{selectedFoodNutrition?.calories ?? selectedFood.calories} kcal</Text>
              <Text style={styles.foodMacroLabel}>{t("calories")}</Text>
            </View>
          </View>
          <Text style={styles.listMeta}>
            {t("macroProtein")}: {selectedFoodNutrition?.proteinGrams ?? selectedFood.proteinGrams} g • {t("macroFat")}:{" "}
            {selectedFoodNutrition?.fatGrams ?? selectedFood.fatGrams} g • {t("macroFiber")}:{" "}
            {selectedFoodNutrition?.fiberGrams ?? selectedFood.fiberGrams} g
          </Text>
        </View>
      ) : null}
      <Controller
        control={form.control}
        name="mealType"
        render={({ field }) => (
          <View style={styles.stackSm}>
            {(["breakfast", "lunch", "dinner", "snack"] as const).map((value) => (
              <ActionButton
                key={value}
                label={labelForMealType(value)}
                tone={field.value === value ? "primary" : "secondary"}
                onPress={() => field.onChange(value)}
              />
            ))}
          </View>
        )}
      />
      <Controller
        control={form.control}
        name="measuredAt"
        render={({ field }) => <DateField label={t("measurementDate")} value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="note"
        render={({ field }) => <FormField label={t("note")} value={field.value ?? ""} onChangeText={field.onChange} />}
      />
      <ActionButton
        label={t("continue")}
        onPress={form.handleSubmit(async (values) => {
          if (editingEntry) {
            const nextEntry = createMealEntry(values);
            updateMealLocally({
              ...editingEntry,
              mealType: nextEntry.mealType,
              mealName: nextEntry.mealName,
              carbohydrateGrams: nextEntry.carbohydrateGrams,
              calories: nextEntry.calories,
              measuredAt: nextEntry.measuredAt,
              note: nextEntry.note ?? null,
              deletedAt: null
            });
          } else {
            saveMealLocally(createMealEntry(values));
          }

          await queryClientValue.invalidateQueries({ queryKey: ["meals"] });
          navigation.goBack();
        })}
      />
    </FormScreen>
  );
};

const AddActivityScreen = ({
  navigation,
  route
}: {
  navigation: AppNavigation;
  route: { params?: { entry?: ActivityEntry } };
}) => {
  const { t } = useTranslation();
  const queryClientValue = useQueryClient();
  const editingEntry = route.params?.entry;
  const form = useForm<{
    activityType: "steps" | "exercise";
    steps?: number | null;
    durationMinutes?: number | null;
    measuredAt: string;
    note?: string;
  }>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      activityType: editingEntry?.activityType ?? "steps",
      steps: editingEntry?.steps ?? undefined,
      durationMinutes: editingEntry?.durationMinutes ?? undefined,
      measuredAt: editingEntry?.measuredAt ?? new Date().toISOString(),
      note: editingEntry?.note ?? ""
    }
  });
  const activityType = form.watch("activityType");

  return (
    <FormScreen>
      <ScreenHeader title={editingEntry ? t("edit") : t("addActivity")} onBack={navigation.goBack} />
      <Controller
        control={form.control}
        name="activityType"
        render={({ field }) => (
          <View style={styles.stackSm}>
            {(["steps", "exercise"] as const).map((value) => (
              <ActionButton
                key={value}
                label={labelForActivityType(value)}
                tone={field.value === value ? "primary" : "secondary"}
                onPress={() => {
                  field.onChange(value);
                  form.setValue("steps", value === "steps" ? form.getValues("steps") ?? undefined : null);
                  form.setValue("durationMinutes", value === "exercise" ? form.getValues("durationMinutes") ?? undefined : null);
                }}
              />
            ))}
          </View>
        )}
      />
      {activityType === "steps" ? (
        <Controller
          control={form.control}
          name="steps"
          render={({ field }) => (
            <FormField label={t("steps")} value={field.value ? String(field.value) : ""} onChangeText={(value) => field.onChange(value ? Number(value) : undefined)} keyboardType="numeric" />
          )}
        />
      ) : (
        <Controller
          control={form.control}
          name="durationMinutes"
          render={({ field }) => (
            <FormField
              label={t("durationMinutes")}
              value={field.value ? String(field.value) : ""}
              onChangeText={(value) => field.onChange(value ? Number(value) : undefined)}
              keyboardType="numeric"
            />
          )}
        />
      )}
      <Controller
        control={form.control}
        name="measuredAt"
        render={({ field }) => <DateField label={t("measurementDate")} value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="note"
        render={({ field }) => <FormField label={t("note")} value={field.value ?? ""} onChangeText={field.onChange} />}
      />
      <ActionButton
        label={t("continue")}
        onPress={form.handleSubmit(async (values) => {
          if (editingEntry) {
            const nextEntry = createActivityEntry(values);
            updateActivityLocally({
              ...editingEntry,
              activityType: nextEntry.activityType,
              steps: nextEntry.steps ?? null,
              durationMinutes: nextEntry.durationMinutes ?? null,
              measuredAt: nextEntry.measuredAt,
              note: nextEntry.note ?? null,
              deletedAt: null
            });
          } else {
            saveActivityLocally(createActivityEntry(values));
          }

          await queryClientValue.invalidateQueries({ queryKey: ["activities"] });
          navigation.goBack();
        })}
      />
    </FormScreen>
  );
};

const AddMedicationScreen = ({
  navigation,
  route
}: {
  navigation: AppNavigation;
  route: { params?: { entry?: MedicationEntry } };
}) => {
  const { t } = useTranslation();
  const queryClientValue = useQueryClient();
  const editingEntry = route.params?.entry;
  const form = useForm<{
    medicationName: string;
    dosage: string;
    scheduledFor: string;
    status: "scheduled" | "taken" | "skipped";
    takenAt?: string | null;
    note?: string;
  }>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: {
      medicationName: editingEntry?.medicationName ?? "",
      dosage: editingEntry?.dosage ?? "",
      scheduledFor: editingEntry?.scheduledFor ?? new Date().toISOString(),
      status: editingEntry?.status ?? "scheduled",
      takenAt: editingEntry?.takenAt ?? null,
      note: editingEntry?.note ?? ""
    }
  });
  const status = form.watch("status");

  return (
    <FormScreen>
      <ScreenHeader title={editingEntry ? t("edit") : t("addMedication")} onBack={navigation.goBack} />
      <Controller
        control={form.control}
        name="medicationName"
        render={({ field }) => <FormField label={t("medicationName")} value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="dosage"
        render={({ field }) => <FormField label={t("dosage")} value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="status"
        render={({ field }) => (
          <View style={styles.stackSm}>
            {(["scheduled", "taken", "skipped"] as const).map((value) => (
              <ActionButton
                key={value}
                label={labelForMedicationStatus(value)}
                tone={field.value === value ? "primary" : "secondary"}
                onPress={() => {
                  field.onChange(value);

                  if (value === "scheduled") {
                    form.setValue("takenAt", null);
                    if (new Date(form.getValues("scheduledFor")).getTime() < Date.now()) {
                      form.setValue("scheduledFor", new Date().toISOString());
                    }
                  } else if (value === "taken") {
                    form.setValue("takenAt", new Date().toISOString());
                  } else {
                    form.setValue("takenAt", null);
                    if (new Date(form.getValues("scheduledFor")).getTime() > Date.now()) {
                      form.setValue("scheduledFor", new Date().toISOString());
                    }
                  }
                }}
              />
            ))}
          </View>
        )}
      />
      {status === "taken" ? (
        <Controller
          control={form.control}
          name="takenAt"
          render={({ field }) => <DateTimeField label={t("takenAt")} value={field.value ?? new Date().toISOString()} onChange={field.onChange} />}
        />
      ) : (
        <Controller
          control={form.control}
          name="scheduledFor"
          render={({ field }) => <DateTimeField label={status === "skipped" ? t("skippedAt") : t("scheduledFor")} value={field.value} onChange={field.onChange} />}
        />
      )}
      <Controller
        control={form.control}
        name="note"
        render={({ field }) => <FormField label={t("note")} value={field.value ?? ""} onChangeText={field.onChange} />}
      />
      <ActionButton
        label={t("continue")}
        onPress={form.handleSubmit(async (values) => {
          let notificationScheduled = true;
          const submittedValues = {
            ...values,
            scheduledFor: values.status === "taken" ? values.takenAt ?? new Date().toISOString() : values.scheduledFor,
            takenAt: values.status === "taken" ? values.takenAt ?? new Date().toISOString() : null
          };

          if (editingEntry) {
            const nextEntry = createMedicationEntry(submittedValues);
            notificationScheduled = await updateMedicationLocallyWithReminder({
              ...editingEntry,
              medicationName: nextEntry.medicationName,
              dosage: nextEntry.dosage,
              scheduledFor: nextEntry.scheduledFor,
              status: nextEntry.status,
              takenAt: nextEntry.takenAt ?? null,
              note: nextEntry.note ?? null,
              deletedAt: null
            });
          } else {
            notificationScheduled = await saveMedicationLocallyWithReminder(createMedicationEntry(submittedValues));
          }

          if (!notificationScheduled) {
            Alert.alert(t("notificationPermissionTitle"), t("notificationPermissionMessage"));
          }

          await queryClientValue.invalidateQueries({ queryKey: ["medication"] });
          navigation.goBack();
        }, () => Alert.alert(t("formInvalidTitle"), t("formInvalidMessage")))}
      />
    </FormScreen>
  );
};

const AddHydrationScreen = ({
  navigation,
  route
}: {
  navigation: AppNavigation;
  route: { params?: { entry?: HydrationEntry } };
}) => {
  const { t } = useTranslation();
  const queryClientValue = useQueryClient();
  const editingEntry = route.params?.entry;
  const form = useForm<{
    amountMl: number;
    measuredAt: string;
    note?: string;
  }>({
    resolver: zodResolver(hydrationFormSchema),
    defaultValues: {
      amountMl: editingEntry?.amountMl ?? 250,
      measuredAt: editingEntry?.measuredAt ?? new Date().toISOString(),
      note: editingEntry?.note ?? ""
    }
  });

  return (
    <FormScreen>
      <ScreenHeader title={editingEntry ? t("edit") : t("addHydration")} onBack={navigation.goBack} />
      <Controller
        control={form.control}
        name="amountMl"
        render={({ field }) => (
          <FormField label={t("amountMl")} value={String(field.value ?? "")} onChangeText={(value) => field.onChange(Number(value) || 0)} keyboardType="numeric" />
        )}
      />
      <Controller
        control={form.control}
        name="measuredAt"
        render={({ field }) => <DateField label={t("measurementDate")} value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="note"
        render={({ field }) => <FormField label={t("note")} value={field.value ?? ""} onChangeText={field.onChange} />}
      />
      <ActionButton
        label={t("continue")}
        onPress={form.handleSubmit(async (values) => {
          if (editingEntry) {
            const nextEntry = createHydrationEntry(values);
            updateHydrationLocally({
              ...editingEntry,
              amountMl: nextEntry.amountMl,
              measuredAt: nextEntry.measuredAt,
              note: nextEntry.note ?? null,
              deletedAt: null
            });
          } else {
            saveHydrationLocally(createHydrationEntry(values));
          }

          await queryClientValue.invalidateQueries({ queryKey: ["hydration"] });
          navigation.goBack();
        })}
      />
    </FormScreen>
  );
};

const EmergencyCardScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const emergencyCardQuery = useQuery({
    queryKey: ["emergency-card"],
    queryFn: loadEmergencyCard
  });
  const form = useForm<EmergencyCard>({
    resolver: zodResolver(emergencyCardSchema),
    defaultValues: {
      contactName: "",
      contactPhone: "",
      relationship: "",
      medicalNotes: ""
    }
  });
  const watchedPhone = form.watch("contactPhone");
  const saveMutation = useMutation({
    mutationFn: saveEmergencyCard,
    onSuccess: (card) => {
      form.reset(card);
      Alert.alert(t("emergencyCardSavedTitle"), t("emergencyCardSavedMessage"));
      void queryClient.invalidateQueries({ queryKey: ["emergency-card"] });
    }
  });

  React.useEffect(() => {
    if (emergencyCardQuery.data) {
      form.reset(emergencyCardQuery.data);
    }
  }, [emergencyCardQuery.data, form]);

  const handleCall = () => {
    const phone = watchedPhone?.replace(/[^0-9+]/g, "") ?? "";

    if (!phone) {
      Alert.alert(t("emergencyContactMissingTitle"), t("emergencyContactMissingMessage"));
      return;
    }

    void Linking.openURL(`tel:${phone}`);
  };

  return (
    <FormScreen>
      <ScreenHeader title={t("emergencyCard")} onBack={navigation.goBack} />
      <Controller
        control={form.control}
        name="contactName"
        render={({ field }) => <FormField label={t("emergencyContactName")} value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="contactPhone"
        render={({ field }) => (
          <FormField label={t("emergencyContactPhone")} value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" />
        )}
      />
      <Controller
        control={form.control}
        name="relationship"
        render={({ field }) => <FormField label={t("relationship")} value={field.value ?? ""} onChangeText={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="medicalNotes"
        render={({ field }) => <FormField label={t("medicalNotes")} value={field.value ?? ""} onChangeText={field.onChange} />}
      />
      <ActionButton label={t("save")} onPress={form.handleSubmit((values) => saveMutation.mutate(values))} />
      <ActionButton label={t("callEmergencyContact")} tone="danger" onPress={handleCall} />
    </FormScreen>
  );
};

const ProfileScreen = ({ navigation }: { navigation: AppNavigation }) => {
  const { t } = useTranslation();
  const { state, refresh, applyProfile, applyPreferences, applyTheme, deleteAccount } = useSession();
  const [isEditing, setIsEditing] = React.useState(false);
  const initialName = splitFullName(state.profile?.fullName ?? "");
  const form = useForm<{
    firstName: string;
    lastName: string;
    language: "tr" | "en";
    gender: "male" | "female";
    diabetesProfile: "type1" | "type2" | "gestational";
    heightCm: number;
    weightKg: number;
    measurementReminders: boolean;
    medicationReminders: boolean;
    hydrationReminders: boolean;
    activityReminders: boolean;
    measurementReminderTime: string;
    hydrationReminderTime: string;
    activityReminderTime: string;
    healthPermissionApproved: boolean;
  }>({
    defaultValues: {
      language: (state.profile?.language ?? "tr") as "tr" | "en",
      gender: (state.profile?.gender ?? "female") as "male" | "female",
      diabetesProfile: (state.profile?.diabetesProfile ?? "type2") as "type1" | "type2" | "gestational",
      firstName: initialName.firstName,
      lastName: initialName.lastName,
      heightCm: state.profile?.heightCm ?? 170,
      weightKg: state.profile?.weightKg ?? 70,
      measurementReminders: state.preferences.measurementReminders,
      medicationReminders: state.preferences.medicationReminders,
      hydrationReminders: state.preferences.hydrationReminders,
      activityReminders: state.preferences.activityReminders,
      measurementReminderTime: state.preferences.measurementReminderTime,
      hydrationReminderTime: state.preferences.hydrationReminderTime,
      activityReminderTime: state.preferences.activityReminderTime,
      healthPermissionApproved: state.preferences.healthPermissionApproved
    }
  });

  React.useEffect(() => {
    const nextName = splitFullName(state.profile?.fullName ?? "");
    form.reset({
      language: (state.profile?.language ?? "tr") as "tr" | "en",
      gender: (state.profile?.gender ?? "female") as "male" | "female",
      diabetesProfile: (state.profile?.diabetesProfile ?? "type2") as "type1" | "type2" | "gestational",
      firstName: nextName.firstName,
      lastName: nextName.lastName,
      heightCm: state.profile?.heightCm ?? 170,
      weightKg: state.profile?.weightKg ?? 70,
      measurementReminders: state.preferences.measurementReminders,
      medicationReminders: state.preferences.medicationReminders,
      hydrationReminders: state.preferences.hydrationReminders,
      activityReminders: state.preferences.activityReminders,
      measurementReminderTime: state.preferences.measurementReminderTime,
      hydrationReminderTime: state.preferences.hydrationReminderTime,
      activityReminderTime: state.preferences.activityReminderTime,
      healthPermissionApproved: state.preferences.healthPermissionApproved
    });
  }, [
    form,
    state.preferences.activityReminderTime,
    state.preferences.activityReminders,
    state.preferences.healthPermissionApproved,
    state.preferences.hydrationReminderTime,
    state.preferences.hydrationReminders,
    state.preferences.measurementReminderTime,
    state.preferences.measurementReminders,
    state.preferences.medicationReminders,
    state.profile
  ]);

  const saveMutation = useMutation({
    mutationFn: async (values: {
      firstName: string;
      lastName: string;
      language: "tr" | "en";
      gender: "male" | "female";
      diabetesProfile: "type1" | "type2" | "gestational";
      heightCm: number;
      weightKg: number;
      measurementReminders: boolean;
      medicationReminders: boolean;
      hydrationReminders: boolean;
      activityReminders: boolean;
      measurementReminderTime: string;
      hydrationReminderTime: string;
      activityReminderTime: string;
      healthPermissionApproved: boolean;
    }) => {
      const parsed = profileSettingsFormSchema.parse({
        language: values.language,
        gender: values.gender,
        diabetesProfile: values.diabetesProfile,
        fullName: `${values.firstName} ${values.lastName}`.trim(),
        heightCm: values.heightCm,
        weightKg: values.weightKg
      });

      if (
        !isValidReminderTime(values.measurementReminderTime) ||
        !isValidReminderTime(values.hydrationReminderTime) ||
        !isValidReminderTime(values.activityReminderTime)
      ) {
        throw new Error("Invalid reminder time");
      }

      const now = new Date().toISOString();
      const profilePayload = {
        ...parsed,
        onboardingCompleted: state.profile?.onboardingCompleted ?? true,
        disclaimerAcceptedAt: state.profile?.disclaimerAcceptedAt ?? new Date().toISOString()
      };
      const nextProfile: UserProfile = {
        id: state.profile?.id,
        userId: state.profile?.userId,
        ...profilePayload,
        createdAt: state.profile?.createdAt ?? now,
        updatedAt: now
      };
      const nextPreferences = {
        measurementReminders: values.measurementReminders,
        medicationReminders: values.medicationReminders,
        hydrationReminders: values.hydrationReminders,
        activityReminders: values.activityReminders,
        measurementReminderTime: values.measurementReminderTime,
        hydrationReminderTime: values.hydrationReminderTime,
        activityReminderTime: values.activityReminderTime,
        healthPermissionApproved: values.healthPermissionApproved
      };

      await applyProfile(nextProfile);
      await applyPreferences(nextPreferences);
      queueSync(createSyncRecord("profile", "update", nextProfile.id ?? "profile", profilePayload));

      try {
        const profile = await saveProfileRemote(profilePayload);
        const preferences = await saveReminderPreferencesRemote(nextPreferences);
        await applyProfile(profile);
        await applyPreferences(preferences);
        await refresh();
      } catch {
        // Profile stays saved locally and sync queue will retry later.
      }
    },
    onSuccess: () => {
      setIsEditing(false);
      Alert.alert(t("profileSavedTitle"), t("profileSavedMessage"));
    },
    onError: () => {
      Alert.alert(t("formInvalidTitle"), t("formInvalidMessage"));
    }
  });

  const currentName = splitFullName(state.profile?.fullName ?? "");
  const currentBmi = calculateBmi(state.profile?.heightCm, state.profile?.weightKg);
  const editingBmi = calculateBmi(form.watch("heightCm"), form.watch("weightKg"));
  const currentBmiTone = bmiToneForValue(currentBmi);
  const editingBmiTone = bmiToneForValue(editingBmi);
  const handleCancel = () => {
    form.reset({
      language: (state.profile?.language ?? "tr") as "tr" | "en",
      gender: (state.profile?.gender ?? "female") as "male" | "female",
      diabetesProfile: (state.profile?.diabetesProfile ?? "type2") as "type1" | "type2" | "gestational",
      firstName: currentName.firstName,
      lastName: currentName.lastName,
      heightCm: state.profile?.heightCm ?? 170,
      weightKg: state.profile?.weightKg ?? 70,
      measurementReminders: state.preferences.measurementReminders,
      medicationReminders: state.preferences.medicationReminders,
      hydrationReminders: state.preferences.hydrationReminders,
      activityReminders: state.preferences.activityReminders,
      measurementReminderTime: state.preferences.measurementReminderTime,
      hydrationReminderTime: state.preferences.hydrationReminderTime,
      activityReminderTime: state.preferences.activityReminderTime,
      healthPermissionApproved: state.preferences.healthPermissionApproved
    });
    setIsEditing(false);
  };
  const handleDeleteAccount = () => {
    Alert.alert(t("deleteAccountConfirmTitle"), t("deleteAccountConfirmMessage"), [
      {
        text: t("cancel"),
        style: "cancel"
      },
      {
        text: t("deleteAccount"),
        style: "destructive",
        onPress: () => {
          void deleteAccount().catch(() => {
            Alert.alert(t("deleteAccountFailedTitle"), t("deleteAccountFailedMessage"));
          });
        }
      }
    ]);
  };
  const themeSelector = (
    <View style={styles.card}>
      <Text style={styles.label}>{t("theme")}</Text>
      <View style={styles.inline}>
        <View style={styles.flexItem}>
          <ActionButton
            label={t("darkTheme")}
            tone={state.themeMode === "dark" ? "primary" : "secondary"}
            onPress={() => void applyTheme("dark")}
          />
        </View>
        <View style={styles.flexItem}>
          <ActionButton
            label={t("lightTheme")}
            tone={state.themeMode === "light" ? "primary" : "secondary"}
            onPress={() => void applyTheme("light")}
          />
        </View>
      </View>
    </View>
  );

  return (
    <MainScreenLayout keyboardAware>
        <ScreenHeader title={t("profile")} onBack={() => navigation.navigate("Home")} />
        {isEditing ? (
          <>
            <Controller
              control={form.control}
              name="firstName"
              render={({ field }) => <FormField label={t("firstName")} value={field.value} onChangeText={(value) => field.onChange(capitalizeNameInput(value))} />}
            />
            <Controller
              control={form.control}
              name="lastName"
              render={({ field }) => <FormField label={t("lastName")} value={field.value} onChangeText={(value) => field.onChange(capitalizeNameInput(value))} />}
            />
            <ReadonlyField label={t("email")} value={state.accountEmail ?? "-"} />
            <Controller
              control={form.control}
              name="gender"
              render={({ field }) => (
                <View style={styles.card}>
                  <Text style={styles.label}>{t("gender")}</Text>
                  <View style={styles.inline}>
                    {["female", "male"].map((value) => (
                      <View key={value} style={styles.flexItem}>
                        <ActionButton
                          label={labelForGender(value as "male" | "female")}
                          tone={field.value === value ? "primary" : "secondary"}
                          onPress={() => {
                            field.onChange(value);

                            if (value === "male" && form.getValues("diabetesProfile") === "gestational") {
                              form.setValue("diabetesProfile", "type2");
                            }
                          }}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}
            />
            <Controller
              control={form.control}
              name="diabetesProfile"
              render={({ field }) => (
                <View style={styles.card}>
                  <Text style={styles.label}>{t("diabetesType")}</Text>
                  <View style={styles.stackSm}>
                    {profileOptionsForGender(form.watch("gender")).map((value) => (
                      <ActionButton
                        key={value}
                        label={labelForProfileType(value as "type1" | "type2" | "gestational")}
                        tone={field.value === value ? "primary" : "secondary"}
                        onPress={() => field.onChange(value)}
                      />
                    ))}
                  </View>
                </View>
              )}
            />
            <Controller
              control={form.control}
              name="heightCm"
              render={({ field }) => (
                <FormField label={t("heightCm")} value={String(field.value)} onChangeText={(value) => field.onChange(Number(value))} keyboardType="numeric" />
              )}
            />
            <Controller
              control={form.control}
              name="weightKg"
              render={({ field }) => (
                <FormField label={t("weightKg")} value={String(field.value)} onChangeText={(value) => field.onChange(Number(value))} keyboardType="numeric" />
              )}
            />
            <View style={styles.card}>
              <Text style={styles.label}>{t("permissions")}</Text>
              <View style={styles.stackSm}>
                <Controller
                  control={form.control}
                  name="measurementReminders"
                  render={({ field }) => (
                    <ToggleField label={t("measurementReminders")} checked={field.value} onPress={() => field.onChange(!field.value)} />
                  )}
                />
                {form.watch("measurementReminders") ? (
                  <Controller
                    control={form.control}
                    name="measurementReminderTime"
                    render={({ field }) => <FormField label={`${t("measurementReminders")} ${t("reminderTime")}`} value={field.value} onChangeText={field.onChange} />}
                  />
                ) : null}
                <Controller
                  control={form.control}
                  name="medicationReminders"
                  render={({ field }) => (
                    <ToggleField label={t("medicationReminders")} checked={field.value} onPress={() => field.onChange(!field.value)} />
                  )}
                />
                <Controller
                  control={form.control}
                  name="hydrationReminders"
                  render={({ field }) => (
                    <ToggleField label={t("hydrationReminders")} checked={field.value} onPress={() => field.onChange(!field.value)} />
                  )}
                />
                {form.watch("hydrationReminders") ? (
                  <Controller
                    control={form.control}
                    name="hydrationReminderTime"
                    render={({ field }) => <FormField label={`${t("hydrationReminders")} ${t("reminderTime")}`} value={field.value} onChangeText={field.onChange} />}
                  />
                ) : null}
                <Controller
                  control={form.control}
                  name="activityReminders"
                  render={({ field }) => (
                    <ToggleField label={t("activityReminders")} checked={field.value} onPress={() => field.onChange(!field.value)} />
                  )}
                />
                {form.watch("activityReminders") ? (
                  <Controller
                    control={form.control}
                    name="activityReminderTime"
                    render={({ field }) => <FormField label={`${t("activityReminders")} ${t("reminderTime")}`} value={field.value} onChangeText={field.onChange} />}
                  />
                ) : null}
                <Controller
                  control={form.control}
                  name="healthPermissionApproved"
                  render={({ field }) => (
                    <ToggleField label={t("healthPermissionApproved")} checked={field.value} onPress={() => field.onChange(!field.value)} />
                  )}
                />
              </View>
            </View>
            <ReadonlyField label={t("bmi")} value={editingBmi ?? "-"} tone={editingBmiTone} />
            <Controller
              control={form.control}
              name="language"
              render={({ field }) => (
                <View style={styles.card}>
                  <Text style={styles.label}>{t("language")}</Text>
                  <View style={styles.inline}>
                    <View style={styles.flexItem}>
                      <ActionButton label={t("turkish")} tone={field.value === "tr" ? "primary" : "secondary"} onPress={() => field.onChange("tr")} />
                    </View>
                    <View style={styles.flexItem}>
                      <ActionButton label={t("english")} tone={field.value === "en" ? "primary" : "secondary"} onPress={() => field.onChange("en")} />
                    </View>
                  </View>
                </View>
              )}
            />
            {themeSelector}
            <View style={styles.inline}>
              <View style={styles.flexItem}>
                <ActionButton label={t("cancel")} tone="secondary" onPress={handleCancel} />
              </View>
              <View style={styles.flexItem}>
                <ActionButton
                  label={t("save")}
                  onPress={form.handleSubmit(
                    (values) => saveMutation.mutate(values),
                    () => Alert.alert(t("formInvalidTitle"), t("formInvalidMessage"))
                  )}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <ReadonlyField label={t("firstName")} value={currentName.firstName || "-"} />
            <ReadonlyField label={t("lastName")} value={currentName.lastName || "-"} />
            <ReadonlyField label={t("email")} value={state.accountEmail ?? "-"} />
            <ReadonlyField label={t("gender")} value={state.profile?.gender ? labelForGender(state.profile.gender) : "-"} />
            <ReadonlyField
              label={t("diabetesType")}
              value={labelForProfileType((state.profile?.diabetesProfile ?? "type2") as "type1" | "type2" | "gestational")}
            />
            <ReadonlyField label={t("heightCm")} value={state.profile?.heightCm ? String(state.profile.heightCm) : "-"} />
            <ReadonlyField label={t("weightKg")} value={state.profile?.weightKg ? String(state.profile.weightKg) : "-"} />
            <ReadonlyField
              label={t("measurementReminders")}
              value={state.preferences.measurementReminders ? `${t("enabled")} • ${state.preferences.measurementReminderTime}` : t("disabled")}
            />
            <ReadonlyField
              label={t("medicationReminders")}
              value={state.preferences.medicationReminders ? t("enabled") : t("disabled")}
            />
            <ReadonlyField
              label={t("hydrationReminders")}
              value={state.preferences.hydrationReminders ? `${t("enabled")} • ${state.preferences.hydrationReminderTime}` : t("disabled")}
            />
            <ReadonlyField
              label={t("activityReminders")}
              value={state.preferences.activityReminders ? `${t("enabled")} • ${state.preferences.activityReminderTime}` : t("disabled")}
            />
            <ReadonlyField
              label={t("healthPermissionApproved")}
              value={state.preferences.healthPermissionApproved ? t("enabled") : t("disabled")}
            />
            <ReadonlyField label={t("bmi")} value={currentBmi ?? "-"} tone={currentBmiTone} />
            <ReadonlyField label={t("language")} value={state.profile?.language === "en" ? t("english") : t("turkish")} />
            {themeSelector}
            <ActionButton label={t("edit")} onPress={() => setIsEditing(true)} />
            <ActionButton label={t("deleteAccount")} tone="danger" onPress={handleDeleteAccount} />
          </>
        )}
    </MainScreenLayout>
  );
};

const AddGlucoseScreen = ({
  navigation,
  route
}: {
  navigation: AppNavigation;
  route: { params?: { entry?: GlucoseEntry } };
}) => {
  const { t } = useTranslation();
  const queryClientValue = useQueryClient();
  const language = currentLanguage();
  const [selectedDate, setSelectedDate] = React.useState(route.params?.entry?.measuredAt ?? new Date().toISOString());
  const glucoseQuery = useQuery({
    queryKey: ["glucose"],
    queryFn: async () => listGlucoseEntries()
  });
  const glucoseSections = [
    {
      title: t("morning"),
      options: [
        { value: "morning_fasting" as const, label: shortGlucoseLabel("morning_fasting") },
        { value: "morning_postprandial" as const, label: shortGlucoseLabel("morning_postprandial") }
      ]
    },
    {
      title: t("noon"),
      options: [
        { value: "noon_fasting" as const, label: shortGlucoseLabel("noon_fasting") },
        { value: "noon_postprandial" as const, label: shortGlucoseLabel("noon_postprandial") }
      ]
    },
    {
      title: t("evening"),
      options: [
        { value: "evening_fasting" as const, label: shortGlucoseLabel("evening_fasting") },
        { value: "evening_postprandial" as const, label: shortGlucoseLabel("evening_postprandial") }
      ]
    }
  ];

  const dayEntries = [...(glucoseQuery.data ?? [])]
    .filter((item) => localDayKey(item.measuredAt) === localDayKey(selectedDate))
    .sort((left, right) => new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime());
  const deleteGlucoseMutation = useMutation({
    mutationFn: async (entry: GlucoseEntry) => {
      deleteGlucoseLocally(entry);
      await queryClientValue.invalidateQueries({ queryKey: ["glucose"] });
    }
  });

  return (
    <FormScreen>
      <View style={styles.row}>
        <Text style={styles.title}>{t("glucoseTab")}</Text>
        <View style={styles.inline}>
          <ActionButton label={t("back")} tone="secondary" onPress={() => navigation.navigate("Home")} />
          <ActionButton label={t("addGlucose")} onPress={() => navigation.navigate("GlucoseEntryForm", { measuredAt: selectedDate })} />
        </View>
      </View>
      <View style={styles.datePickerCard}>
        <DateTimePicker
          value={clampDateToToday(new Date(selectedDate))}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "calendar"}
          locale={language === "tr" ? "tr-TR" : "en-US"}
          accentColor={palette.accent}
          themeVariant={currentThemeMode()}
          maximumDate={new Date()}
          onChange={(event, nextDate) => {
            if (!nextDate || event.type === "dismissed") {
              return;
            }

            setSelectedDate(mergeDateWithCurrentTime(selectedDate, clampDateToToday(nextDate)));
          }}
        />
      </View>
      <View style={styles.stackSm}>
        {glucoseSections.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.options.map((option) => {
              const entry = dayEntries.find((item) => item.readingType === option.value);
              const tone = entry ? glucoseToneForValue(entry.valueMgDl) : null;

              return (
                <View key={option.value} style={styles.glucoseDayRow}>
                  <View style={styles.glucoseDayBody}>
                    <Text style={styles.listTitle}>{option.label}</Text>
                    {entry ? (
                      <>
                        <View
                          style={[
                            styles.glucoseValueBadge,
                            tone === "safe" && styles.glucoseValueBadgeSafe,
                            tone === "warning" && styles.glucoseValueBadgeWarning,
                            tone === "danger" && styles.glucoseValueBadgeDanger
                          ]}
                        >
                          <Text
                            style={[
                              styles.glucoseValueBadgeText,
                              tone === "safe" && styles.glucoseValueBadgeTextSafe,
                              tone === "warning" && styles.glucoseValueBadgeTextWarning,
                              tone === "danger" && styles.glucoseValueBadgeTextDanger
                            ]}
                          >
                            {entry.valueMgDl} mg/dL
                          </Text>
                        </View>
                        {entry.note ? <Text style={styles.listNote}>{entry.note}</Text> : null}
                      </>
                    ) : (
                      <Text style={styles.listMeta}>-</Text>
                    )}
                  </View>
                  {entry ? (
                    <View style={styles.listActions}>
                      <Pressable onPress={() => navigation.navigate("GlucoseEntryForm", { entry })} style={styles.editListButton}>
                        <Text style={styles.editListButtonText}>{t("edit")}</Text>
                      </Pressable>
                      <Pressable onPress={() => deleteGlucoseMutation.mutate(entry)} style={styles.deleteButton}>
                        <Text style={styles.deleteButtonText}>{t("delete")}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </FormScreen>
  );
};

const GlucoseEntryFormScreen = ({
  navigation,
  route
}: {
  navigation: AppNavigation;
  route: { params?: { entry?: GlucoseEntry; measuredAt?: string } };
}) => {
  const { t } = useTranslation();
  const queryClientValue = useQueryClient();
  const editingEntry = route.params?.entry;
  const language = currentLanguage();
  const [selectedDate, setSelectedDate] = React.useState(editingEntry?.measuredAt ?? route.params?.measuredAt ?? new Date().toISOString());
  const glucoseSections = [
    {
      title: t("morning"),
      options: [
        { value: "morning_fasting" as const, label: shortGlucoseLabel("morning_fasting") },
        { value: "morning_postprandial" as const, label: shortGlucoseLabel("morning_postprandial") }
      ]
    },
    {
      title: t("noon"),
      options: [
        { value: "noon_fasting" as const, label: shortGlucoseLabel("noon_fasting") },
        { value: "noon_postprandial" as const, label: shortGlucoseLabel("noon_postprandial") }
      ]
    },
    {
      title: t("evening"),
      options: [
        { value: "evening_fasting" as const, label: shortGlucoseLabel("evening_fasting") },
        { value: "evening_postprandial" as const, label: shortGlucoseLabel("evening_postprandial") }
      ]
    }
  ];
  const form = useForm({
    resolver: zodResolver(glucoseFormSchema),
    defaultValues: {
      readingType: editingEntry?.readingType ?? ("morning_fasting" as const),
      valueMgDl: editingEntry?.valueMgDl ?? 100,
      measuredAt: selectedDate,
      note: editingEntry?.note ?? ""
    }
  });

  React.useEffect(() => {
    form.setValue("measuredAt", selectedDate);
  }, [form, selectedDate]);

  return (
    <FormScreen>
      <ScreenHeader title={editingEntry ? t("edit") : t("addGlucose")} onBack={navigation.goBack} />
      <Controller
        control={form.control}
        name="readingType"
        render={({ field }) => (
          <View style={styles.stackSm}>
            {glucoseSections.map((section) => (
              <View key={section.title} style={styles.glucoseSectionCard}>
                <Text style={styles.glucoseSectionTitle}>{section.title}</Text>
                <View style={styles.glucoseOptionRow}>
                  {section.options.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => field.onChange(option.value)}
                      style={[
                        styles.glucoseOptionButton,
                        field.value === option.value && styles.glucoseOptionButtonActive
                      ]}
                    >
                      <Text
                        style={[
                          styles.glucoseOptionText,
                          field.value === option.value && styles.glucoseOptionTextActive
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      />
      <View style={styles.datePickerCard}>
        <DateTimePicker
          value={clampDateToToday(new Date(selectedDate))}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "calendar"}
          locale={language === "tr" ? "tr-TR" : "en-US"}
          accentColor={palette.accent}
          themeVariant={currentThemeMode()}
          maximumDate={new Date()}
          onChange={(event, nextDate) => {
            if (!nextDate || event.type === "dismissed") {
              return;
            }

            setSelectedDate(mergeDateWithCurrentTime(selectedDate, clampDateToToday(nextDate)));
          }}
        />
      </View>
      <Controller
        control={form.control}
        name="valueMgDl"
        render={({ field }) => (
          <FormField label="mg/dL" value={String(field.value)} onChangeText={(value) => field.onChange(Number(value))} keyboardType="numeric" />
        )}
      />
      <Controller
        control={form.control}
        name="note"
        render={({ field }) => <FormField label={t("note")} value={field.value ?? ""} onChangeText={field.onChange} />}
      />
      <ActionButton
        label={t("continue")}
        onPress={form.handleSubmit(async (values) => {
          if (editingEntry) {
            updateGlucoseLocally({
              ...editingEntry,
              ...values,
              measuredAt: selectedDate,
              note: values.note ?? null,
              deletedAt: null
            });
          } else {
            saveGlucoseLocally(createGlucoseEntry({ ...values, measuredAt: selectedDate }));
          }

          await queryClientValue.invalidateQueries({ queryKey: ["glucose"] });
          navigation.goBack();
        })}
      />
    </FormScreen>
  );
};

type MetricFormValues = {
  metricType: "hba1c" | "blood_pressure" | "weight";
  value?: string;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  measuredAt: string;
  note?: string;
};

const AddMetricScreen = ({
  navigation,
  route
}: {
  navigation: AppNavigation;
  route: {
    params?:
      | {
          entry?: HealthMetricEntry;
          metricType?: "hba1c" | "blood_pressure" | "weight";
          lockMetricType?: boolean;
        }
      | undefined;
  };
}) => {
  const { t } = useTranslation();
  const { state, applyProfile } = useSession();
  const queryClientValue = useQueryClient();
  const editingEntry = route.params?.entry;
  const lockedMetricType = route.params?.lockMetricType ?? false;
  const initialMetricType = editingEntry?.metricType ?? route.params?.metricType ?? "hba1c";
  const parsedPressure = parseBloodPressureValue(editingEntry?.value ?? "");
  const form = useForm<MetricFormValues>({
    resolver: zodResolver(metricFormSchema),
    defaultValues: {
      metricType: initialMetricType,
      value: editingEntry
        ? editingEntry.metricType === "hba1c"
          ? formatHba1cValue(editingEntry.value)
          : editingEntry.value
        : initialMetricType === "hba1c"
          ? "5,8"
          : initialMetricType === "weight"
            ? "70"
            : "",
      systolic: parsedPressure.systolic ?? 120,
      diastolic: parsedPressure.diastolic ?? 80,
      pulse: parsedPressure.pulse ?? 70,
      measuredAt: editingEntry?.measuredAt ?? new Date().toISOString(),
      note: editingEntry?.note ?? ""
    }
  });
  const metricType = form.watch("metricType");

  return (
    <FormScreen>
        <ScreenHeader title={lockedMetricType ? labelForMetricType(metricType) : t("addMetric")} onBack={navigation.goBack} />
        {!lockedMetricType ? (
          <Controller
            control={form.control}
            name="metricType"
            render={({ field }) => (
              <View style={styles.stackSm}>
                {["hba1c", "blood_pressure", "weight"].map((value) => (
                  <ActionButton
                    key={value}
                    label={labelForMetricType(value as "hba1c" | "blood_pressure" | "weight")}
                    tone={field.value === value ? "primary" : "secondary"}
                    onPress={() => {
                      field.onChange(value);
                      if (value === "blood_pressure") {
                        form.setValue("value", "");
                      }
                    }}
                  />
                ))}
              </View>
            )}
          />
        ) : null}
        {metricType === "blood_pressure" ? (
          <>
            <Controller
              control={form.control}
              name="systolic"
              render={({ field }) => (
                <FormField
                  label={t("systolic")}
                  value={String(field.value ?? "")}
                  onChangeText={(value) => field.onChange(Number(value) || undefined)}
                  keyboardType="numeric"
                />
              )}
            />
            <Controller
              control={form.control}
              name="diastolic"
              render={({ field }) => (
                <FormField
                  label={t("diastolic")}
                  value={String(field.value ?? "")}
                  onChangeText={(value) => field.onChange(Number(value) || undefined)}
                  keyboardType="numeric"
                />
              )}
            />
            <Controller
              control={form.control}
              name="pulse"
              render={({ field }) => (
                <FormField
                  label={t("pulse")}
                  value={String(field.value ?? "")}
                  onChangeText={(value) => field.onChange(Number(value) || undefined)}
                  keyboardType="numeric"
                />
              )}
            />
          </>
        ) : (
          <Controller
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormField
                label={t("value")}
                value={field.value ?? ""}
                onChangeText={(value) => field.onChange(metricType === "hba1c" ? value.replace(/\./g, ",") : value)}
                keyboardType={metricType === "hba1c" ? "decimal-pad" : "numeric"}
              />
            )}
          />
        )}
        <Controller
          control={form.control}
          name="measuredAt"
          render={({ field }) => <DateField label={t("measurementDate")} value={field.value} onChange={field.onChange} />}
        />
        <Controller
          control={form.control}
          name="note"
          render={({ field }) => <FormField label={t("note")} value={field.value ?? ""} onChangeText={field.onChange} />}
        />
        <ActionButton
          label={t("continue")}
          onPress={form.handleSubmit(async (values) => {
            const nextEntry = createMetricEntry(values);

            if (editingEntry) {
              updateMetricLocally({
                ...editingEntry,
                metricType: nextEntry.metricType,
                value: nextEntry.value,
                measuredAt: nextEntry.measuredAt,
                note: nextEntry.note ?? null,
                deletedAt: null
              });
            } else {
              saveMetricLocally(nextEntry);
            }

            if (nextEntry.metricType === "weight") {
              await syncProfileWeightFromLatestMetric(state.profile, applyProfile);
            }

            await queryClientValue.invalidateQueries({ queryKey: ["metrics"] });
            navigation.goBack();
          })}
        />
    </FormScreen>
  );
};

const RootNavigator = () => {
  const { state } = useSession();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [activeScreen, setActiveScreen] = React.useState("Home");
  const hasDevSession = devAuthBypass && state.hasDevSession;
  const bottomRoute = bottomRouteForScreen(activeScreen);
  const updateActiveScreen = () => setActiveScreen(navigationRef.getCurrentRoute()?.name ?? "Home");

  if (!state.ready) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.title}>{displayTranslations.tr.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={updateActiveScreen} onStateChange={updateActiveScreen}>
      <View style={styles.screen}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.mist },
            animation: "fade",
            animationDuration: 180,
            gestureEnabled: false
          }}
        >
          {!state.firebaseUser && !hasDevSession ? (
            <Stack.Screen name="SignIn" component={SignInScreen} />
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="SugarTracking" component={SugarTrackingScreen} />
              <Stack.Screen name="HealthValues" component={HealthValuesScreen} />
              <Stack.Screen name="MealList" component={MealListScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="Hba1cList" component={Hba1cListScreen} />
              <Stack.Screen name="RecipeList" component={RecipeListScreen} />
              <Stack.Screen name="GuideList" component={GuideListScreen} />
              <Stack.Screen name="ReportScreen" component={ReportScreen} />
              <Stack.Screen name="HydrationList" component={HydrationListScreen} />
              <Stack.Screen name="ActivityList" component={ActivityListScreen} />
              <Stack.Screen name="EmergencyCard" component={EmergencyCardScreen} />
              <Stack.Screen name="MedicationList" component={MedicationListScreen} />
              <Stack.Screen name="MedicationPlanList" component={MedicationPlanListScreen} />
              <Stack.Screen name="WeightList" component={WeightListScreen} />
              <Stack.Screen name="BloodPressureList" component={BloodPressureListScreen} />
              <Stack.Screen name="AddHydration" component={AddHydrationScreen} />
              <Stack.Screen name="AddMeal" component={AddMealScreen} />
              <Stack.Screen name="AddActivity" component={AddActivityScreen} />
              <Stack.Screen name="AddMedication" component={AddMedicationScreen} />
              <Stack.Screen name="AddMedicationPlan" component={AddMedicationPlanScreen} />
              <Stack.Screen name="AddGlucose" component={AddGlucoseScreen} />
              <Stack.Screen name="GlucoseEntryForm" component={GlucoseEntryFormScreen} />
              <Stack.Screen name="AddMetric" component={AddMetricScreen} />
            </>
          )}
        </Stack.Navigator>
        {(state.firebaseUser || hasDevSession) && bottomRoute ? (
          <HomeBottomBar
            currentRoute={bottomRoute}
            navigate={(route) => {
              if (navigationRef.isReady() && activeScreen !== route) {
                navigationRef.dispatch(CommonActions.navigate({ name: route, pop: true }));
              }
            }}
          />
        ) : null}
      </View>
    </NavigationContainer>
  );
};

export default function App() {
  const [brandImagesReady, setBrandImagesReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    void brandImages.preload(brandImageSources)
      .catch(() => undefined)
      .finally(() => {
        if (mounted) {
          setBrandImagesReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!brandImagesReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen}>
          <View style={styles.center}>
            <Text style={styles.title}>{displayTranslations.tr.loading}</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const createAppStyles = (themePalette: typeof darkPalette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: themePalette.mist
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  screenLayout: {
    flex: 1
  },
  stack: {
    padding: 20,
    gap: 16,
    backgroundColor: themePalette.mist
  },
  mainScreenContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 24,
    backgroundColor: themePalette.mist
  },
  stackSm: {
    gap: 12
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  inline: {
    flexDirection: "row",
    gap: 12
  },
  flexItem: {
    flex: 1
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: themePalette.ink
  },
  brandLogo: {
    width: "100%",
    height: 92,
    alignSelf: "center"
  },
  brandLogoCompact: {
    width: 220,
    height: 68,
    alignSelf: "flex-start"
  },
  subtitle: {
    fontSize: 16,
    color: themePalette.muted
  },
  homeHeaderContent: {
    flex: 1,
    minWidth: 0
  },
  homeBrandLogo: {
    width: "100%",
    maxWidth: 180,
    height: 56,
    alignSelf: "flex-start"
  },
  homeHeaderText: {
    fontFamily: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium" }),
    fontWeight: "500"
  },
  homeWelcome: {
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: themePalette.ink,
    marginTop: 4,
    marginBottom: 6
  },
  homeDiabetesType: {
    fontSize: 16,
    lineHeight: 22,
    color: themePalette.muted
  },
  card: {
    backgroundColor: themePalette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 16,
    gap: 12,
    shadowColor: "#020817",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 4
  },
  nutritionHero: {
    backgroundColor: themePalette.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 18,
    gap: 14,
    shadowColor: themePalette.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 5
  },
  nutritionHeroTitle: {
    color: themePalette.ink,
    fontSize: 24,
    fontWeight: "900"
  },
  nutritionHeroText: {
    color: themePalette.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  nutritionSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  nutritionSummaryCard: {
    width: "48%",
    backgroundColor: themePalette.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 12,
    gap: 4
  },
  nutritionSummaryValue: {
    color: themePalette.accent,
    fontSize: 18,
    fontWeight: "900"
  },
  nutritionSummaryLabel: {
    color: themePalette.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  contentActionGrid: {
    flexDirection: "row",
    gap: 10
  },
  contentActionCard: {
    flex: 1,
    backgroundColor: themePalette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 12,
    gap: 8,
    alignItems: "center"
  },
  contentActionIcon: {
    color: themePalette.accent,
    fontSize: 20,
    fontWeight: "900"
  },
  contentActionTitle: {
    color: themePalette.ink,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center"
  },
  contentHero: {
    backgroundColor: themePalette.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 18,
    gap: 12,
    shadowColor: themePalette.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 5
  },
  contentHeroEyebrow: {
    color: themePalette.accent,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  contentHeroTitle: {
    color: themePalette.ink,
    fontSize: 26,
    fontWeight: "900"
  },
  recipeCard: {
    backgroundColor: themePalette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 16,
    gap: 12
  },
  guideCard: {
    backgroundColor: themePalette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 16,
    gap: 14
  },
  recipeTitle: {
    color: themePalette.ink,
    fontSize: 20,
    fontWeight: "900"
  },
  recipeMacroBadge: {
    minWidth: 88,
    borderRadius: 18,
    backgroundColor: themePalette.accentSoft,
    borderWidth: 1,
    borderColor: themePalette.accent,
    padding: 10,
    alignItems: "center"
  },
  recipeMacroValue: {
    color: themePalette.accent,
    fontSize: 18,
    fontWeight: "900"
  },
  recipeMacroLabel: {
    color: themePalette.muted,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center"
  },
  recipeFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  recipeFilterButton: {
    minWidth: 92,
    flexGrow: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: themePalette.border,
    backgroundColor: themePalette.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  recipeFilterButtonActive: {
    backgroundColor: themePalette.accent,
    borderColor: themePalette.accent
  },
  recipeFilterText: {
    color: themePalette.accent,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  recipeFilterTextActive: {
    color: "#FFFFFF"
  },
  contentBullet: {
    color: themePalette.ink,
    fontSize: 14,
    lineHeight: 21
  },
  guideStepRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: themePalette.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 12
  },
  guideStepIndex: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: themePalette.accent,
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "900"
  },
  guideStepText: {
    flex: 1,
    color: themePalette.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600"
  },
  foodSearchCard: {
    backgroundColor: themePalette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 16,
    gap: 12
  },
  foodResultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: themePalette.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 12,
    marginBottom: 10
  },
  foodResultCardActive: {
    borderColor: themePalette.success,
    backgroundColor: themePalette.accentSoft
  },
  foodResultTitle: {
    color: themePalette.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  selectedFoodCard: {
    backgroundColor: themePalette.accentSoft,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: themePalette.accent,
    padding: 16,
    gap: 12
  },
  foodMacroGrid: {
    flexDirection: "row",
    gap: 8
  },
  foodMacroPill: {
    flex: 1,
    backgroundColor: themePalette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 10,
    gap: 4
  },
  foodMacroValue: {
    color: themePalette.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  foodMacroLabel: {
    color: themePalette.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 14,
    color: themePalette.ink,
    fontWeight: "700"
  },
  input: {
    backgroundColor: themePalette.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: themePalette.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: themePalette.ink,
    fontSize: 15
  },
  readonlyField: {
    backgroundColor: themePalette.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: themePalette.border,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  readonlyFieldSafe: {
    backgroundColor: "rgba(46, 212, 122, 0.14)",
    borderColor: themePalette.success
  },
  readonlyFieldWarning: {
    backgroundColor: "rgba(255, 176, 32, 0.14)",
    borderColor: themePalette.orange
  },
  readonlyFieldDanger: {
    backgroundColor: "rgba(255, 92, 122, 0.14)",
    borderColor: themePalette.warning
  },
  readonlyValue: {
    color: themePalette.ink,
    fontSize: 16,
    fontWeight: "600"
  },
  readonlyValueSafe: {
    color: themePalette.success
  },
  readonlyValueWarning: {
    color: themePalette.orange
  },
  readonlyValueDanger: {
    color: themePalette.warning
  },
  dateTrigger: {
    backgroundColor: themePalette.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: themePalette.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6
  },
  dateValue: {
    color: themePalette.ink,
    fontSize: 16,
    fontWeight: "600"
  },
  dateAction: {
    color: themePalette.accent,
    fontSize: 13,
    fontWeight: "600"
  },
  datePickerCard: {
    backgroundColor: themePalette.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: themePalette.accent,
    padding: 10,
    overflow: "hidden"
  },
  chartDatePickerCard: {
    alignItems: "center",
    paddingVertical: 0,
    paddingHorizontal: 0
  },
  dateTimeInline: {
    flexDirection: "row",
    gap: 12
  },
  chartDatePicker: {
    alignSelf: "center",
    transform: [{ scale: Platform.OS === "ios" ? 0.94 : 1 }]
  },
  glucoseSectionCard: {
    backgroundColor: themePalette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: themePalette.border,
    padding: 16,
    gap: 12
  },
  glucoseSectionTitle: {
    color: themePalette.ink,
    fontSize: 18,
    fontWeight: "700"
  },
  glucoseOptionRow: {
    flexDirection: "row",
    gap: 10
  },
  glucoseOptionButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: themePalette.border,
    backgroundColor: themePalette.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  glucoseOptionButtonActive: {
    backgroundColor: themePalette.accent,
    borderColor: themePalette.accent
  },
  glucoseOptionText: {
    color: themePalette.accent,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center"
  },
  glucoseOptionTextActive: {
    color: "#FFFFFF"
  },
  metricTabRow: {
    flexDirection: "row",
    gap: 8
  },
  metricTabButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: themePalette.border,
    backgroundColor: themePalette.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  metricTabButtonActive: {
    backgroundColor: themePalette.accent,
    borderColor: themePalette.accent
  },
  metricTabText: {
    color: themePalette.accent,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  metricTabTextActive: {
    color: "#FFFFFF"
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: themePalette.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: themePalette.border,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  toggleLabel: {
    flex: 1,
    fontSize: 14,
    color: themePalette.ink,
    fontWeight: "600"
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: themePalette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themePalette.surface
  },
  checkboxChecked: {
    backgroundColor: themePalette.accent,
    borderColor: themePalette.accent
  },
  checkboxMark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  button: {
    backgroundColor: themePalette.accent,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: themePalette.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 3
  },
  buttonSecondary: {
    backgroundColor: themePalette.accentSoft,
    borderWidth: 1,
    borderColor: themePalette.border,
    shadowOpacity: 0
  },
  buttonDanger: {
    backgroundColor: "rgba(255, 92, 122, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 92, 122, 0.38)",
    shadowOpacity: 0
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  buttonSecondaryText: {
    color: themePalette.accent
  },
  buttonDangerText: {
    color: themePalette.warning
  },
  sectionTitle: {
    fontSize: 18,
    color: themePalette.ink,
    fontWeight: "800"
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: themePalette.border
  },
  listBody: {
    flex: 1,
    gap: 4
  },
  listActions: {
    gap: 8
  },
  listTitle: {
    color: themePalette.ink,
    fontWeight: "700"
  },
  listMeta: {
    color: themePalette.muted,
    marginTop: 4
  },
  listNote: {
    color: themePalette.ink,
    fontSize: 13
  },
  chartMeta: {
    color: themePalette.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  chartEmptyWrap: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: themePalette.surfaceElevated,
    borderWidth: 1,
    borderColor: themePalette.border
  },
  chartEmptyText: {
    color: themePalette.muted,
    fontSize: 14,
    fontWeight: "600"
  },
  chartScrollContent: {
    paddingRight: 12
  },
  chartFrame: {
    position: "relative",
    alignSelf: "center"
  },
  chartGridLine: {
    position: "absolute",
    height: 1,
    backgroundColor: themePalette.border
  },
  chartAxisVertical: {
    position: "absolute",
    width: 1,
    backgroundColor: themePalette.border
  },
  chartAxisHorizontal: {
    position: "absolute",
    height: 1,
    backgroundColor: themePalette.border
  },
  chartYAxisLabel: {
    position: "absolute",
    left: 0,
    width: 28,
    color: themePalette.muted,
    fontSize: 11,
    textAlign: "right"
  },
  chartXAxisLabel: {
    position: "absolute",
    width: 36,
    color: themePalette.muted,
    fontSize: 10,
    textAlign: "center"
  },
  chartLineSegment: {
    position: "absolute",
    height: 2
  },
  chartPoint: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: themePalette.surface
  },
  glucoseDayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: themePalette.border
  },
  glucoseDayBody: {
    flex: 1,
    gap: 6
  },
  glucoseValueBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  glucoseValueBadgeSafe: {
    backgroundColor: "rgba(46, 212, 122, 0.16)"
  },
  glucoseValueBadgeWarning: {
    backgroundColor: "rgba(255, 176, 32, 0.16)"
  },
  glucoseValueBadgeDanger: {
    backgroundColor: "rgba(255, 92, 122, 0.16)"
  },
  glucoseValueBadgeText: {
    fontSize: 12,
    fontWeight: "700"
  },
  glucoseValueBadgeTextSafe: {
    color: themePalette.success
  },
  glucoseValueBadgeTextWarning: {
    color: themePalette.orange
  },
  glucoseValueBadgeTextDanger: {
    color: themePalette.warning
  },
  editListButton: {
    borderRadius: 12,
    backgroundColor: themePalette.accentSoft,
    borderWidth: 1,
    borderColor: themePalette.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  editListButtonText: {
    color: themePalette.accent,
    fontSize: 12,
    fontWeight: "700"
  },
  deleteButton: {
    borderRadius: 12,
    backgroundColor: "rgba(255, 92, 122, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 92, 122, 0.38)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  deleteButtonText: {
    color: themePalette.warning,
    fontSize: 12,
    fontWeight: "700"
  },
  bottomBarWrap: {
    paddingHorizontal: 0,
    paddingTop: 0,
    backgroundColor: "transparent"
  },
  bottomBar: {
    backgroundColor: themePalette.navigationSurface,
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderColor: themePalette.border,
    borderBottomWidth: 0,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    shadowColor: "#020817",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8
  },
  bottomBarItems: {
    flexDirection: "row",
    gap: 2,
    justifyContent: "space-between"
  },
  bottomBarButton: {
    borderRadius: 28,
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    flex: 1
  },
  bottomBarButtonActive: {
    backgroundColor: "transparent"
  },
  bottomBarIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    opacity: 0.74
  },
  bottomBarIconActive: {
    opacity: 1
  },
  bottomBarHomeIcon: {
    transform: [{ scale: 0.68 }]
  },
  bottomBarHomeRoof: {
    position: "absolute",
    width: 25,
    height: 25,
    top: 9,
    left: 8.5,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: themePalette === darkPalette ? "#FFFFFF" : "#444A4A",
    borderTopLeftRadius: 3,
    transform: [{ rotate: "45deg" }]
  },
  bottomBarHomeBody: {
    position: "absolute",
    width: 26,
    height: 22,
    top: 18,
    left: 8,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: themePalette === darkPalette ? "#FFFFFF" : "#444A4A",
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  bottomBarHomeDoor: {
    width: 7,
    height: 11,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: "#009B38"
  },
  bottomBarGlyph: {
    color: themePalette.muted,
    fontSize: 40,
    lineHeight: 46
  },
  bottomBarGlyphActive: {
    color: themePalette.accent
  },
  bottomBarLabelWrap: {
    height: 32,
    alignSelf: "stretch",
    justifyContent: "center",
    marginTop: 4
  },
  bottomBarLabel: {
    color: themePalette.muted,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
    textAlign: "center"
  },
  bottomBarLabelActive: {
    color: themePalette.success
  },
  bottomBarIndicator: {
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: "transparent",
    marginTop: 8
  },
  bottomBarIndicatorActive: {
    backgroundColor: themePalette.success
  }
});

let styles = createAppStyles(palette);
