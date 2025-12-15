declare module 'event-notification-nodejs-sdk' {
  // We model the SDK as a namespace of static helpers, matching the official example:
  // https://github.com/eBay/event-notification-nodejs-sdk/blob/main/examples/example.js
  export interface EbayNotificationConfig {
    [key: string]: unknown;
  }

  export function process(
    payload: unknown,
    signature: string,
    config: EbayNotificationConfig,
    environment: string
  ): Promise<number>;

  export function validateEndpoint(
    challengeCode: string,
    config: EbayNotificationConfig
  ): string;
}

