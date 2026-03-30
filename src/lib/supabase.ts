import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// EXPO_PUBLIC_* vars are inlined at build time and work reliably on web.
// Constants.expoConfig?.extra is a fallback for native builds.
// Hardcoded strings are the final fallback so the client is never undefined.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra as any)?.SUPABASE_URL ??
  "https://udueocsruydumlctqumg.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra as any)?.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdWVvY3NydXlkdW1sY3RxdW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjkxMjEsImV4cCI6MjA5MDIwNTEyMX0.EQDESVKuCgAvFwpMV1pArGb4oVHMY2mWYMGC_K6B0PQ";

// On web, let Supabase use its default localStorage — passing AsyncStorage
// on web causes the auth client to fail with "Failed to fetch".
const storage = Platform.OS === "web" ? undefined : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
