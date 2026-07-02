// src/sentry.config.js
import * as Sentry from '@sentry/vue'

export function initSentry(app, router) {
  const isProd = process.env.NODE_ENV === 'production'

  Sentry.init({
    app,
    dsn: 'https://b1dd4679aec4092992ddea03aee482e6@o4511410274435072.ingest.us.sentry.io/4511410282364928',

    environment: isProd ? 'production' : 'development',

    sendDefaultPii: true,
    integrations: [
      Sentry.browserTracingIntegration({ router }),
      Sentry.replayIntegration()
    ],

    tracesSampleRate: isProd ? 0.3 : 1.0,

    tracePropagationTargets: [
      'localhost',
      /^https:\/\/course\.zzll01\.cn\/api/
    ],

    replaysSessionSampleRate: isProd ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    enableLogs: !isProd,
    debug: !isProd
  })

  return Sentry
}