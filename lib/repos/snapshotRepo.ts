import getBigQuery from '../db/bqClient';
import config from '../config';
import logger from '../logger';

export interface PortfolioSnapshot {
  user_id: string;
  date: Date;
  total_value: number;
  breakdown: Record<string, { quantity: number; value: number; price: number }>;
}

export interface SaveSnapshotData {
  date: Date;
  totalValue: number;
  breakdown: Record<string, { quantity: number; value: number; price: number }>;
}

/**
 * Repository pour les snapshots de portefeuille (cache)
 * Sert à accélérer les calculs d'historique
 */
export class SnapshotRepo {
  private dataset = 'Cryptopilot';
  
  /**
   * Récupérer les snapshots d'un utilisateur sur une période
   */
  async getSnapshotsByUser(userId: string, range: '7d' | '30d' | '1y'): Promise<PortfolioSnapshot[]> {
    const bq = getBigQuery();
    
    // Calculer la date de début selon le range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }
    
    const query = `
      SELECT 
        user_id,
        date,
        total_value,
        breakdown
      FROM \`${config.projectId}.${this.dataset}.portfolio_snapshots\`
      WHERE user_id = @userId 
        AND date >= @startDate 
        AND date <= @endDate
      ORDER BY date ASC
    `;
    
    const params = { 
      userId, 
      startDate: startDate.toISOString().split('T')[0], // Format YYYY-MM-DD
      endDate: endDate.toISOString().split('T')[0]
    };
    
    logger.info('Fetching portfolio snapshots', { userId, range, startDate, endDate });
    
    const [job] = await bq.createQueryJob({ query, params });
    const [rows] = await job.getQueryResults();
    
    const snapshots: PortfolioSnapshot[] = rows.map((row: any) => ({
      user_id: row.user_id,
      date: new Date(row.date),
      total_value: parseFloat(row.total_value),
      breakdown: JSON.parse(row.breakdown)
    }));
    
    logger.info('Portfolio snapshots fetched', { userId, range, snapshotsCount: snapshots.length });
    return snapshots;
  }
  
  /**
   * Sauvegarder un snapshot de portefeuille
   */
  async saveSnapshot(userId: string, data: SaveSnapshotData): Promise<void> {
    const bq = getBigQuery();
    
    const query = `
      MERGE \`${config.projectId}.${this.dataset}.portfolio_snapshots\` AS target
      USING (
        SELECT 
          @userId as user_id,
          @date as date,
          @totalValue as total_value,
          @breakdown as breakdown
      ) AS source
      ON target.user_id = source.user_id AND target.date = source.date
      WHEN MATCHED THEN
        UPDATE SET 
          total_value = source.total_value,
          breakdown = source.breakdown
      WHEN NOT MATCHED THEN
        INSERT (user_id, date, total_value, breakdown)
        VALUES (source.user_id, source.date, source.total_value, source.breakdown)
    `;
    
    const params = {
      userId,
      date: data.date.toISOString().split('T')[0],
      totalValue: data.totalValue,
      breakdown: JSON.stringify(data.breakdown)
    };
    
    logger.info('Saving portfolio snapshot', { userId, date: params.date, totalValue: data.totalValue });
    
    const [job] = await bq.createQueryJob({ query, params });
    await job.getQueryResults();
    
    logger.info('Portfolio snapshot saved', { userId, date: params.date });
  }
  
  /**
   * Récupérer un snapshot spécifique pour une date donnée
   */
  async getSnapshotByDate(userId: string, date: Date): Promise<PortfolioSnapshot | null> {
    const bq = getBigQuery();
    
    const query = `
      SELECT user_id, date, total_value, breakdown
      FROM \`${config.projectId}.${this.dataset}.portfolio_snapshots\`
      WHERE user_id = @userId AND date = @date
      LIMIT 1
    `;
    
    const params = {
      userId,
      date: date.toISOString().split('T')[0] // YYYY-MM-DD format
    };
    
    const [job] = await bq.createQueryJob({ query, params });
    const [rows] = await job.getQueryResults();
    
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      user_id: row.user_id,
      date: new Date(row.date.value),
      total_value: parseFloat(row.total_value),
      breakdown: JSON.parse(row.breakdown)
    };
  }
  
  /**
   * Supprimer les snapshots après une date donnée
   * Utile quand on ajoute une transaction dans le passé
   */
  async deleteSnapshotsAfterDate(userId: string, date: Date): Promise<void> {
    const bq = getBigQuery();
    
    const query = `
      DELETE FROM \`${config.projectId}.${this.dataset}.portfolio_snapshots\`
      WHERE user_id = @userId AND date > @date
    `;
    
    const params = {
      userId,
      date: date.toISOString().split('T')[0]
    };
    
    logger.info('Deleting snapshots after date', { userId, date: params.date });
    
    const [job] = await bq.createQueryJob({ query, params });
    await job.getQueryResults();
    
    logger.info('Snapshots deleted after date', { userId, date: params.date });
  }
}

// Instance singleton
export const snapshotRepo = new SnapshotRepo();
export default snapshotRepo;
