// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    // Sample 20% of transactions in production (adjust as needed)
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Do not send PII (IP addresses, cookies, user data) by default.
    // Use Sentry.setUser() explicitly where needed.
    sendDefaultPii: false,
  });
}
