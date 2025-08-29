import { getDefiLlamaIdsBySymbols, searchTokenSuggestions, TokenSuggestion } from '../repos/tokenMapRepo';
import logger from '../logger';

/**
 * Service centralisé pour toutes les opérations liées aux tokens
 * Unifie les mappings et suggestions en utilisant la même table BigQuery
 */
export class TokenService {
  
  /**
   * Récupère les IDs DeFiLlama pour des symboles donnés
   * Utilisé pour la récupération des prix
   */
  async getTokenMappings(symbols: string[]): Promise<Record<string, string>> {
    return getDefiLlamaIdsBySymbols(symbols);
  }

  /**
   * Recherche des suggestions de tokens pour l'autocomplétion
   * Utilisé dans les formulaires d'ajout de transactions
   */
  async getTokenSuggestions(query: string, limit: number = 10): Promise<TokenSuggestion[]> {
    return searchTokenSuggestions(query, limit);
  }

  /**
   * Valide qu'un symbole existe dans notre base de données
   * Utile avant d'ajouter une transaction
   */
  async validateSymbol(symbol: string): Promise<{ valid: boolean; suggestion?: TokenSuggestion }> {
    const mappings = await this.getTokenMappings([symbol]);
    
    if (mappings[symbol.toUpperCase()]) {
      // Symbole trouvé, récupérer ses détails
      const suggestions = await this.getTokenSuggestions(symbol, 1);
      return {
        valid: true,
        suggestion: suggestions.find(s => s.symbol.toUpperCase() === symbol.toUpperCase())
      };
    }
    
    // Symbole non trouvé, proposer des alternatives
    const alternatives = await this.getTokenSuggestions(symbol, 5);
    return {
      valid: false,
      suggestion: alternatives[0] // Meilleure suggestion
    };
  }

  /**
   * Recherche intelligente: combine mapping exact et suggestions floues
   * Pour une UX optimale dans l'autocomplétion
   */
  async smartSearch(query: string): Promise<{
    exactMatch?: TokenSuggestion;
    suggestions: TokenSuggestion[];
  }> {
    const suggestions = await this.getTokenSuggestions(query, 10);
    
    // Vérifier s'il y a une correspondance exacte
    const exactMatch = suggestions.find(s => 
      s.symbol.toUpperCase() === query.toUpperCase()
    );
    
    // Si correspondance exacte, la retirer des suggestions pour éviter les doublons
    const filteredSuggestions = exactMatch 
      ? suggestions.filter(s => s !== exactMatch)
      : suggestions;
    
    return {
      exactMatch,
      suggestions: filteredSuggestions
    };
  }
}

// Instance singleton
export const tokenService = new TokenService();

// Exports pour compatibilité
export type { TokenSuggestion };
export default tokenService;
