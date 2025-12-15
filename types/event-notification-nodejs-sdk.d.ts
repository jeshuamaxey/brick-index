declare module 'event-notification-nodejs-sdk' {
  export class EventNotificationSDK {
    // The actual SDK surface is JavaScript-only; we treat it as opaque.
    constructor(config: unknown);
    verifyNotification(req: unknown): Promise<boolean>;
  }
}


