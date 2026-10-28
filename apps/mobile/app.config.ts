import { ExpoConfig, ConfigContext } from 'expo/config';

// Keep this guard in app.config.ts: Expo evaluates this file without installing
// a TypeScript loader for its imports.
export const QA_SUPABASE_PROJECT_REF = 'omovikloadpvzijoaqus';
export const QA_API_ORIGIN =
  'https://faroway-git-verify-staging-readiness-20261018-testimonio.vercel.app';

export function assertQaBuildEnvironment(env: Record<string, string | undefined>): void {
  if (env.EXPO_PUBLIC_MOBILE_QA !== '1') return;
  if (env.EXPO_PUBLIC_SUPABASE_URL !== `https://${QA_SUPABASE_PROJECT_REF}.supabase.co`) {
    throw new Error('Mobile QA requires the isolated Faroway staging database.');
  }
  if (env.EXPO_PUBLIC_API_URL !== QA_API_ORIGIN) {
    throw new Error('Mobile QA requires the explicitly configured staging API origin.');
  }
  const key = env.EXPO_PUBLIC_QA_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('Mobile QA requires the staging public Supabase key.');
  }
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (payload.ref !== QA_SUPABASE_PROJECT_REF || payload.role !== 'anon') throw new Error();
  } catch {
    throw new Error('Mobile QA public key must belong to the isolated staging project.');
  }
}

const EAS_PROJECT_ID = 'b4813d98-52ec-4985-a462-3d30a7f681b9';

export default ({ config }: ConfigContext): ExpoConfig => {
  assertQaBuildEnvironment(process.env);
  const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  const plugins: NonNullable<ExpoConfig['plugins']> = [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    ...(googleIosUrlScheme
      ? ([
          [
            '@react-native-google-signin/google-signin',
            {
              iosUrlScheme: googleIosUrlScheme,
            },
          ],
        ] as NonNullable<ExpoConfig['plugins']>)
      : []),
    ...(googleIosUrlScheme ? ['./plugins/withGoogleSignInModules'] : []),
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#FF6B6B',
        sounds: [],
        defaultChannel: 'default',
      },
    ],
  ];

  return {
    ...config,
    name: 'Faroway',
    slug: 'faroway',
    owner: 'testimonio',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'faroway',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0a0a0a',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'ai.faroway.app',
      usesAppleSignIn: true,
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0a0a0a',
      },
      package: 'ai.faroway.app',
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins,
    experiments: {
      typedRoutes: true,
    },
    extra: {
      // These will be populated from .env or EAS secrets
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey:
        process.env.EXPO_PUBLIC_MOBILE_QA === '1'
          ? process.env.EXPO_PUBLIC_QA_SUPABASE_ANON_KEY
          : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      eas: {
        projectId: EAS_PROJECT_ID,
      },
    },
  };
};
