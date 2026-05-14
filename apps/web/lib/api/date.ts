import { z } from "zod";

export function isValidDateOnly(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function toDateOnlyTime(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
  .refine(isValidDateOnly, "Must be a valid calendar date");

export function addDateRangeIssue(
  ctx: z.RefinementCtx,
  startDate: string,
  endDate: string,
  path: (string | number)[] = ["endDate"],
) {
  if (toDateOnlyTime(endDate) >= toDateOnlyTime(startDate)) return;

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path,
    message: "End date must be on or after start date",
  });
}
