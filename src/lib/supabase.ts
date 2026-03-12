import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url = (Constants.expoConfig?.extra as any)?.SUPABASE_URL as string;
const anon = (Constants.expoConfig?.extra as any)?.SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});