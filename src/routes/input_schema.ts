import type { Request, Response } from 'express';

export function getInputSchema(_req: Request, res: Response): void {
  res.json({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['input_data', 'identifier_from_purchaser'],
    properties: {
      input_data: {
        type: 'array',
        description: 'query (required), location (optional), limit 1–10 (default 5)',
        items: {
          type: 'object',
          required: ['key', 'value'],
          properties: {
            key: { type: 'string', enum: ['query', 'location', 'limit'] },
            value: { type: 'string' },
          },
        },
      },
      identifier_from_purchaser: {
        type: 'string',
        minLength: 1,
        description: 'Buyer id; same value purchaser uses for input/output hash preimages',
      },
    },
  });
}
