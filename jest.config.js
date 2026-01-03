module.exports = {
  testEnvironment: 'node',

  // Keep CI runner artifacts out of test discovery.
  testPathIgnorePatterns: ['<rootDir>/actions-runner/'],

  // Prevent haste-map collisions from the runner's checked-out working copy.
  modulePathIgnorePatterns: ['<rootDir>/actions-runner/'],
  watchPathIgnorePatterns: ['<rootDir>/actions-runner/'],

  // One shared in-memory MongoDB instance per Jest invocation.
  globalSetup: '<rootDir>/tests/jest.globalSetup.js',
  globalTeardown: '<rootDir>/tests/jest.globalTeardown.js',

  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js', '<rootDir>/tests/networkController.test.js'],
      setupFiles: ['<rootDir>/tests/jest.env.js'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/jest.env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/test-setup.js'],
    },
  ],
};
