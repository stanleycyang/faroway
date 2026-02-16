/**
 * API Configuration
 * Backend URLs for development and production
 */

// Set this to your Vercel deployment URL in production
// For local development, use your machine's IP address instead of localhost
// so that the Expo app can connect (localhost won't work on physical devices)

export const API_BASE_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000') // Local development
  : (process.env.EXPO_PUBLIC_API_URL || 'https://backend-eta-nine-28.vercel.app'); // Production Vercel URL

// Alternative: Use your computer's local IP for testing on physical devices
// export const API_BASE_URL = __DEV__
//   ? 'http://192.168.1.X:3000' // Replace with your local IP
//   : 'https://backend-eta-nine-28.vercel.app';

export const API_TIMEOUT = 90000; // 90 seconds for long-running AI searches
