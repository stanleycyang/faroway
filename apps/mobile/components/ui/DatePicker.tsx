import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from "react-native";
import { CalendarList, DateData } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { colors, borderRadius } from "../../constants/theme";
import { hapticFeedback } from "../../utils/haptics";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

type SelectionMode = "start" | "end";

const TODAY = new Date().toISOString().split("T")[0];

function getMarkedDates(
  startDate: string,
  endDate: string,
  selectionMode: SelectionMode,
) {
  const marked: Record<string, any> = {};
  const accentColor = colors.primary[500];
  const fillColor = "rgba(249, 112, 102, 0.2)";

  if (startDate && !endDate) {
    marked[startDate] = {
      startingDay: true,
      endingDay: true,
      color: accentColor,
      textColor: "#fff",
    };
    return marked;
  }

  if (!startDate || !endDate) return marked;

  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const cursor = new Date(start);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().split("T")[0];
    const isStart = dateStr === startDate;
    const isEnd = dateStr === endDate;

    marked[dateStr] = {
      color: isStart || isEnd ? accentColor : fillColor,
      textColor: isStart || isEnd ? "#fff" : colors.surface[600],
      startingDay: isStart,
      endingDay: isEnd,
    };

    cursor.setDate(cursor.getDate() + 1);
  }

  return marked;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("start");

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "Select date";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const markedDates = useMemo(
    () => getMarkedDates(startDate, endDate, selectionMode),
    [startDate, endDate, selectionMode],
  );

  const onDayPress = useCallback(
    (day: DateData) => {
      hapticFeedback.selection();
      const picked = day.dateString;

      if (selectionMode === "start") {
        onStartDateChange(picked);
        if (endDate && picked > endDate) {
          onEndDateChange("");
        }
        setSelectionMode("end");
      } else {
        if (picked < startDate) {
          // Picked before start — swap: new start = picked, new end = old start
          onStartDateChange(picked);
          onEndDateChange(startDate);
        } else {
          onEndDateChange(picked);
        }
        setSelectionMode("start");
      }
    },
    [selectionMode, startDate, endDate, onStartDateChange, onEndDateChange],
  );

  const openPicker = (mode: SelectionMode) => {
    setSelectionMode(mode);
    setShowPicker(true);
    hapticFeedback.light();
  };

  const closePicker = () => {
    if (startDate && endDate) {
      hapticFeedback.success();
    }
    setShowPicker(false);
  };

  const calendarTheme = useMemo(
    () => ({
      calendarBackground: "#ffffff",
      dayTextColor: "#0f172a",
      monthTextColor: "#0f172a",
      textMonthFontSize: 18,
      textMonthFontWeight: "600" as const,
      todayTextColor: colors.primary[400],
      textDisabledColor: colors.surface[600],
      textSectionTitleColor: colors.surface[400],
      textDayHeaderFontSize: 12,
      textDayHeaderFontWeight: "600" as const,
      "stylesheet.calendar.header": {
        dayTextAtIndex0: { color: colors.surface[400] },
        dayTextAtIndex1: { color: colors.surface[400] },
        dayTextAtIndex2: { color: colors.surface[400] },
        dayTextAtIndex3: { color: colors.surface[400] },
        dayTextAtIndex4: { color: colors.surface[400] },
        dayTextAtIndex5: { color: colors.surface[400] },
        dayTextAtIndex6: { color: colors.surface[400] },
      },
    }),
    [],
  );

  // Scroll to the start date's month, or today if no start date
  const initialDate = startDate || TODAY;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>When are you traveling?</Text>
      <View style={styles.dateButtons}>
        <TouchableOpacity
          style={[
            styles.dateButton,
            selectionMode === "start" && showPicker && styles.dateButtonActive,
          ]}
          onPress={() => openPicker("start")}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={colors.primary[400]}
          />
          <View style={styles.dateButtonText}>
            <Text style={styles.dateLabel}>Start</Text>
            <Text style={styles.dateValue}>{formatDisplayDate(startDate)}</Text>
          </View>
        </TouchableOpacity>

        <Ionicons name="arrow-forward" size={20} color={colors.surface[600]} />

        <TouchableOpacity
          style={[
            styles.dateButton,
            selectionMode === "end" && showPicker && styles.dateButtonActive,
          ]}
          onPress={() => openPicker("end")}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={colors.primary[400]}
          />
          <View style={styles.dateButtonText}>
            <Text style={styles.dateLabel}>End</Text>
            <Text style={styles.dateValue}>{formatDisplayDate(endDate)}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Drag handle */}
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </View>

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Dates</Text>
              <TouchableOpacity onPress={closePicker}>
                <Ionicons name="close" size={24} color={colors.surface[400]} />
              </TouchableOpacity>
            </View>

            {/* Date summary chips */}
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  selectionMode === "start" && styles.chipActive,
                ]}
                onPress={() => setSelectionMode("start")}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    selectionMode === "start" && styles.chipLabelActive,
                  ]}
                >
                  Start
                </Text>
                <Text
                  style={[
                    styles.chipDate,
                    selectionMode === "start" && styles.chipDateActive,
                  ]}
                >
                  {startDate ? formatDisplayDate(startDate) : "Pick a date"}
                </Text>
              </TouchableOpacity>

              <Ionicons
                name="arrow-forward"
                size={16}
                color={colors.surface[600]}
              />

              <TouchableOpacity
                style={[
                  styles.chip,
                  selectionMode === "end" && styles.chipActive,
                ]}
                onPress={() => setSelectionMode("end")}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    selectionMode === "end" && styles.chipLabelActive,
                  ]}
                >
                  End
                </Text>
                <Text
                  style={[
                    styles.chipDate,
                    selectionMode === "end" && styles.chipDateActive,
                  ]}
                >
                  {endDate ? formatDisplayDate(endDate) : "Pick a date"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Calendar */}
            <CalendarList
              current={initialDate}
              minDate={TODAY}
              pastScrollRange={0}
              futureScrollRange={12}
              scrollEnabled
              showScrollIndicator={false}
              markingType="period"
              markedDates={markedDates}
              onDayPress={onDayPress}
              theme={calendarTheme}
              calendarStyle={styles.calendar}
            />

            {/* Done button */}
            {startDate && endDate ? (
              <View style={styles.doneContainer}>
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={closePicker}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  dateButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  dateButtonActive: {
    borderColor: colors.primary[500],
    backgroundColor: "#FFF5F4",
  },
  dateButtonText: {
    marginLeft: 12,
  },
  dateLabel: {
    fontSize: 12,
    color: colors.surface[400],
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    height: SCREEN_HEIGHT * 0.9,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderBottomWidth: 0,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface[300],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  chipActive: {
    borderColor: colors.primary[500],
    backgroundColor: "#FFF5F4",
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.surface[400],
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipLabelActive: {
    color: colors.primary[400],
  },
  chipDate: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.surface[600],
  },
  chipDateActive: {
    color: colors.primary[600],
  },
  calendar: {
    backgroundColor: "#ffffff",
  },
  doneContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  doneButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
