import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VibeSelector } from '../../components/ui';
import {
  BUDGET_TIERS,
  normalizeBudgetTier,
  normalizeVibeList,
  travelerTypes,
} from '@faroway/constants';
import { useUserStore } from '../../stores/userStore';
import { updateUserProfile } from '../../services/api';
import { ProfileEditorBoundary, type EditorProfile } from '../../components/ProfileEditorBoundary';
import { colors, borderRadius } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

const BUDGET_ICONS: Record<
  (typeof BUDGET_TIERS)[number]['id'],
  'wallet-outline' | 'cash-outline' | 'sparkles-outline'
> = {
  budget: 'wallet-outline',
  moderate: 'cash-outline',
  luxury: 'sparkles-outline',
};

const budgetOptions = BUDGET_TIERS.map((tier) => ({
  id: tier.id,
  label: tier.label,
  icon: BUDGET_ICONS[tier.id],
  description: tier.description,
}));

export default function PreferencesScreen() {
  const router = useRouter();
  const { user, accountRevision } = useUserStore();
  useEffect(() => {
    if (!user) {
      router.replace('/(tabs)/profile');
    }
  }, [user, router]);
  if (!user)
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.signedOutContainer}>
          <Text style={styles.signedOutTitle} accessibilityRole="header">
            Sign in to edit preferences
          </Text>
          <Text style={styles.signedOutBody}>
            Return to Profile to sign in and manage your travel preferences.
          </Text>
          <TouchableOpacity
            style={styles.signedOutButton}
            onPress={() => router.replace('/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel="Return to Profile"
          >
            <Text style={styles.signedOutButtonText}>Return to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  return (
    <ProfileEditorBoundary>
      {(profile) => (
        <PreferencesScreenEditor key={`${user.id}:${accountRevision}`} profile={profile} />
      )}
    </ProfileEditorBoundary>
  );
}

function PreferencesScreenEditor({ profile }: { profile: EditorProfile }) {
  const router = useRouter();
  const { user, updatePreferences } = useUserStore();
  const [selectedVibes, setSelectedVibes] = useState<string[]>(() =>
    normalizeVibeList(profile.preferences?.vibes ?? [], 5)
  );
  const [selectedBudget, setSelectedBudget] = useState<string>(
    () => normalizeBudgetTier(profile.preferences?.budget) ?? ''
  );
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingAccountId] = useState(user?.id);
  const [editingAccountRevision] = useState(useUserStore.getState().accountRevision);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const isCurrentEditor = () =>
    mountedRef.current &&
    editingAccountId != null &&
    useUserStore.getState().user?.id === editingAccountId &&
    useUserStore.getState().accountRevision === editingAccountRevision;

  const handleSave = async () => {
    if (!isCurrentEditor() || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    try {
      const preferences = {
        vibes: selectedVibes,
        ...(selectedBudget ? { budget: selectedBudget } : {}),
        ...(travelerTypes.some((option) => option.id === profile.preferences?.travelerType)
          ? { travelerType: profile.preferences!.travelerType }
          : {}),
      };
      const result = await updateUserProfile({ preferences }, editingAccountId!);
      if (!isCurrentEditor()) return;
      if (result.error) throw new Error(result.error);

      updatePreferences({ ...preferences, budget: selectedBudget || undefined });
      hapticFeedback.success();
      setSaved(true);
      if (typeof router.canGoBack === 'function' && !router.canGoBack()) {
        router.replace('/(tabs)/profile');
      } else {
        router.back();
      }
    } catch (error: unknown) {
      if (!isCurrentEditor()) return;
      hapticFeedback.error();
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Couldn’t save preferences', message);
    } finally {
      savingRef.current = false;
      if (isCurrentEditor()) setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (typeof router.canGoBack === 'function' && !router.canGoBack()) {
              router.replace('/(tabs)/profile');
            } else {
              router.back();
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={'#475569'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Travel preferences
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving || user?.id !== editingAccountId}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Preferences saved' : 'Save preferences'}
          accessibilityState={{ disabled: isSaving, busy: isSaving }}
        >
          <Text style={styles.saveButtonText}>
            {saved ? 'Saved' : isSaving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 16, lineHeight: 24, color: '#53676C', marginBottom: 24 }}>
          A starting point for your next adventure. Choose up to five interests and the budget that
          feels right.
        </Text>
        {/* Vibes */}
        <View style={styles.section}>
          <VibeSelector
            selected={selectedVibes}
            onSelect={setSelectedVibes}
            maxSelections={5}
            disabled={isSaving}
          />
        </View>

        {/* Budget */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred budget (optional)</Text>
          <View style={styles.budgetOptions}>
            {budgetOptions.map((option) => {
              const isSelected = selectedBudget === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.budgetOption, isSelected && styles.budgetOptionSelected]}
                  disabled={isSaving}
                  onPress={() => {
                    if (savingRef.current) return;
                    hapticFeedback.selection();
                    setSelectedBudget(isSelected ? '' : option.id);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label} budget. ${option.description}`}
                  accessibilityState={{ selected: isSelected, disabled: isSaving }}
                  accessibilityHint={
                    isSelected ? 'Tap to clear your preferred budget' : 'Sets your preferred budget'
                  }
                >
                  <Ionicons
                    name={option.icon}
                    size={28}
                    color={isSelected ? colors.action.primary : colors.neutral[600]}
                    style={styles.budgetIcon}
                    accessible={false}
                  />
                  <View style={styles.budgetContent}>
                    <Text style={[styles.budgetLabel, isSelected && styles.budgetLabelSelected]}>
                      {option.label}
                    </Text>
                    <Text style={styles.budgetDescription}>{option.description}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.action.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#182B31',
    flexShrink: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  saveButton: {
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.action.primary,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  budgetOptions: {
    gap: 12,
  },
  budgetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: '#DCE5E3',
  },
  budgetOptionSelected: {
    backgroundColor: '#FFF5F4',
    borderColor: colors.action.primary,
  },
  budgetIcon: {
    marginRight: 16,
  },
  budgetContent: {
    flex: 1,
  },
  budgetLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  budgetLabelSelected: {
    color: colors.primary[800],
  },
  budgetDescription: {
    fontSize: 13,
    color: colors.surface[600],
    marginTop: 2,
  },
  signedOutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  signedOutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  signedOutBody: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },
  signedOutButton: {
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.action.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signedOutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
