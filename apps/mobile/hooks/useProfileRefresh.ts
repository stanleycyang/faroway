import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getVerifiedUserProfile } from '../services/api';
import { savedProfile } from '../lib/profileSnapshot';
import { useUserStore } from '../stores/userStore';

/** Auth may open the app before profile enrichment succeeds. Revalidate on
 * focus/foreground without letting old reads overwrite a newer account or edit. */
export function useProfileRefresh() {
  const { user, accountRevision } = useUserStore();
  const owner = user?.id;
  const scope = `${owner}:${accountRevision}`;
  const [result, setResult] = useState<{
    scope: string;
    status: 'loading' | 'ready' | 'error';
  } | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!owner) return;
      let active = true;
      let request = 0;
      const refresh = async () => {
        const attempt = ++request;
        const baseline = useUserStore.getState().user;
        const current = () => {
          const state = useUserStore.getState();
          return (
            active &&
            request === attempt &&
            state.user?.id === owner &&
            state.accountRevision === accountRevision
          );
        };
        if (!current()) return;
        setResult({ scope, status: 'loading' });
        try {
          const response = await getVerifiedUserProfile(owner);
          if (!current()) return;
          const parsed = savedProfile.safeParse(response.data);
          if (response.error || !parsed.success || parsed.data.id !== owner)
            throw new Error('Profile unavailable');
          const state = useUserStore.getState();
          if (baseline && state.user === baseline)
            state.setUser({
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
          setResult({ scope, status: 'ready' });
        } catch {
          if (current()) setResult({ scope, status: 'error' });
        }
      };
      void refresh();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      return () => {
        active = false;
        subscription.remove();
      };
    }, [owner, accountRevision, scope])
  );
  return result?.scope === scope ? result.status : 'loading';
}
