const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const monorepoRoot = path.resolve(__dirname, "../..");
const config = getDefaultConfig(__dirname);

// Watch the monorepo root for changes in shared packages
config.watchFolders = [monorepoRoot];

// Resolve modules from both the app's node_modules and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Ensure Metro follows symlinks (required for Bun workspace symlink layout)
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
