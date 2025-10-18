import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: 1.0, // Adjust this value in production, or use tracesSampler for greater control
  
  // Debugging and Diagnostics
  debug: process.env.NODE_ENV === 'development',
  environment: process.env.NODE_ENV || 'development',
  
  // Performance Monitoring
  _experiments: {
    // Enable span timing for better performance insights
    enableTracing: true,
  },

  // Before sending event
  beforeSend(event) {
    // Don't send events if DSN is not set
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return null;
    }
    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Add any specific errors to ignore here
  ]
});