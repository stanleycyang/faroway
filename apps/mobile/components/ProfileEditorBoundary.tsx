import { useEffect, useState, type ReactNode } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { z } from 'zod';
import { useUserStore } from '../stores/userStore';
import { getVerifiedUserProfile } from '../services/api';

const savedProfile = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullish(),
  avatar: z.string().nullish(),
  preferences: z
    .object({
      vibes: z.array(z.string()).optional(),
      budget: z.string().optional(),
      travelerType: z.string().optional(),
    })
    .nullish(),
});
export type EditorProfile = z.infer<typeof savedProfile>;

/** A new editor mounts only after its current account's stored fields are readable. */
export function ProfileEditorBoundary({
  children,
}: {
  children: (profile: EditorProfile) => ReactNode;
}) {
  const router = useRouter();
  const { user, accountRevision } = useUserStore();
  const owner = user?.id;
  const scope = `${owner}:${accountRevision}`;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    scope: string;
    profile?: EditorProfile;
    failed?: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    const baseline = useUserStore.getState().user;
    setResult(null);
    const current = () => {
      const account = useUserStore.getState();
      return active && account.user?.id === owner && account.accountRevision === accountRevision;
    };
    if (owner)
      void getVerifiedUserProfile(owner)
        .then((response) => {
          if (!current()) return;
          const parsed = savedProfile.safeParse(response.data);
          if (response.error || !parsed.success || parsed.data.id !== owner)
            setResult({ scope, failed: true });
          else {
            // Publish only if no newer enrichment/edit replaced the captured profile.
            const account = useUserStore.getState();
            if (account.user === baseline && baseline)
              account.setUser({
                ...baseline,
                name: parsed.data.name || baseline.name,
                email: parsed.data.email,
                avatar: parsed.data.avatar || baseline.avatar,
                preferences: {
                  vibes: parsed.data.preferences?.vibes || [],
                  budget: parsed.data.preferences?.budget,
                  travelerType: parsed.data.preferences?.travelerType,
                },
              });
            setResult({ scope, profile: parsed.data });
          }
        })
        .catch(() => {
          if (current()) setResult({ scope, failed: true });
        });
    return () => {
      active = false;
    };
  }, [owner, accountRevision, scope, attempt]);

  const resolved = result?.scope === scope ? result : null;
  if (resolved?.profile)
    return (
      <View style={styles.container} key={scope}>
        {children(resolved.profile)}
      </View>
    );
  return (
    <SafeAreaView style={styles.recovery}>
      <Text style={styles.title} accessibilityRole="header">
        Your saved profile
      </Text>
      <Text
        style={styles.message}
        accessibilityRole={resolved?.failed ? 'alert' : 'text'}
        accessibilityLiveRegion="polite"
      >
        {resolved?.failed
          ? 'We couldn’t load your saved profile. Try again before changing its details.'
          : 'Loading your saved profile…'}
      </Text>
      {resolved?.failed && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Retry saved profile"
          style={styles.primary}
          onPress={() => setAttempt((value) => value + 1)}
        >
          <Text style={styles.primaryText}>Try again</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Return to Profile"
        style={styles.exit}
        onPress={() => router.replace('/(tabs)/profile')}
      >
        <Text style={styles.exitText}>Return to Profile</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  recovery: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  message: { fontSize: 16, lineHeight: 24, color: '#475569', marginBottom: 24 },
  primary: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  exit: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  exitText: { color: '#334155', fontSize: 16, fontWeight: '600' },
});
