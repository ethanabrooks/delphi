/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    target: 'node14',
    jsx: 'automatic',
  },
  define: {
    'process.env.NODE_ENV': '"test"',
  },
  test: {
    // Test environment for React Native testing
    environment: 'jsdom',

    // Setup files
    setupFiles: ['./vitest.setup.ts'],

    // Test file patterns
    include: [
      '**/__tests__/**/*.{ts,tsx,js,jsx}',
      '**/?(*.)+(spec|test).{ts,tsx,js,jsx}',
    ],

    // Coverage configuration
    coverage: {
      enabled: true,
      provider: 'v8',
      include: [
        'components/**/*.{ts,tsx}',
        'stores/**/*.{ts,tsx}',
        'services/**/*.{ts,tsx}',
        'db/**/*.{ts,tsx}',
        'types/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        '**/coverage/**',
        '**/__tests__/**',
      ],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
    },

    // Clear mocks between tests
    clearMocks: true,
    restoreMocks: true,

    // Globals (optional - enables Jest-like global functions)
    globals: true,
  },

  resolve: {
    alias: {
      '@': '.',
      '@components': './components',
      '@services': './services',
      '@stores': './stores',
      '@types': './types',
      '@db': './db',
    },
  },
})