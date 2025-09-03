import { BigQuery } from '@google-cloud/bigquery';
import logger from '../logger';

// Déclaration globale pour garder une seule instance
declare global {
  // eslint-disable-next-line no-var
  var __bq: BigQuery | undefined;
}

// Typage simple pour tes credentials
interface GcpConfig {
  projectId: string;
  location?: string;
  credentials?: {
    keyFilename?: string;         // chemin fichier (local)
    keyJsonObject?: Record<string, any>; // JSON objet (Vercel)
  };
}

/** Récupère la config depuis tes envs */
function getConfig(): GcpConfig {
  const projectId = process.env.GCP_PROJECT_ID || '';
  const location = process.env.BQ_LOCATION || 'US';

  // Cas 1: fichier (local)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return {
      projectId,
      location,
      credentials: { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS },
    };
  }

  // Cas 2: JSON inline
  if (process.env.GCP_SERVICE_ACCOUNT_JSON) {
    return {
      projectId,
      location,
      credentials: { keyJsonObject: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON) },
    };
  }

  // Cas 3: JSON base64
  if (process.env.GCP_SERVICE_ACCOUNT_BASE64) {
    const decoded = Buffer.from(process.env.GCP_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    return {
      projectId,
      location,
      credentials: { keyJsonObject: JSON.parse(decoded) },
    };
  }

  throw new Error('Aucun identifiant GCP trouvé. Configure soit GOOGLE_APPLICATION_CREDENTIALS (fichier), soit GCP_SERVICE_ACCOUNT_JSON, soit GCP_SERVICE_ACCOUNT_BASE64.');
}

/** Singleton BigQuery client */
export function getBigQuery(): BigQuery {
  if (!global.__bq) {
    const config = getConfig();
    logger.info('Initializing BigQuery client', {
      projectId: config.projectId,
      location: config.location,
      from: config.credentials?.keyFilename ? 'file' : 'env',
    });

    global.__bq = new BigQuery({
      projectId: config.projectId,
      location: config.location,
      ...(config.credentials?.keyFilename
        ? { keyFilename: config.credentials.keyFilename }
        : {}),
      ...(config.credentials?.keyJsonObject
        ? { credentials: config.credentials.keyJsonObject as any }
        : {}),
    });
  }
  return global.__bq;
}

export default getBigQuery;
