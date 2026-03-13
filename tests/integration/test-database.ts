// Shared test database configuration
// Integration tests MUST use a separate database to avoid wiping development data
export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://app:secret@localhost:5432/app_test'
