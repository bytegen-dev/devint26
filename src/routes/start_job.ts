import type { Request, Response } from 'express';
import { logError } from '../logger.js';
import { parseInputDataArray } from '../parse_input.js';
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

  const identifier = (body as { identifier_from_purchaser?: unknown }).identifier_from_purchaser;
  const buyerId =
    typeof identifier === 'string' && identifier.trim() ? identifier.trim() : null;
  if (!buyerId) {
    res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'identifier_from_purchaser is required and must be non-empty',
    });
    return;
  }

  const inputData = (body as { input_data?: unknown }).input_data;
  const payload = parseInputDataArray(inputData);
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
    res.status(201).json({
      job_id: id,
      status: 'awaiting_payment',
    });
  } catch (e) {
    logError('start_job failed', e);
    res.status(500).json({
      error: 'JOB_CREATION_FAILED',
      message: 'Internal error',
    });
  }
}
