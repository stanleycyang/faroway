// Re-export from shared package for backward compatibility
export { supabase, getAuthHeaders } from '@tripgenie/supabase/mobile';

// Backend API base URL — kept locally since it uses Expo-specific env vars
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:3000' : '');
