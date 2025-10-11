/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@stores/(.*)$': '<rootDir>/stores/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@db/(.*)$': '<rootDir>/db/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|react-clone-referenced-element|@expo|expo(nent)?|@expo/.*|expo-.*|@unimodules/.*|unimodules|sentry-expo|native-base|@tamagui|tamagui)',
  ],
  reporters: ['default'],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'stores/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'db/**/*.{ts,tsx}',
    'types/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
