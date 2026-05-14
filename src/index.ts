import 'dotenv/config';
import express from 'express';
import { prisma } from './db.js';
import { getAvailability } from './routes/availability.js';
import { getInputSchema } from './routes/input_schema.js';
import { getStatus } from './routes/status.js';
import { postStartJob } from './routes/start_job.js';
import { logError, logInfo } from './logger.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/availability', (req, res, next) => {
  void getAvailability(req, res).catch(next);
});
app.get('/input_schema', getInputSchema);
app.get('/status', (req, res, next) => {
  void getStatus(req, res).catch(next);
});
app.post('/start_job', (req, res, next) => {
  void postStartJob(req, res).catch(next);
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logError('Unhandled request error', err);
    res.status(500).json({
      error: 'INTERNAL',
      message: 'Internal error',
    });
  },
);

const port = Number(process.env.PORT) || 3030;
const server = app.listen(port, () => {
  logInfo(`listening on http://localhost:${port}`);
});

function shutdown(signal: NodeJS.Signals) {
  logInfo(`${signal} received, closing`);
  server.close((closeErr) => {
    if (closeErr) {
      logError('http close', closeErr);
    }
    void prisma
      .$disconnect()
      .then(() => process.exit(closeErr ? 1 : 0))
      .catch((e) => {
        logError('prisma disconnect', e);
        process.exit(1);
      });
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
