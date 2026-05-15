import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView as DropdownScroll,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SearchInput } from "./Input";
import { Skeleton } from "./LoadingSkeleton";
import { colors, borderRadius } from "../../constants/theme";
import { hapticFeedback } from "../../utils/haptics";
import {
  usePlacesAutocomplete,
  PlacePrediction,
} from "../../hooks/usePlacesAutocomplete";

interface PlacesAutocompleteProps {
  onSelect: (city: string, country: string, placeId?: string) => void;
}

export function PlacesAutocomplete({ onSelect }: PlacesAutocompleteProps) {
  const [query, setQuery] = useState("");
  const { predictions, isLoading, search, clear } = usePlacesAutocomplete();

  const handleChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (text.length === 0) {
        clear();
      } else {
        search(text);
      }
    },
    [search, clear],
  );

  const handleSelect = useCallback(
    (item: PlacePrediction) => {
      hapticFeedback.selection();
      Keyboard.dismiss();
      onSelect(item.city, item.secondary, item.placeId);
      setQuery("");
      clear();
    },
    [onSelect, clear],
  );

  const handleUseAsDestination = useCallback(() => {
    hapticFeedback.selection();
    Keyboard.dismiss();
    onSelect(query.trim(), "");
    setQuery("");
    clear();
  }, [query, onSelect, clear]);

  const showDropdown = query.length >= 2;

  return (
    <View style={styles.wrapper}>
      <SearchInput
        value={query}
        onChangeText={handleChangeText}
        placeholder="Search cities, countries..."
      />

      {showDropdown && (
        <View style={styles.dropdown}>
          {isLoading ? (
            <View style={styles.skeletonContainer}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <Skeleton width={18} height={18} borderRadius={9} />
                  <View style={styles.skeletonText}>
                    <Skeleton width="70%" height={14} />
                    <Skeleton
                      width="50%"
                      height={11}
                      style={{ marginTop: 4 }}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : predictions.length > 0 ? (
            <DropdownScroll
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={styles.list}
            >
              {predictions.map((item) => (
                <TouchableOpacity
                  key={item.placeId}
                  style={styles.row}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="location"
                    size={18}
                    color={colors.primary[400]}
                    style={styles.rowIcon}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.city} numberOfLines={1}>
                      {item.city}
                    </Text>
                    {item.secondary ? (
                      <Text style={styles.secondary} numberOfLines={1}>
                        {item.secondary}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </DropdownScroll>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No cities found</Text>
              <TouchableOpacity
                style={styles.fallbackButton}
                onPress={handleUseAsDestination}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={16}
                  color={colors.primary[400]}
                />
                <Text style={styles.fallbackButtonText}>
                  Use "{query}" as destination
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    zIndex: 50,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: "#ffffff",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    maxHeight: 280,
    overflow: "hidden",
  },
  list: {
    maxHeight: 280,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  rowIcon: {
    marginRight: 12,
  },
  rowText: {
    flex: 1,
  },
  city: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  secondary: {
    fontSize: 13,
    color: colors.surface[400],
    marginTop: 2,
  },
  skeletonContainer: {
    padding: 14,
    gap: 14,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skeletonText: {
    flex: 1,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.surface[400],
  },
  fallbackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#FFF5F4",
    borderRadius: borderRadius.full,
  },
  fallbackButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary[400],
  },
});
