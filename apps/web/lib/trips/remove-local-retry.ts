/** Local removal only; this does not cancel or roll back a saved server change. */
export function removeLocalRetry(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
