/** Preserve currency and pricing basis; never infer USD from a bare amount. */
export function formatPlanningPrice(value: unknown, currency?: unknown, perPerson = false): string {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  const amount = record ? record.amount : value;
  const unit = record ? record.currency : currency;
  if (
    record?.status === 'unknown' ||
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    typeof unit !== 'string' ||
    !/^[A-Z]{3}$/.test(unit)
  )
    return 'Price unavailable';
  return `Est. ${unit} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}${perPerson || record?.perPerson ? ' /pp' : ''}`;
}

export function formatPlanningDuration(minutes: unknown): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0)
    return 'Duration unavailable';
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${rounded}m`;
}
