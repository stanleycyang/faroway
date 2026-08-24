import { useState } from 'react';
import { Alert, View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, VibeSelector } from '../../components/ui';
import { useUserStore } from '../../stores/userStore';
import { updateUserProfile } from '../../services/api';
import { colors, borderRadius } from '../../constants/theme';

export default function PreferencesScreen() {
  const router = useRouter();
  const { setOnboardingComplete, updatePreferences, user } = useUserStore();
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const budgetOptions = [
    { id: 'budget', label: 'Budget', emoji: '💰', description: 'Best value deals' },
    { id: 'moderate', label: 'Moderate', emoji: '💵', description: 'Balance of comfort & cost' },
    { id: 'luxury', label: 'Luxury', emoji: '✨', description: 'Premium experiences' },
  ];

  const handleComplete = async () => {
    if (isSaving) return;

    const preferences = {
      vibes: selectedVibes,
      ...(selectedBudget ? { budget: selectedBudget } : {}),
    };

    setIsSaving(true);
    updatePreferences(preferences);

    if (user) {
      const result = await updateUserProfile({ preferences });
      if (result.error) {
        Alert.alert(
          'Preferences saved on this device',
          'We could not sync them to your account yet. You can update them again from Profile.'
        );
      }
    }

    setOnboardingComplete(true);
    setIsSaving(false);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.surface[300]} />
        </TouchableOpacity>
        <View style={styles.progress}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '66%' }]} />
          </View>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Personalize your experience</Text>
          <Text style={styles.subtitle}>
            Tell us about your travel preferences so we can create better recommendations for you.
          </Text>
        </View>

        {/* Vibes Selection */}
        <View style={styles.section}>
          <VibeSelector selected={selectedVibes} onSelect={setSelectedVibes} maxSelections={5} />
        </View>

        {/* Budget Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's your typical budget?</Text>
          <View style={styles.budgetOptions}>
            {budgetOptions.map((option) => {
              const isSelected = selectedBudget === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.budgetOption, isSelected && styles.budgetOptionSelected]}
                  onPress={() => setSelectedBudget(option.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.budgetEmoji}>{option.emoji}</Text>
                  <Text style={[styles.budgetLabel, isSelected && styles.budgetLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={styles.budgetDescription}>{option.description}</Text>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <Button
          title={isSaving ? 'Saving' : 'Continue'}
          onPress={handleComplete}
          size="lg"
          fullWidth
          disabled={selectedVibes.length === 0 || isSaving}
          loading={isSaving}
        />
        <TouchableOpacity onPress={handleComplete} disabled={isSaving}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface[900],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface[800],
    justifyContent: 'center',
    alignItems: 'center',
  },
  progress: {
    flex: 1,
    paddingHorizontal: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.surface[700],
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  titleSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.surface[400],
    lineHeight: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  budgetOptions: {
    gap: 12,
  },
  budgetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface[800],
    padding: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  budgetOptionSelected: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderColor: colors.primary[500],
  },
  budgetEmoji: {
    fontSize: 28,
    marginRight: 16,
  },
  budgetLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginRight: 8,
  },
  budgetLabelSelected: {
    color: colors.primary[400],
  },
  budgetDescription: {
    flex: 1,
    fontSize: 13,
    color: colors.surface[400],
  },
  checkmark: {
    marginLeft: 8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface[800],
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 16,
  },
  skipText: {
    fontSize: 14,
    color: colors.surface[400],
    fontWeight: '600',
  },
});
