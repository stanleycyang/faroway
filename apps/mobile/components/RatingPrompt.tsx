import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import * as StoreReview from "expo-store-review";
import { usePromptStore } from "../stores/promptStore";
import { colors, borderRadius, shadows } from "../constants/theme";

interface RatingPromptProps {
  visible: boolean;
  tripCount?: number;
  onClose: () => void;
}

export function RatingPrompt({
  visible,
  tripCount,
  onClose,
}: RatingPromptProps) {
  const { markRatingPrompted, markRated } = usePromptStore();

  const handleRate = async () => {
    markRated();
    onClose();
    const available = await StoreReview.isAvailableAsync();
    if (available) {
      await StoreReview.requestReview();
    }
  };

  const handleMaybeLater = () => {
    markRatingPrompted();
    onClose();
  };

  const handleDontAskAgain = () => {
    markRated();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.bottomSheet}>
          {/* Handle */}
          <View style={styles.handle} />

          <View style={styles.content}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.emoji}>⭐</Text>
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.title}>Enjoying Faroway?</Text>
            <Text style={styles.subtitle}>
              {tripCount && tripCount > 1
                ? `You've planned ${tripCount} trips with us!`
                : "We'd love to hear what you think"}
            </Text>

            {/* Rate Button */}
            <TouchableOpacity
              style={styles.rateButton}
              onPress={handleRate}
              activeOpacity={0.9}
            >
              <Text style={styles.rateButtonText}>Rate on App Store</Text>
            </TouchableOpacity>

            {/* Maybe Later */}
            <TouchableOpacity
              style={styles.maybeLaterButton}
              onPress={handleMaybeLater}
            >
              <Text style={styles.maybeLaterText}>Maybe Later</Text>
            </TouchableOpacity>

            {/* Don't Ask Again */}
            <TouchableOpacity
              style={styles.dontAskButton}
              onPress={handleDontAskAgain}
            >
              <Text style={styles.dontAskText}>Don't Ask Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: colors.surface[800],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    ...shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.surface[600],
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(245,158,11,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.surface[400],
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  rateButton: {
    width: "100%",
    backgroundColor: colors.primary[500],
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    marginBottom: 12,
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  maybeLaterButton: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  maybeLaterText: {
    fontSize: 15,
    color: colors.surface[500],
    fontWeight: "600",
  },
  dontAskButton: {
    paddingVertical: 8,
  },
  dontAskText: {
    fontSize: 13,
    color: colors.surface[600],
    fontWeight: "500",
  },
});
