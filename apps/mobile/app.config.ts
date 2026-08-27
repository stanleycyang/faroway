import { ExpoConfig, ConfigContext } from 'expo/config';

const EAS_PROJECT_ID = 'b4813d98-52ec-4985-a462-3d30a7f681b9';

export default ({ config }: ConfigContext): ExpoConfig => {
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
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      eas: {
        projectId: EAS_PROJECT_ID,
      },
    },
  };
};
