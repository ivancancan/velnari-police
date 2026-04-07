import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const customConfig: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^maplibre-gl$': '<rootDir>/src/__mocks__/maplibre-gl.ts',
    '^react-map-gl/maplibre$': '<rootDir>/src/__mocks__/react-map-gl.tsx',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
};

export default createJestConfig(customConfig);
