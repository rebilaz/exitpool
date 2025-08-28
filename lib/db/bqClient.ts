import { BigQuery } from '@google-cloud/bigquery';
import config from '../config';
import logger from '../logger';

declare global {
  // eslint-disable-next-line no-var
  var __bq: BigQuery | undefined;
}

/** Get a singleton BigQuery client */
export function getBigQuery(): BigQuery {
  if (!global.__bq) {
    logger.info('Initializing BigQuery client', { location: config.bq.location });
    global.__bq = new BigQuery({
      projectId: config.projectId,
      location: config.bq.location,
      ...(config.credentials?.keyFilename ? { keyFilename: config.credentials.keyFilename } : {}),
      ...(config.credentials?.keyJsonObject ? { credentials: config.credentials.keyJsonObject as any } : {}),
    });
  }
  return global.__bq;
}

export default getBigQuery;
