export function easBunVersionFailures(packageManager, profiles) {
  const version = packageManager?.match(/^bun@(\d+\.\d+\.\d+)$/)?.[1];
  if (!version) return ["Root packageManager must pin an exact Bun version."];
  const failures = [];
  for (const [name, profile] of Object.entries(profiles ?? {})) {
    if (profile?.bun !== version) {
      failures.push(
        `EAS ${name} must explicitly pin bun to ${version}; image defaults may not read the lockfile.`,
      );
    }
    for (const platform of ["ios", "android"]) {
      const override = profile?.[platform]?.bun;
      if (override !== undefined && override !== version) {
        failures.push(`EAS ${name}.${platform}.bun must match ${version}.`);
      }
    }
  }
  return failures;
}
