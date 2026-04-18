import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL = "https://umeeqkvhjbpdnmhvfvzj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtZWVxa3ZoamJwZG5taHZmdnpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njk2MDUsImV4cCI6MjA5MTE0NTYwNX0.CN8cm9-OQOReL4OSk3Cag44vZaxLWEAM-AbuyMDs1kQ";

// Use localStorage on web, AsyncStorage on native
const authStorage = Platform.OS === "web" ? undefined : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});