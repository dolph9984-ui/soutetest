// Toujours opt-in et isolé : un build normal ne contient aucun accès mock.
export const IS_ADMIN_PREVIEW = import.meta.env.MODE === 'admin-preview' &&
  (import.meta.env.DEV || import.meta.env.VITE_ISOLATED_PREVIEW === 'true');
