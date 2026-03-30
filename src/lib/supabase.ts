import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const url = (Constants.expoConfig?.extra as any)?.SUPABASE_URL as string;
const anon = (Constants.expoConfig?.extra as any)?.SUPABASE_ANON_KEY as string;

// On web, let Supabase use its default localStorage — AsyncStorage's web
// polyfill can break the auth client and cause "Failed to fetch" errors.
const storage = Platform.OS === "web" ? undefined : AsyncStorage;

export const supabase = createClient(url, anon, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});