import type { Request, Response } from 'express';

export function getInputSchema(_req: Request, res: Response): void {
  res.json({
    input_data: [
      {
        id: 'query',
        type: 'STRING',
        name: 'Search Query',
        data: {
          placeholder: 'e.g. "Rust blockchain developers" or "bytegen-dev"',
          description: 'Natural language query describing the developers you want to find, or a specific GitHub username',
        },
        validations: [
          { type: 'FORMAT', value: 'NON_EMPTY' },
        ],
      },
      {
        id: 'location',
        type: 'STRING',
        name: 'Location',
        data: {
          placeholder: 'e.g. Berlin, Lagos, India',
          description: 'Optional geographic filter for the developer search',
        },
        validations: [
          { type: 'OPTIONAL', value: true },
        ],
      },
      {
        id: 'limit',
        type: 'NUMBER',
        name: 'Number of Results',
        data: {
          default: 5,
          description: 'Number of developer profiles to analyze (1–10)',
        },
        validations: [
          { type: 'OPTIONAL', value: true },
          { type: 'MIN', value: 1 },
          { type: 'MAX', value: 10 },
        ],
      },
    ],
  });
}
