import { mapPool } from '../lib/concurrency.js';
import { mipHashInputHex, mipHashOutputHex } from '../lib/hash.js';
import { logError } from '../logger.js';
import { parseInputData } from '../parse_input.js';
import { prisma } from '../db.js';
import { fetchUserBundle, searchUsers, type UserGithubBundle } from './github.js';
import {
  generateDeveloperReport,
  parseQueryToGithubSearch,
  type DeveloperReport,
} from './intelligence.js';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} is not set`);
  }
  return v;
}

export async function createJobRecord(args: {
  buyerId: string;
  inputDataJson: unknown;
}): Promise<{ id: string; inputHash: string }> {
  const inputHash = mipHashInputHex(args.buyerId, args.inputDataJson);
  const job = await prisma.job.create({
    data: {
      status: 'running',
      buyerId: args.buyerId,
      inputData: args.inputDataJson as object,
      inputHash,
    },
  });
  return { id: job.id, inputHash };
}

async function markRunning(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'running' },
  });
}

async function markFailed(jobId: string, message: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      errorMessage: message.slice(0, 4000),
      completedAt: new Date(),
    },
  });
}

async function safeMarkFailed(jobId: string, message: string): Promise<void> {
  try {
    await markFailed(jobId, message);
  } catch (e) {
    logError('persist job failed state', e, { jobId });
  }
}

function bundleForPrompt(bundle: UserGithubBundle): string {
  return JSON.stringify({
    profile: bundle.profile,
    repos: bundle.repos.map((r) => ({
      name: r.name,
      description: r.description,
      language: r.language,
      stargazers_count: r.stargazers_count,
      forks_count: r.forks_count,
      pushed_at: r.pushed_at,
      html_url: r.html_url,
      topics: r.topics,
    })),
    events: bundle.events.map((e) => ({
      type: e.type,
      created_at: e.created_at,
      repo: e.repo,
    })),
  });
}

function bundleFetchConcurrency(): number {
  const n = Number(process.env.GITHUB_BUNDLE_CONCURRENCY);
  if (Number.isFinite(n) && n >= 1) {
    return Math.min(Math.floor(n), 10);
  }
  return 4;
}

function reportConcurrency(): number {
  const n = Number(process.env.ANTHROPIC_REPORT_CONCURRENCY);
  if (Number.isFinite(n) && n >= 1) {
    return Math.min(Math.floor(n), 10);
  }
  return 3;
}

export function runPipeline(jobId: string): void {
  void (async () => {
    try {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        logError('runPipeline missing job', new Error(`not found: ${jobId}`));
        return;
      }

      const payload = parseInputData(job.inputData);
      if (!payload) {
        await safeMarkFailed(jobId, 'Stored input_data is invalid or missing query');
        return;
      }

      const buyerId = job.buyerId;
      const token = requireEnv('GITHUB_TOKEN');
      await markRunning(jobId);

      const searchQuery = await parseQueryToGithubSearch(payload.query, payload.location);
      const users = await searchUsers(token, searchQuery, payload.limit);
      const logins = users.map((u) => u.login).slice(0, payload.limit);

      const bundleConc = bundleFetchConcurrency();
      const bundles = await mapPool(logins, bundleConc, (login) =>
        fetchUserBundle(token, login),
      );

      const reportConc = reportConcurrency();
      const reports = await mapPool(logins, reportConc, async (login, i) =>
        generateDeveloperReport(login, bundleForPrompt(bundles[i]!)),
      );

      const output: { reports: DeveloperReport[] } = { reports };
      const outputHash = mipHashOutputHex(buyerId, output);

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          outputData: output as object,
          outputHash,
          completedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await safeMarkFailed(jobId, message);
    }
  })();
}
