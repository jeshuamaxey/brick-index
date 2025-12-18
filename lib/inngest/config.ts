// Inngest environment configuration

export interface InngestConfig {
  eventKey: string;
  signingKey: string;
  appId?: string;
  env: 'development' | 'production';
}

/**
 * Get Inngest configuration from environment variables
 */
export function getInngestConfig(): InngestConfig {
  const eventKey = process.env.INNGEST_EVENT_KEY;
  const signingKey = process.env.INNGEST_SIGNING_KEY;
  const appId = process.env.INNGEST_APP_ID;
  const env = (process.env.INNGEST_ENV || 'development') as 'development' | 'production';

  if (!eventKey) {
    throw new Error('INNGEST_EVENT_KEY environment variable is required');
  }

  if (!signingKey) {
    throw new Error('INNGEST_SIGNING_KEY environment variable is required');
  }

  return {
    eventKey,
    signingKey,
    appId,
    env,
  };
}

