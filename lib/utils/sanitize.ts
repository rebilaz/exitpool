/**
 * Nettoie et sanitize un tweet avant publication.
 * Supprime les emojis, limite les hashtags, bannit certaines expressions,
 * et respecte la limite de caractères.
 */
export function sanitizeTweet(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // 1. Trim et compactage des espaces multiples
  let text = input.trim().replace(/\s+/g, ' ');

  // 2. Supprimer les emojis (ranges Unicode courantes)
  // Commentaire: pour réactiver les emojis, commenter cette ligne
  text = text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    ''
  );

  // 3. Gestion des hashtags - whitelist autorisée
  const allowedHashtags = ['#IA', '#Crypto', '#OnChain'];
  const hashtagRegex = /#\w+/gi;
  const foundHashtags = text.match(hashtagRegex) || [];
  
  // Supprimer tous les hashtags existants du texte
  text = text.replace(hashtagRegex, '').trim();
  
  // Trouver le premier hashtag autorisé (case-insensitive)
  let approvedHashtag = '';
  for (const hashtag of foundHashtags) {
    const normalized = hashtag.toLowerCase();
    const allowed = allowedHashtags.find(allowed => allowed.toLowerCase() === normalized);
    if (allowed) {
      approvedHashtag = allowed; // Utiliser la version canonique
      break;
    }
  }

  // 4. Expressions bannies à supprimer (case-insensitive, gère les accents)
  const bannedExpressions = [
    'révolutionne',
    'disrupte', 
    'game changer',
    'algorithmes avancés',
    'incroyable',
    'opportunité',
    'to the moon',
    '100x',
    'gagne vite',
    'gagner vite',
    'NFA',
    'DYOR'
  ];

  // Normaliser pour gérer les accents
  const normalizeText = (str: string) => 
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const banned of bannedExpressions) {
    const normalizedBanned = normalizeText(banned.toLowerCase());
    const regex = new RegExp(
      normalizeText(banned).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 
      'gi'
    );
    text = text.replace(regex, '');
  }

  // 5. Recompactage des espaces après suppression
  text = text.replace(/\s+/g, ' ').trim();

  // 6. Ajouter le hashtag approuvé à la fin si trouvé
  if (approvedHashtag && text) {
    text = `${text} ${approvedHashtag}`;
  }

  // 7. Limite de caractères - couper proprement à 275
  if (text.length > 275) {
    text = text.substring(0, 275).trim();
    
    // Éviter de couper au milieu d'un mot
    const lastSpaceIndex = text.lastIndexOf(' ');
    if (lastSpaceIndex > 250) { // Seulement si on ne perd pas trop de caractères
      text = text.substring(0, lastSpaceIndex);
    }
  }

  // 8. Compactage final des espaces
  return text.replace(/\s+/g, ' ').trim();
}
