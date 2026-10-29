
/**
 * Calcule la distance entre deux points GPS.
 * Utilise la formule de Haversine ajustée par un coefficient de tortuosité (CTR).
 * Le CTR de 1.25 est calibré pour le réseau routier Tunisien (Autoroute A1 / GP1).
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Rayon de la Terre en km
  const CTR = 1.25; // Coefficient de Tortuosité Routière (estimé pour la Tunisie)
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  // Calcul de la distance à vol d'oiseau
  const crowFliesDist = R * c;
  
  // Estimation de la distance routière réelle
  const roadDist = crowFliesDist * CTR;
  
  // Arrondi à une décimale pour la précision utilisateur
  return Math.round(roadDist * 10) / 10;
};
