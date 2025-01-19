import type { Config } from '@jest/types'; // @jest/types@^29.5.0

const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set jsdom as the test environment for DOM manipulation
  testEnvironment: 'jsdom',

  // Setup files to run after the test environment is setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Module name mapping for path aliases and static assets
  moduleNameMapper: {
    // Path aliases matching tsconfig paths
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@assets/(.*)$': '<rootDir>/src/assets/$1',

    // Static asset mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/mocks/fileMock.ts'
  },

  // Transform configuration for TypeScript and SVG files
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.svg$': '<rootDir>/tests/mocks/svgTransform.ts'
  },

  // Test file patterns
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Coverage collection configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/vite-env.d.ts',
    '!src/main.tsx'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Paths to ignore during testing
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Watch plugins for better testing experience
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};

export default config;