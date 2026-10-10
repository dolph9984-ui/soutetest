/* Primitives uniques du back-office : mêmes composants dans chaque module. */
export const ADMIN_SURFACE =
  'admin-surface bg-white rounded-xl border border-slate-200';
export const ADMIN_INPUT =
  'admin-input w-full min-h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-navy-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';
export const ADMIN_BUTTON_BASE =
  'admin-button inline-flex min-h-10 items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
export const ADMIN_BUTTON_PRIMARY = `${ADMIN_BUTTON_BASE} bg-navy-900 text-white hover:bg-navy-800`;
export const ADMIN_BUTTON_GOLD = ADMIN_BUTTON_PRIMARY;
export const ADMIN_BUTTON_OUTLINE = `${ADMIN_BUTTON_BASE} border border-slate-300 bg-white text-navy-900 hover:bg-slate-50`;
export const ADMIN_BUTTON_DANGER = `${ADMIN_BUTTON_BASE} border border-red-200 bg-white text-red-700 hover:bg-red-50`;
export const ADMIN_BUTTON_GHOST = `${ADMIN_BUTTON_BASE} text-slate-600 hover:bg-slate-100`;
export const ADMIN_BUTTON_ICON =
  'admin-icon-button inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-900 disabled:opacity-40 disabled:cursor-not-allowed';
export const ADMIN_BADGE_BASE =
  'admin-badge inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] leading-4 font-medium whitespace-nowrap';
