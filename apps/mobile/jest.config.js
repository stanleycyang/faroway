/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Leave capacity for the web suite when Turbo runs both test tasks.
  maxWorkers: 2,
  roots: ['<rootDir>/__tests__'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@faroway/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@faroway/constants$': '<rootDir>/../../packages/constants/src/index.ts',
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
};
