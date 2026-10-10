// Composants partagés des modules « Demandes d'achat » et « Terrains ».
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Film,
  Printer,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import {
  isValidElement,
  lazy,
  Suspense,
  ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useLocation } from 'react-router-dom';
import {
  formatArea,
  formatAriary,
  formatDateShort,
  formatDateTime,
  formatNumber,
} from '../../lib/format';
import { formatPhone, phoneHref } from '../../lib/phone';
import { newId } from '../../lib/store';
import { useBodyScrollLock } from '../../shared/overlay';
import {
  RecordDrawer,
  RecordFacts,
  RecordMenu,
  RecordValue,
  useCollectionState,
} from '../records';
import { adminStatusClass } from '../status';
import {
  ADMIN_BADGE_BASE,
  ADMIN_BUTTON_BASE,
  ADMIN_BUTTON_DANGER,
  ADMIN_BUTTON_GOLD,
  ADMIN_BUTTON_ICON,
  ADMIN_BUTTON_OUTLINE,
  ADMIN_BUTTON_PRIMARY,
  ADMIN_INPUT,
  ADMIN_SURFACE,
} from '../tokens';
import { notice } from './dialog';
import { downloadFile, formatSize, getFileBytes, putFile, useFileUrl } from './files';
import type { HistoryEntry, Note, StoredFile } from './model';
import { ACTOR } from './model';

// ---------- Primitives et formats partagés ----------
export const input = ADMIN_INPUT;
export const btn = ADMIN_BUTTON_BASE;
export const btnPrimary = ADMIN_BUTTON_PRIMARY;
export const btnGold = ADMIN_BUTTON_GOLD;
export const btnOutline = ADMIN_BUTTON_OUTLINE;
export const btnDanger = ADMIN_BUTTON_DANGER;
export const btnIcon = ADMIN_BUTTON_ICON;

export const fmtAr = formatAriary;
export const fmtNum = formatNumber;
export const fmtM2 = formatArea;
export const fmtDate = formatDateShort;
export const fmtDateTime = formatDateTime;
/** Date relative, scannable : « il y a 2 h », « hier », puis date courte. */
export function fmtRelative(iso?: string): string {
  if (!iso) return '—';
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return '—';
  const min = Math.floor((Date.now() - timestamp) / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'hier';
  if (d < 7) return `il y a ${d} j`;
  return fmtDate(iso);
}

/** Cellule date relative (date exacte au survol). */
export function RelDate({ iso }: { iso?: string }) {
  return (
    <span
      className="whitespace-nowrap text-slate-600 tabular-nums"
      title={fmtDateTime(iso)}
    >
      {fmtDate(iso)}
    </span>
  );
}

/** Téléphone cliquable dans une ligne de tableau (n'ouvre pas la fiche). */
export function TelLink({ phone }: { phone?: string }) {
  if (!phone) return <span className="text-gray-600">—</span>;
  return (
    <a
      href={phoneHref(phone)}
      onClick={(e) => e.stopPropagation()}
      className="whitespace-nowrap text-navy-900 underline-offset-2 hover:text-navy-700 hover:underline"
    >
      {formatPhone(phone)}
    </a>
  );
}

function hasContent(node: ReactNode): boolean {
  if (node === null || node === undefined || typeof node === 'boolean')
    return false;
  if (Array.isArray(node)) return node.some(hasContent);
  if (typeof node === 'string') return !!node.trim();
  if (
    isValidElement(node) &&
    typeof node.type === 'string' &&
    ['div', 'span', 'ul', 'ol', 'dl'].includes(node.type)
  )
    return hasContent((node.props as { children?: ReactNode }).children);
  return true;
}

// ---------- Mise en page ----------
export function Section({
  title,
  icon,
  children,
  action,
  confidential,
  hint,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  confidential?: boolean;
  hint?: ReactNode;
}) {
  return (
    <section className={ADMIN_SURFACE}>
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <h2 className="flex items-center gap-2 font-semibold text-navy-900">
          {icon && <span className="text-slate-500">{icon}</span>}
          {title}
          {confidential && (
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              Confidentiel
            </span>
          )}
        </h2>
        {action}
      </header>
      <div className="p-5">
        {hint && <p className="mb-4 -mt-1 text-sm text-gray-500">{hint}</p>}
        {hasContent(children) ? (
          children
        ) : (
          <p className="text-sm text-slate-500">
            {/photo|galerie/i.test(title)
              ? 'Aucun visuel ajouté.'
              : /document/i.test(title)
                ? 'Aucun document ajouté.'
                : 'Aucun élément renseigné pour cette rubrique.'}
          </p>
        )}
      </div>
    </section>
  );
}

export function Grid({
  children,
  cols = 3,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
}) {
  const c = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[cols];
  return <div className={`grid grid-cols-1 ${c} gap-4`}>{children}</div>;
}

export function Field({
  label,
  required,
  children,
  hint,
  error,
  span,
  full = false,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  error?: string;
  span?: 'full' | 2;
  full?: boolean;
}) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    labelId = id + '-label';
  const s =
    full || span === 'full'
      ? 'sm:col-span-2 lg:col-span-full'
      : span === 2
        ? 'sm:col-span-2'
        : '';
  useLayoutEffect(() => {
    const control = root.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]),select,textarea',
    );
    if (!control) return;
    root.current?.removeAttribute('role');
    root.current?.removeAttribute('aria-labelledby');
    control.id = id;
    control.setAttribute('aria-labelledby', labelId);
    if (required) control.setAttribute('aria-required', 'true');
    else control.removeAttribute('aria-required');
    control.setAttribute('aria-invalid', error ? 'true' : 'false');
    const description = error ? id + '-error' : hint ? id + '-hint' : '';
    if (description) control.setAttribute('aria-describedby', description);
    else control.removeAttribute('aria-describedby');
  }, [id, labelId, required, error, hint, children]);
  return (
    <div
      ref={root}
      className={`block ${s}`}
      role="group"
      aria-labelledby={labelId}
    >
      <label
        htmlFor={id}
        id={labelId}
        className="block text-xs font-medium text-slate-600 mb-1.5"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-600">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p
          id={id + '-error'}
          role="alert"
          className="text-xs text-red-700 mt-1"
        >
          {error}
        </p>
      ) : (
        hint && (
          <p id={id + '-hint'} className="text-xs text-slate-500 mt-1">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      aria-label={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${input} ${className}`}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Boutons segmentés (choix unique). */
export function Choice({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            value === o
              ? 'bg-navy-900 border-navy-900 text-white'
              : 'bg-white border-gray-300 text-gray-700 hover:border-navy-900'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Choix multiple. */
export function MultiChoice({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: readonly string[];
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => toggle(o)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            value.includes(o)
              ? 'bg-navy-900 border-navy-900 text-white'
              : 'bg-white border-gray-300 text-gray-700 hover:border-navy-900'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  suffix,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        min={0}
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={placeholder}
        className={`${input} ${suffix ? 'pr-14' : ''}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: NoInfer<T>; label: string; badge?: number | string }[];
  value: T;
  onChange: (t: NoInfer<T>) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Rubriques du dossier"
      className="admin-scroll-x flex gap-1 border-b border-gray-200 mb-5 -mx-1 px-1"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onKeyDown={(e) => {
            if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
              e.preventDefault();
              const index = tabs.findIndex((x) => x.id === t.id);
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? tabs.length - 1
                    : (index +
                        (e.key === 'ArrowRight' ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
              onChange(tabs[next].id);
              (
                e.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus();
            }
          }}
          onClick={() => onChange(t.id)}
          className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            value === t.id
              ? 'border-navy-900 text-navy-900'
              : 'border-transparent text-gray-500 hover:text-navy-900'
          }`}
        >
          {t.label}
          {t.badge !== undefined && t.badge !== 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px]">
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------- Badges ----------
export function Badge({ value, dot }: { value: string; dot?: boolean }) {
  return (
    <span
      className={`${ADMIN_BADGE_BASE} font-medium ${adminStatusClass(value)}`}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      )}
      {value}
    </span>
  );
}

// ---------- Progression ----------
export function Stepper({
  steps,
  current,
  failed,
}: {
  steps: string[];
  current: number;
  failed?: string;
}) {
  return (
    <div>
      <ol className="flex items-center">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="flex-1 flex items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    done
                      ? 'bg-navy-900 border-navy-900 text-white'
                      : active
                        ? 'bg-navy-900 border-navy-900 text-white'
                        : 'bg-white border-gray-300 text-gray-600'
                  }`}
                >
                  {i + 1}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  className={`flex-1 h-0.5 mx-1 ${done ? 'bg-navy-900' : 'bg-gray-200'}`}
                />
              )}
            </li>
          );
        })}
      </ol>
      <div className="hidden md:flex mt-2">
        {steps.map((s, i) => (
          <span
            key={s}
            className={`flex-1 last:flex-none last:text-right text-[11px] ${i === current ? 'text-navy-900 font-semibold' : 'text-gray-600'}`}
          >
            {s}
          </span>
        ))}
      </div>
      <p className="md:hidden mt-2 text-xs text-navy-900 font-semibold">
        Étape {current + 1} / {steps.length} : {steps[current]}
      </p>
      {failed && (
        <p className="mt-2 text-xs text-red-600">
          Dossier {failed.toLowerCase()}
        </p>
      )}
    </div>
  );
}

// ---------- Tableau de données ----------
export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  csv?: (row: T) => string | number;
  className?: string;
  width?: number;
  align?: 'left' | 'right';
  /** Les champs secondaires restent accessibles dans l'aperçu et les exports. */
  defaultVisible?: boolean;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onOpen,
  selected,
  onSelect,
  rowActions,
  rowClass,
  pageSize = 10,
  entityLabel = 'dossiers',
  filtered = false,
  onClearFilters,
  previewContent,
}: {
  rows: T[];
  columns: Column<T>[];
  onOpen: (row: T) => void;
  selected: string[];
  onSelect: (ids: string[]) => void;
  rowActions?: (row: T) => ReactNode;
  rowClass?: (row: T) => string;
  pageSize?: number;
  entityLabel?: string;
  filtered?: boolean;
  onClearFilters?: () => void;
  previewContent?: (row: T) => ReactNode;
}) {
  const { pathname } = useLocation();
  const [sortKey, setSortKey] = useCollectionState(pathname, 'sort', '');
  const [dir, setDir] = useCollectionState<1 | -1>(pathname, 'direction', 1);
  const [page, setPage] = useCollectionState(pathname, 'page', 1);
  const [density, setDensity] = useCollectionState<'standard' | 'compact'>(
    pathname,
    'density',
    'standard',
  );
  const [visibleKeys, setVisibleKeys] = useCollectionState<string[]>(
    pathname,
    'columns',
    columns.filter((c) => c.defaultVisible !== false).map((c) => c.key),
  );
  const [peek, setPeek] = useState<T | null>(null);
  const allCheck = useRef<HTMLInputElement>(null);
  const visible = columns.filter(
    (c, i) => i === 0 || visibleKeys.includes(c.key),
  );
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    return [...rows].sort((a, b) => {
      const x = col.sort!(a),
        y = col.sort!(b);
      if (x === '' || x == null) return y === '' || y == null ? 0 : 1;
      if (y === '' || y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [rows, columns, sortKey, dir]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize)),
    current = Math.min(page, pages);
  const shown = sorted.slice((current - 1) * pageSize, current * pageSize);
  const allShown =
    shown.length > 0 && shown.every((r) => selected.includes(r.id));
  const someShown = shown.some((r) => selected.includes(r.id));
  useEffect(() => {
    if (allCheck.current)
      allCheck.current.indeterminate = someShown && !allShown;
  }, [someShown, allShown]);
  const toggleAll = () =>
    onSelect(
      allShown
        ? selected.filter((id) => !shown.some((r) => r.id === id))
        : [...new Set([...selected, ...shown.map((r) => r.id)])],
    );
  const toggleSort = (key: string) => {
    if (sortKey === key) setDir(dir === 1 ? -1 : 1);
    else {
      setSortKey(key);
      setDir(1);
    }
  };
  const titleOf = (r: T) => {
    const value = columns[0]?.render(r);
    if (
      isValidElement(value) &&
      typeof (value.props as { title?: unknown }).title === 'string'
    )
      return (value.props as { title: string }).title;
    const v = r as T & { fullName?: string; title?: string; ref?: string };
    return v.fullName || v.title || v.ref || `Fiche #${r.id}`;
  };
  const referenceOf = (r: T) => (r as T & { ref?: string }).ref ?? `#${r.id}`;
  const check = (r: T) => (
    <label className="record-check" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={selected.includes(r.id)}
        onChange={() =>
          onSelect(
            selected.includes(r.id)
              ? selected.filter((id) => id !== r.id)
              : [...selected, r.id],
          )
        }
        aria-label={`Sélectionner ${titleOf(r)}`}
      />
    </label>
  );
  const actions = (r: T) => (
    <div className="record-row-actions">
      <button
        type="button"
        className={btnIcon}
        onClick={(e) => {
          e.stopPropagation();
          setPeek(r);
        }}
        aria-label={`Aperçu de ${titleOf(r)}`}
        title="Aperçu"
      >
        <Eye size={16} />
      </button>
      <RecordMenu label={`Actions pour ${titleOf(r)}`}>
        <button type="button" onClick={() => onOpen(r)}>
          <FileText size={16} />
          Ouvrir la fiche
        </button>
        {rowActions?.(r)}
      </RecordMenu>
    </div>
  );
  const empty = (
    <div className="record-table-empty">
      <FileText className="w-6 h-6 mx-auto mb-3 text-slate-400" />
      <h3>
        {filtered
          ? 'Aucun résultat pour ces filtres'
          : `Aucun ${entityLabel} pour le moment`}
      </h3>
      <p>
        {filtered
          ? 'Modifiez la recherche ou effacez les filtres.'
          : 'Les nouveaux éléments apparaîtront dans cette collection.'}
      </p>
      {filtered && onClearFilters && (
        <button className={`${btnOutline} mt-4`} onClick={onClearFilters}>
          Effacer les filtres
        </button>
      )}
    </div>
  );
  return (
    <>
      <div className="record-table-surface" data-collection={pathname}>
        <div className="record-table-top">
          <span>
            {rows.length} {entityLabel}
            {selected.length > 0 && (
              <>
                {' '}
                · <strong>{selected.length} sélectionné(s)</strong>{' '}
                <button className="underline ml-2" onClick={() => onSelect([])}>
                  Annuler
                </button>
              </>
            )}
          </span>
          <div className="record-table-options">
            <label className="record-density">
              <span className="sr-only">Densité du tableau</span>
              <select
                value={density}
                onChange={(e) =>
                  setDensity(e.target.value as 'standard' | 'compact')
                }
              >
                <option value="standard">Standard · 64 px</option>
                <option value="compact">Compact · 52 px</option>
              </select>
            </label>
            <RecordMenu label="Colonnes du tableau">
              {columns.slice(1).map((c) => (
                <label key={c.key} className="record-column-choice">
                  <input
                    type="checkbox"
                    checked={visibleKeys.includes(c.key)}
                    onChange={() =>
                      setVisibleKeys(
                        visibleKeys.includes(c.key)
                          ? visibleKeys.filter((k) => k !== c.key)
                          : [...visibleKeys, c.key],
                      )
                    }
                  />
                  {c.label}
                </label>
              ))}
            </RecordMenu>
          </div>
        </div>
        {!rows.length ? (
          empty
        ) : (
          <>
            <div
              className="record-table-scroll"
              role="region"
              aria-label="Tableau de résultats"
              tabIndex={0}
            >
              <table
                className={`record-table ${density === 'compact' ? 'is-compact' : ''}`}
                style={{
                  minWidth: Math.max(
                    950,
                    132 +
                      visible.reduce(
                        (total, c, i) =>
                          total + (i === 0 ? 250 : (c.width ?? 130)),
                        0,
                      ),
                  ),
                }}
              >
                <colgroup>
                  <col style={{ width: 44 }} />
                  {visible.map((c, i) => (
                    <col
                      key={c.key}
                      style={{ width: c.width ?? (i === 0 ? undefined : 130) }}
                    />
                  ))}
                  <col style={{ width: 88 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">
                      <label className="record-check">
                        <input
                          ref={allCheck}
                          type="checkbox"
                          checked={allShown}
                          onChange={toggleAll}
                          aria-label="Sélectionner les éléments de cette page"
                        />
                      </label>
                    </th>
                    {visible.map((c) => (
                      <th
                        scope="col"
                        key={c.key}
                        className={c.align === 'right' ? 'record-right' : ''}
                        aria-sort={
                          sortKey === c.key
                            ? dir === 1
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        {c.sort ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            className="inline-flex items-center gap-1.5"
                          >
                            {c.label}
                            {sortKey === c.key ? (
                              dir === 1 ? (
                                <ArrowUp size={12} />
                              ) : (
                                <ArrowDown size={12} />
                              )
                            ) : (
                              <ArrowUpDown size={12} className="opacity-40" />
                            )}
                          </button>
                        ) : (
                          c.label
                        )}
                      </th>
                    ))}
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr
                      key={r.id}
                      className={
                        selected.includes(r.id)
                          ? 'record-selected'
                          : (rowClass?.(r) ?? '')
                      }
                      onClick={(e) => {
                        if (
                          !(e.target as HTMLElement).closest(
                            'a,button,input,select,label',
                          )
                        )
                          onOpen(r);
                      }}
                    >
                      <td>{check(r)}</td>
                      {visible.map((c, i) => (
                        <td
                          key={c.key}
                          className={`${c.align === 'right' ? 'record-right' : ''} ${c.className ?? ''}`}
                        >
                          {i === 0 ? (
                            <button
                              type="button"
                              className="record-identity-button"
                              onClick={() => onOpen(r)}
                            >
                              {c.render(r)}
                            </button>
                          ) : (
                            c.render(r)
                          )}
                        </td>
                      ))}
                      <td onClick={(e) => e.stopPropagation()}>{actions(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.map((r) => (
              <article key={r.id} className="record-mobile-row">
                <div className="record-mobile-top">
                  <div className="record-mobile-title">
                    <button
                      type="button"
                      className="text-left w-full"
                      onClick={() => onOpen(r)}
                    >
                      {columns[0].render(r)}
                    </button>
                  </div>
                  {actions(r)}
                </div>
                <dl className="record-mobile-facts">
                  {visible.slice(1, 5).map((c) => (
                    <div key={c.key}>
                      <dt>{c.label}</dt>
                      <dd>{c.render(r)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </>
        )}
        <footer className="record-table-footer">
          <span>
            {sorted.length
              ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, sorted.length)} sur ${sorted.length}`
              : '0 résultat'}
          </span>
          <div className="flex items-center gap-2">
            <button
              className={btnIcon}
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {current} / {pages}
            </span>
            <button
              className={btnIcon}
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </div>
      {peek && (
        <RecordDrawer
          title={titleOf(peek)}
          reference={referenceOf(peek)}
          onClose={() => setPeek(null)}
          onOpen={() => onOpen(peek)}
        >
          <section className="record-drawer-section">
            <h3>Informations du dossier</h3>
            <RecordFacts
              facts={columns
                .slice(1)
                .map((c) => ({ label: c.label, value: c.render(peek) }))}
            />
          </section>
          {previewContent && (
            <section className="record-drawer-section">
              {previewContent(peek)}
            </section>
          )}
        </RecordDrawer>
      )}
    </>
  );
}

/** Export CSV (s'ouvre directement dans Excel, séparateur « ; » et BOM UTF-8 pour les accents). */
export function exportCsv<T>(
  rows: T[],
  columns: Column<T>[],
  filename: string,
) {
  const cols = columns.filter((c) => c.csv);
  const esc = (v: string | number) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    cols.map((c) => esc(c.label)).join(';'),
    ...rows.map((r) => cols.map((c) => esc(c.csv!(r))).join(';')),
  ];
  const blob = new Blob(['﻿' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Échappe les valeurs dynamiques avant de les insérer dans un document HTML imprimable. */
export function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) => entities[character]!,
  );
}

/** Impression / export PDF d'un tableau : ouvre une page imprimable (choisir « Enregistrer en PDF »). */
export function printTable<T>(rows: T[], columns: Column<T>[], title: string) {
  const cols = columns.filter((c) => c.csv);
  const esc = escapeHtml;
  printHtml(
    title,
    `<table><thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows
      .map(
        (r) =>
          `<tr>${cols.map((c) => `<td>${esc(c.csv!(r))}</td>`).join('')}</tr>`,
      )
      .join('')}</tbody></table>`,
  );
}

export function printHtml(title: string, body: string) {
  const w = window.open('', '_blank');
  if (!w) {
    void notice('Autorisez les fenêtres pop-up pour imprimer.');
    return;
  }
  const safeTitle = escapeHtml(title);
  // `body` peut contenir du HTML de présentation : ses valeurs dynamiques
  // doivent toujours passer par escapeHtml() avant l'appel.
  w.document
    .write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>
    body{font-family:system-ui,sans-serif;color:#0b1e42;margin:24px;font-size:12px}
    h1{font-size:18px;margin:0 0 4px} .muted{color:#6b7280} h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #f7c325;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border:1px solid #e5e7eb;padding:6px;text-align:left;vertical-align:top}
    th{background:#f3f6fb} dl{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin:0} dt{color:#6b7280} dd{margin:0 0 6px;font-weight:600}
    img{max-width:32%;margin:4px;border-radius:6px}
  </style></head><body><h1>CA IMMO — ${safeTitle}</h1><p class="muted">Généré le ${formatDateTime(new Date().toISOString())}</p>${body}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 800); // laisse le temps aux images de se charger
}

// ---------- Fichiers ----------
export function FileDrop({
  accept,
  maxMb,
  multiple,
  onFiles,
  label,
  hint,
  visibility = 'private',
}: {
  accept: string;
  maxMb: number;
  multiple?: boolean;
  onFiles: (files: StoredFile[]) => void;
  label: string;
  hint?: string;
  visibility?: 'public' | 'private';
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = async (list: FileList | null) => {
    if (!list?.length) return;
    setError('');
    const types = accept.split(',').map((t) => t.trim());
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      if (!types.includes(f.type) && !types.includes(ext)) {
        setError(`Format non accepté : ${f.name}`);
        continue;
      }
      if (f.size > maxMb * 1024 * 1024) {
        setError(`${f.name} dépasse ${maxMb} Mo`);
        continue;
      }
      ok.push(f);
    }
    if (!ok.length) return;
    setBusy(true);
    try {
      onFiles(await Promise.all(ok.map((file) => putFile(file, visibility))));
    } catch {
      setError(
        'Le fichier n’a pas pu être enregistré. Vérifiez la connexion puis réessayez.',
      );
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-1 px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer text-center transition-colors ${
          over
            ? 'border-gold-500 bg-gold-400/10'
            : 'border-gray-300 hover:border-navy-900 bg-gray-50'
        }`}
      >
        <Upload className="w-6 h-6 text-gray-600" />
        <span className="text-sm font-medium text-navy-900">
          {busy ? 'Enregistrement…' : label}
        </span>
        <span className="text-xs text-gray-600">
          Glisser-déposer ou cliquer · {hint}
        </span>
        <input
          ref={ref}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handle(e.target.files)}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function Thumb({
  file,
  className = '',
}: {
  file: StoredFile;
  className?: string;
}) {
  const url = useFileUrl(
    (file.type ?? '').startsWith('image/') ? file : undefined,
  );
  // `type` peut être absent/null pour des documents historiques (anciens
  // libellés texte migrés sans type MIME connu) : on sécurise avec `?? ''`
  // pour ne jamais planter sur `.startsWith(...)`.
  const type = file.type ?? '';
  if (type.startsWith('image/'))
    return url ? (
      <img
        src={url}
        alt={file.name}
        className={`object-cover ${className}`}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
      />
    ) : (
      <div className={`bg-gray-100 ${className}`} />
    );
  const Icon = type.startsWith('video/') ? Film : FileText;
  return (
    <div
      className={`flex items-center justify-center bg-gray-100 text-gray-600 ${className}`}
    >
      <Icon className="w-6 h-6" />
    </div>
  );
}

export function FileChip({
  file,
  onPreview,
  onRemove,
}: {
  file: StoredFile;
  onPreview: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg">
      <Thumb file={file} className="w-10 h-10 rounded" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-gray-600">{formatSize(file.size)}</p>
      </div>
      <button
        type="button"
        className={btnIcon}
        onClick={onPreview}
        aria-label="Aperçu"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        type="button"
        className={btnIcon}
        onClick={() => downloadFile(file)}
        aria-label="Télécharger"
      >
        <Download className="w-4 h-4" />
      </button>
      {onRemove && (
        <button
          type="button"
          className={`${btnIcon} hover:text-red-600`}
          onClick={onRemove}
          aria-label="Retirer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

const LazyPdfViewer = lazy(() => import('./PdfViewer'));

export function Preview({
  file,
  onClose,
}: {
  file: StoredFile | null;
  onClose: () => void;
}) {
  const type = file?.type ?? '';
  const isPdf = file
    ? /^application\/pdf(?:\s*;|$)/i.test(type) || /\.pdf$/i.test(file.name)
    : false;

  // IMPORTANT : on n'appelle useFileUrl QUE pour les images/vidéos.
  // Pour les PDFs, on utilise getFileBytes (endpoint base64) qui contourne IDM.
  // Si on appelait useFileUrl pour les PDFs aussi, il déclencherait l'ancien
  // endpoint /admin/files/ et IDM intercepterait la requête.
  const { url, resolved } = useFileUrl(
    isPdf ? undefined : (file ?? undefined),
    true,
  );

  // Données binaires directes pour les PDFs via endpoint base64.
  const [pdfData, setPdfData] = useState<Uint8Array | undefined>();
  const [pdfResolved, setPdfResolved] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!file || !isPdf) {
      setPdfData(undefined);
      setPdfResolved(true);
      return;
    }
    let alive = true;
    setPdfData(undefined);
    setPdfResolved(false);
    setPdfLoading(true);
    getFileBytes(file)
      .then((bytes) => {
        if (!alive) return;
        setPdfData(bytes);
        setPdfResolved(true);
        setPdfLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setPdfData(undefined);
        setPdfResolved(true);
        setPdfLoading(false);
      });
    return () => { alive = false; };
  }, [file?.id, file?.url, isPdf]);

  useEffect(() => {
    const element = dialog.current;
    if (!file || !element) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [file?.id]);
  if (!file) return null;

  // Pour les PDFs, on utilise pdfData/pdfResolved ; pour le reste, url/resolved.
  const ready = isPdf ? pdfResolved : resolved;
  const hasContent = isPdf ? !!pdfData : !!url;

  return (
    <dialog
      ref={dialog}
      aria-label={file.name}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 z-[60] m-0 h-dvh w-screen max-h-none max-w-none bg-black/90 p-0 text-white backdrop:bg-black/80 open:flex open:flex-col"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate">{file.name}</span>
        <div className="flex gap-2">
          {(hasContent || !ready) && (
            <button
              type="button"
              className={`${btn} bg-white/10 hover:bg-white/20`}
              onClick={() => downloadFile(file)}
            >
              <Download className="w-4 h-4" /> Télécharger
            </button>
          )}
          <button
            type="button"
            className={`${btn} bg-white/10 hover:bg-white/20`}
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        className={`flex-1 min-h-0 p-4 ${isPdf ? 'flex' : 'flex items-center justify-center'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {!hasContent ? (
          !ready ? (
            <p role="status" className="m-auto text-white/60">
              {pdfLoading ? 'Chargement du PDF…' : 'Chargement…'}
            </p>
          ) : (
            <div className="m-auto max-w-md text-center text-white/70">
              {isPdf ? (
                <>
                  <p className="text-lg mb-2">⚠ Impossible de charger ce PDF</p>
                  <p className="text-sm text-white/60">
                    Les données sont vides ou le fichier est introuvable.
                  </p>
                  <p className="text-xs text-white/50 mt-3">
                    Vérifiez la console (F12) pour les détails techniques.
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    Essayez de télécharger le fichier et de l'ouvrir localement.
                  </p>
                </>
              ) : (
                <p>
                  Aucun fichier déposé pour cette pièce (document historique sans
                  fichier joint).
                </p>
              )}
            </div>
          )
        ) : isPdf && pdfData ? (
          <Suspense fallback={<p role="status" className="m-auto text-white/60">Chargement du lecteur PDF…</p>}>
            <LazyPdfViewer data={pdfData} title={file.name} />
          </Suspense>
        ) : type.startsWith('image/') ? (
          <img
            src={url}
            alt={file.name}
            className="max-h-full max-w-full rounded-lg"
            referrerPolicy="no-referrer"
            loading="eager"
            decoding="async"
          />
        ) : type.startsWith('video/') ? (
          <video
            src={url}
            controls
            className="max-h-full max-w-full rounded-lg"
          />
        ) : (
          <p className="text-white/70">
            Aperçu indisponible pour ce format. Utilisez « Télécharger ».
          </p>
        )}
      </div>
    </dialog>
  );
}

// Carte chargée à la demande : pas de moteur cartographique sur les listes.
const LazyMapPicker = lazy(() => import('./MapPicker'));
export function MapPicker(props: {
  lat?: number; lng?: number; onChange?: (lat: number, lng: number) => void;
  readOnly?: boolean; height?: string; radiusKm?: number;
}) {
  return <Suspense fallback={<div role="status" className={`${props.height ?? 'h-80'} rounded-xl border border-slate-200 bg-slate-50 grid place-items-center text-xs text-slate-500`}>Chargement de la carte…</div>}><LazyMapPicker {...props}/></Suspense>;
}

// ---------- Historique et notes ----------
export function Timeline({ items }: { items: HistoryEntry[] }) {
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  if (!sorted.length)
    return <p className="text-sm text-gray-600">Aucun historique.</p>;
  return (
    <ol className="relative border-l-2 border-gray-100 ml-2 space-y-4">
      {sorted.map((h) => (
        <li key={h.id} className="pl-4 relative">
          <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-navy-900 ring-4 ring-white" />
          <p className="text-sm text-navy-900">{h.text}</p>
          <p className="text-xs text-gray-600">
            {fmtDateTime(h.at)} · {h.author}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function NotesPanel({
  notes,
  onAdd,
}: {
  notes: Note[];
  onAdd: (n: Note) => void;
}) {
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    onAdd({
      id: newId(),
      at: new Date().toISOString(),
      author: ACTOR,
      text: text.trim(),
    });
    setText('');
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Note interne (non visible par le client)…"
          className={input}
        />
        <button
          type="button"
          onClick={add}
          className={`${btnPrimary} self-start`}
        >
          Ajouter
        </button>
      </div>
      {[...notes]
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((n) => (
          <div
            key={n.id}
            className="p-3 rounded-lg bg-amber-50 border border-amber-100"
          >
            <p className="text-sm whitespace-pre-line">{n.text}</p>
            <p className="text-xs text-gray-500 mt-1">
              {fmtDateTime(n.at)} · {n.author}
            </p>
          </div>
        ))}
      {!notes.length && (
        <p className="text-sm text-gray-600">Aucune note interne.</p>
      )}
    </div>
  );
}

// ---------- Fenêtre modale simple ----------
/* Modale du back office — même habillage que le site public (grandes
   arrondis, en-tête titre + fermeture ronde, pied de modale), et le contenu
   déroule DANS la modale comme les longs formulaires de l'admin. */
export function Modal({
  title,
  children,
  onClose,
  wide,
  footer,
  kind = 'form',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  footer?: ReactNode;
  kind?: 'form' | 'detail';
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useBodyScrollLock(true);
  useEffect(() => {
    const element = dialog.current,
      previous = document.activeElement as HTMLElement | null;
    if (element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className={`record-modal admin-dialog ${wide ? 'record-modal-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header>
        <div>
          <p className="record-eyebrow">
            {kind === 'form'
              ? 'Formulaire du dossier'
              : 'Fiche liée au dossier'}
          </p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          type="button"
          className={btnIcon}
          onClick={onClose}
          aria-label="Fermer"
        >
          <X size={18} />
        </button>
      </header>
      <div className="record-modal-content">{children}</div>
      {footer && (
        <footer>
          {kind === 'form' && (
            <span>Les champs marqués * sont obligatoires.</span>
          )}
          <div>{footer}</div>
        </footer>
      )}
    </dialog>,
    document.body,
  );
}

export function Stat({
  label,
  value,
  tone = 'text-navy-900',
}: {
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <div className="admin-surface bg-white rounded-lg border border-slate-200 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-semibold tabular-nums mt-1 ${tone}`}>
        {value}
      </p>
    </div>
  );
}

export function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-navy-900 font-medium mt-0.5 break-words">
        <RecordValue value={value} label={label} />
      </dd>
    </div>
  );
}

/** Filtre de date compact avec libellé intégré (« Du » / « Au »). */
export function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative min-w-0">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 pointer-events-none">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${input} pl-9 min-w-0`}
        aria-label={label}
      />
    </div>
  );
}

// ---------- Coquille commune des listes ----------

/** En-tête de page uniforme : titre + sous-titre à gauche, action à droite. */
export { PageHeader } from '../ui';

/**
 * Barre d'outils uniforme de toutes les listes du back-office :
 * recherche, panneau « Filtres » dépliable avec compteur, actions groupées
 * et exports Excel / PDF / Imprimer — toujours au même endroit.
 */
export function ListToolbar<T>({
  q,
  onQ,
  placeholder,
  filters,
  activeFilters = 0,
  bulk,
  onReset,
  extra,
  exportRows,
  exportColumns,
  exportName,
  exportTitle,
}: {
  q: string;
  onQ: (v: string) => void;
  placeholder?: string;
  filters?: ReactNode;
  activeFilters?: number;
  bulk?: ReactNode;
  onReset?: () => void;
  extra?: ReactNode;
  exportRows?: () => T[];
  exportColumns?: Column<T>[];
  exportName?: string;
  exportTitle?: string;
}) {
  const { pathname: toolbarScope } = useLocation();
  const [open, setOpen] = useCollectionState(
      toolbarScope,
      'filtersOpen',
      false,
    ),
    id = useId();
  const canExport = !!(exportRows && exportColumns),
    title = exportTitle ?? exportName ?? 'Liste';
  return (
    <div className="admin-toolbar">
      <div className="admin-toolbar-main">
        <label className="admin-toolbar-search">
          <span className="sr-only">Rechercher dans la collection</span>
          <Search aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder={placeholder ?? 'Rechercher…'}
            className={input}
          />
        </label>
        {filters && (
          <button
            type="button"
            className={btnOutline}
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen(!open)}
          >
            <SlidersHorizontal size={14} />
            Filtres
            {activeFilters > 0 && (
              <span className="text-xs bg-slate-100 rounded px-1.5">
                {activeFilters}
              </span>
            )}
          </button>
        )}
        {extra}
        {(q || activeFilters > 0) && (
          <button
            type="button"
            className={btnOutline}
            onClick={() => {
              onQ('');
              onReset?.();
            }}
          >
            Effacer {onReset ? 'les filtres' : 'la recherche'}
          </button>
        )}
      </div>
      {filters && open && (
        <div className="admin-toolbar-filters" id={id}>
          {filters}
        </div>
      )}
      {(bulk || canExport) && (
        <div className="admin-toolbar-secondary">
          {bulk}
          {canExport && (
            <div className="admin-toolbar-exports">
              <RecordMenu label="Exporter les résultats">
                <button
                  type="button"
                  onClick={() =>
                    exportCsv(
                      exportRows!(),
                      exportColumns!,
                      exportName ?? 'export',
                    )
                  }
                >
                  <FileSpreadsheet size={15} />
                  CSV / Excel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printTable(exportRows!(), exportColumns!, title)
                  }
                >
                  <FileDown size={15} />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printTable(exportRows!(), exportColumns!, title)
                  }
                >
                  <Printer size={15} />
                  Imprimer
                </button>
              </RecordMenu>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
