import * as Haptics from 'expo-haptics';

function fireHaptic(trigger: () => Promise<void> | void): void {
  try {
    void Promise.resolve(trigger()).catch(() => {});
  } catch {
    // Ignore haptic failures on unsupported devices or simulators.
  }
}

export const hapticFeedback = {
  light: () => {
    fireHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  medium: () => {
    fireHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  heavy: () => {
    fireHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
  success: () => {
    fireHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning: () => {
    fireHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  error: () => {
    fireHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
  selection: () => {
    fireHaptic(() => Haptics.selectionAsync());
  },
};
