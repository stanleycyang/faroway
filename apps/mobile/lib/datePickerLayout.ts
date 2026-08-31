export function getDatePickerModalHeight(viewportHeight: number): number {
  const availableHeight = Math.max(0, viewportHeight - 8);
  const preferredHeight = Math.max(320, viewportHeight * 0.82);
  return Math.min(680, availableHeight, preferredHeight);
}
