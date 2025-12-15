// Shared test utilities and helper functions

/**
 * Waits for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a test date that's consistent across test runs
 */
export function createTestDate(offsetDays = 0): Date {
  const date = new Date('2025-01-01T00:00:00Z');
  date.setDate(date.getDate() + offsetDays);
  return date;
}

