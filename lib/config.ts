import { z } from 'zod';
import { Config } from './types';

const envSchema = z.object({
  GOOGLE_PROJECT_ID: z.string().min(1),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  BQ_KEY_JSON: z.string().optional(),
  BQ_TOKENS_DATASET: z.string().default('Cryptopilot'),
  BQ_TOKENS_TABLE: z.string().default('tokens'),
  BQ_LOCATION: z.string().default('US'),
  DEFILLAMA_BASE: z.string().default('https://coins.llama.fi'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Fail hard at module load – surfaces config issues early
  console.error('Config validation error', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

const env = parsed.data;

let keyJsonObject: Record<string, unknown> | undefined;
if (!env.GOOGLE_APPLICATION_CREDENTIALS && env.BQ_KEY_JSON) {
  try {
    keyJsonObject = JSON.parse(env.BQ_KEY_JSON);
  } catch (e) {
    throw new Error('BQ_KEY_JSON is not valid JSON');
  }
}

export const config: Config = {
  projectId: env.GOOGLE_PROJECT_ID,
  bq: {
    dataset: env.BQ_TOKENS_DATASET,
    table: env.BQ_TOKENS_TABLE,
    location: env.BQ_LOCATION,
  },
  credentials: env.GOOGLE_APPLICATION_CREDENTIALS
    ? { keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS }
    : keyJsonObject
    ? { keyJsonObject }
    : undefined,
  defillamaBase: env.DEFILLAMA_BASE,
};

export default config;
