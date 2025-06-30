module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  testPathIgnorePatterns: [
    '/__tests__/setup.js'
  ],
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js']
};