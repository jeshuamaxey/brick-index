// Inngest client initialization

import { Inngest } from 'inngest';
import { getInngestConfig } from './config';

/**
 * Initialize Inngest client
 * 
 * In development, this connects to the local Inngest dev server.
 * In production, this connects to Inngest cloud.
 */
export const inngest = new Inngest({
  id: process.env.INNGEST_APP_ID || 'bricks-pipeline',
  name: 'Bricks Pipeline',
  eventKey: getInngestConfig().eventKey,
});
