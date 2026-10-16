import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../../stores/userStore';
import { updateUserProfile } from '../../services/api';
import { ProfileEditorBoundary, type EditorProfile } from '../../components/ProfileEditorBoundary';
import { colors, borderRadius } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

export default function EditProfileScreen() {
  const { user, accountRevision } = useUserStore();
  if (!user)
    return (
      <SafeAreaView style={styles.container}>
        <Text accessibilityLiveRegion="polite">Loading your profile…</Text>
      </SafeAreaView>
    );
  return (
    <ProfileEditorBoundary>
      {(profile) => (
        <EditProfileScreenEditor key={`${user.id}:${accountRevision}`} profile={profile} />
      )}
    </ProfileEditorBoundary>
  );
}

function EditProfileScreenEditor({ profile }: { profile: EditorProfile }) {
  const router = useRouter();
  const { user, setUser } = useUserStore();
  const [name, setName] = useState(profile.name || '');
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
    if (!name.trim()) {
      Alert.alert('Add your name', 'Enter a display name before saving.');
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      // The profile API is the canonical display-name store; one owner-pinned write.
      const result = await updateUserProfile({ display_name: name.trim() }, editingAccountId!);
      if (!isCurrentEditor()) return;
      if (result.error) throw new Error(result.error);

      // Update local store
      if (user) {
        const current = useUserStore.getState().user;
        if (current) setUser({ ...current, name: name.trim() });
      }

      hapticFeedback.success();
      router.back();
    } catch (error: unknown) {
      if (!isCurrentEditor()) return;
      const msg = error instanceof Error ? error.message : 'Failed to save profile';
      Alert.alert('Couldn’t save profile', msg);
    } finally {
      savingRef.current = false;
      if (isCurrentEditor()) setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color={'#475569'} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Edit Profile
          </Text>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving || user?.id !== editingAccountId}
            accessibilityRole="button"
            accessibilityLabel={isSaving ? 'Saving profile' : 'Save profile'}
            accessibilityState={{ disabled: isSaving, busy: isSaving }}
          >
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {profile.avatar ? (
                <Image source={{ uri: profile.avatar }} style={styles.avatar} accessible={false} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color={colors.surface[500]} />
                </View>
              )}
            </View>
            <Text style={styles.avatarHint}>Avatar is synced from your sign-in provider</Text>
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Display Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={colors.surface[400]}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  editable={!isSaving}
                  maxLength={100}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.surface[600]}
                  autoCapitalize="words"
                  accessibilityLabel="Display name"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={colors.surface[500]}
                  style={styles.inputIcon}
                />
                <Text style={styles.inputDisabledText}>{profile.email || 'Not set'}</Text>
              </View>
              <Text style={styles.inputHint}>Email cannot be changed here</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    color: '#0f172a',
  },
  saveButton: {
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  scrollContent: {
    padding: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.primary[500],
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    fontSize: 13,
    color: '#64748b',
  },
  formSection: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputDisabled: {
    backgroundColor: '#f8fafc',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    color: '#0f172a',
    fontSize: 16,
  },
  inputDisabledText: {
    flex: 1,
    paddingVertical: 16,
    color: '#64748b',
    fontSize: 16,
  },
  inputHint: {
    fontSize: 12,
    color: '#64748b',
  },
});
