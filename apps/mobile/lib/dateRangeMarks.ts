import { colors } from '../constants/theme';
import { parseTripDate } from './tripDate';

import { localCalendarDate } from '@faroway/constants';
export { localCalendarDate } from '@faroway/constants';

type MarkedDate = {
  startingDay?: boolean;
  endingDay?: boolean;
  color: string;
  textColor: string;
};

export function getMarkedDates(startDate: string, endDate: string) {
  const marked: Record<string, MarkedDate> = {};
  const accentColor = colors.primary[500];
  const fillColor = 'rgba(249, 112, 102, 0.2)';

  if (startDate && !endDate && !Number.isNaN(parseTripDate(startDate).getTime())) {
    marked[startDate] = {
      startingDay: true,
      endingDay: true,
      color: accentColor,
      textColor: '#fff',
    };
    return marked;
  }

  if (!startDate || !endDate) return marked;

  const start = parseTripDate(startDate);
  const end = parseTripDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return marked;
  const cursor = new Date(start);

  while (cursor <= end) {
    const dateStr = localCalendarDate(cursor);
    const isStart = dateStr === startDate;
    const isEnd = dateStr === endDate;

    marked[dateStr] = {
      color: isStart || isEnd ? accentColor : fillColor,
      textColor: isStart || isEnd ? '#fff' : colors.surface[600],
      startingDay: isStart,
      endingDay: isEnd,
    };

    cursor.setDate(cursor.getDate() + 1);
  }

  return marked;
}
