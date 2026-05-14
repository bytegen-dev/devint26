import type { Request, Response } from 'express';

export function getInputSchema(_req: Request, res: Response): void {
  res.json({
    input_data: [
      {
        id: 'query',
        type: 'string',
        name: 'Search Query',
        data: {
          description: 'Natural language query describing the developers you want to find, or a specific GitHub username',
          placeholder: 'e.g. "Rust blockchain developers" or "bytegen-dev"',
        },
      },
      {
        id: 'location',
        type: 'string',
        name: 'Location',
        data: {
          description: 'Optional geographic filter for the developer search',
          placeholder: 'e.g. Berlin, Lagos, India',
        },
        validations: [
          { validation: 'optional', value: true },
        ],
      },
      {
        id: 'limit',
        type: 'number',
        name: 'Number of Results',
        data: {
          description: 'Number of developer profiles to analyze (1–10)',
          default: 5,
        },
        validations: [
          { validation: 'optional', value: true },
          { validation: 'min', value: 1 },
          { validation: 'max', value: 10 },
        ],
      },
    ],
  });
}
