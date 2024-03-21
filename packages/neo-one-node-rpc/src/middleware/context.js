/* @flow */
import type { Context } from 'koa';
import type { Monitor } from '@neo-one/monitor';

import { getMonitor } from './common';

export default ({ monitor }: {| monitor: Monitor |}) => async (
  ctx: Context,
  next: () => Promise<void>,
) => {
  await monitor.forContext(ctx).captureSpanLog(
    async span => {
      try {
        ctx.state.monitor = span;
        await next();
      } finally {
        span.setLabels({ [monitor.labels.HTTP_STATUS_CODE]: ctx.status });
      }
    },
    {
      name: 'http_server_request',
      level: { log: 'verbose', metric: 'info', span: 'info' },
      labelNames: [
        monitor.labels.HTTP_PATH,
        monitor.labels.HTTP_STATUS_CODE,
        monitor.labels.HTTP_METHOD,
      ],
      references: [
        monitor.childOf(monitor.extract(monitor.formats.HTTP, ctx.headers)),
      ],
    },
  );
};

export const onError = ({ monitor: monitorIn }: {| monitor: Monitor |}) => (
  error: Error,
  ctx?: Context,
) => {
  let monitor = monitorIn;
  if (ctx != null) {
    try {
      monitor = getMonitor(ctx);
    } catch (err) {
      // Ignore errors
    }
  }

  monitor.logError({
    name: 'http_server_request_uncaught_error',
    message: 'Unexpected uncaught request error.',
    error,
  });
};
