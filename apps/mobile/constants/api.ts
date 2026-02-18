/**
 * API Configuration
 * The mobile app uses the web app (apps/web) as its unified backend.
 * Set EXPO_PUBLIC_API_URL to the web app's deployment URL.
 */

export const API_BASE_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000')
  : (process.env.EXPO_PUBLIC_API_URL || 'https://tripgenie.vercel.app');

export const API_TIMEOUT = 90000; // 90 seconds for long-running AI searches
