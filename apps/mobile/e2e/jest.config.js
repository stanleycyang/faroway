module.exports = {
  testEnvironment: "node",
  testTimeout: 180000,
  reporters: ["detox/runners/jest/reporter"],
  testRunner: "jest-circus/runner",
  setupFilesAfterEnv: ["<rootDir>/init.ts"],
  testMatch: ["<rootDir>/**/*.e2e.ts"],
  verbose: true,
};
