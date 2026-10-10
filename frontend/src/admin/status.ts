/* Palette et correspondance des états partagées entre tous les écrans admin. */
export const ADMIN_TONE_CLASSES = {
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  amber: 'bg-amber-100 text-amber-800',
  orange: 'bg-orange-100 text-orange-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-800',
  navy: 'bg-navy-900 text-white',
  gold: 'bg-gold-400 text-navy-950',
} as const;

export type AdminTone = keyof typeof ADMIN_TONE_CLASSES;

export const ADMIN_STATUS_TONES: Record<string, AdminTone> = {
  // États du catalogue et du suivi des demandes.
  disponible: 'blue',
  Disponible: 'blue',
  réservé: 'amber',
  Réservé: 'amber',
  vendu: 'navy',
  Vendu: 'navy',
  nouveau: 'blue',
  Nouveau: 'blue',
  Nouvelle: 'blue',
  traité: 'blue',
  Traité: 'blue',
  archivé: 'gray',
  Archivé: 'gray',
  Archivée: 'gray',
  'À contacter': 'orange',
  Contacté: 'indigo',
  'En étude': 'purple',
  "À l'étude": 'purple',
  'Proposition envoyée': 'indigo',
  'Terrains proposés': 'indigo',
  'En recherche': 'purple',
  'Visite programmée': 'amber',
  Négociation: 'amber',
  Demandée: 'blue',
  Confirmée: 'green',
  Reportée: 'amber',
  Effectuée: 'green',
  Annulée: 'red',
  Trouvé: 'green',
  Clôturée: 'gray',
  Validée: 'green',
  Validé: 'green',
  'Achat finalisé': 'navy',
  Refusée: 'red',
  Brouillon: 'gray',
  'Dossier incomplet': 'orange',
  'À examiner': 'amber',
  'Visite terrain programmée': 'purple',
  'Analyse des pièces': 'purple',
  Publié: 'green',
  'En négociation': 'amber',
  Rejeté: 'red',
  Reçu: 'blue',
  'Prêt à publier': 'indigo',
  'À compléter': 'orange',
  'Écart signalé': 'red',
  Incomplet: 'orange',
  Faible: 'gray',
  Normale: 'blue',
  Haute: 'orange',
  Urgente: 'red',
};

export function adminToneClass(tone: AdminTone): string {
  return ADMIN_TONE_CLASSES[tone];
}

const SEMANTIC_TONES: Record<AdminTone, AdminTone> = {
  gray: 'gray',
  blue: 'blue',
  indigo: 'blue',
  purple: 'blue',
  amber: 'amber',
  orange: 'amber',
  red: 'red',
  green: 'navy',
  navy: 'navy',
  gold: 'amber',
};
export function adminStatusClass(value: string): string {
  return ADMIN_TONE_CLASSES[
    SEMANTIC_TONES[ADMIN_STATUS_TONES[value] ?? 'gray']
  ];
}
