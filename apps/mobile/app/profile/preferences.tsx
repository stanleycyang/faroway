import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { VibeSelector } from "../../components/ui";
import { useUserStore } from "../../stores/userStore";
import { updateUserProfile } from "../../services/api";
import { colors, borderRadius } from "../../constants/theme";
import { hapticFeedback } from "../../utils/haptics";

const budgetOptions = [
  {
    id: "budget",
    label: "Budget",
    emoji: "💰",
    description: "Best value deals",
  },
  {
    id: "moderate",
    label: "Moderate",
    emoji: "💵",
    description: "Balance of comfort & cost",
  },
  {
    id: "luxury",
    label: "Luxury",
    emoji: "✨",
    description: "Premium experiences",
  },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const { user, updatePreferences } = useUserStore();
  const [selectedVibes, setSelectedVibes] = useState<string[]>(
    user?.preferences?.vibes || [],
  );
  const [selectedBudget, setSelectedBudget] = useState<string>(
    user?.preferences?.budget || "",
  );
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    updatePreferences({ vibes: selectedVibes, budget: selectedBudget });
    // Persist to backend
    updateUserProfile({
      preferences: { vibes: selectedVibes, budget: selectedBudget },
    });
    hapticFeedback.success();
    setSaved(true);
    setTimeout(() => router.back(), 600);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={"#475569"} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Travel Preferences</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>
            {saved ? "✓ Saved" : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Vibes */}
        <View style={styles.section}>
          <VibeSelector
            selected={selectedVibes}
            onSelect={setSelectedVibes}
            maxSelections={5}
          />
        </View>

        {/* Budget */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Budget</Text>
          <View style={styles.budgetOptions}>
            {budgetOptions.map((option) => {
              const isSelected = selectedBudget === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.budgetOption,
                    isSelected && styles.budgetOptionSelected,
                  ]}
                  onPress={() => {
                    hapticFeedback.selection();
                    setSelectedBudget(option.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.budgetEmoji}>{option.emoji}</Text>
                  <View style={styles.budgetContent}>
                    <Text
                      style={[
                        styles.budgetLabel,
                        isSelected && styles.budgetLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.budgetDescription}>
                      {option.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.primary[500]}
                    />
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
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
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
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 16,
  },
  budgetOptions: {
    gap: 12,
  },
  budgetOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: "transparent",
  },
  budgetOptionSelected: {
    backgroundColor: "#FFF5F4",
    borderColor: colors.primary[500],
  },
  budgetEmoji: {
    fontSize: 28,
    marginRight: 16,
  },
  budgetContent: {
    flex: 1,
  },
  budgetLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  budgetLabelSelected: {
    color: colors.primary[400],
  },
  budgetDescription: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
});
