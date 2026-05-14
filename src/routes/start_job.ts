import type { Request, Response } from 'express';
import { logError } from '../logger.js';
import { parseInputData } from '../parse_input.js';
import { createJobRecord, runPipeline } from '../services/job.js';

export async function postStartJob(req: Request, res: Response): Promise<void> {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Request body is required',
    });
    return;
  }

  const identifier =
    (body as Record<string, unknown>).identifier_from_purchaser ??
    (body as Record<string, unknown>).identifierFromPurchaser;
  const buyerId =
    typeof identifier === 'string' && identifier.trim() ? identifier.trim() : 'anonymous';

  const inputData = (body as { input_data?: unknown }).input_data;
  const payload = parseInputData(inputData);
  if (!payload) {
    res.status(400).json({
      error: 'INVALID_INPUT',
      message: "Field 'query' is required in input_data",
    });
    return;
  }

  try {
    const { id } = await createJobRecord({ buyerId, inputDataJson: inputData });
    runPipeline(id);
    res.status(201).json({ job_id: id, id });
  } catch (e) {
    logError('start_job failed', e);
    res.status(500).json({
      error: 'JOB_CREATION_FAILED',
      message: 'Internal error',
    });
  }
}
