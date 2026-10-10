import {
  ArrowLeft,
  ArrowRight,
  ImageOff,
  MoreHorizontal,
  X,
} from 'lucide-react';
import {
  Children,
  Fragment,
  ReactNode,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useBodyScrollLock } from '../shared/overlay';
import { adminStatusClass } from './status';
import {
  ADMIN_BADGE_BASE,
  ADMIN_BUTTON_ICON,
  ADMIN_BUTTON_OUTLINE,
  ADMIN_BUTTON_PRIMARY,
} from './tokens';

/** Préférences de navigation temporaires : pas de données métier persistées. */
const viewState = new Map<string, unknown>();
export function clearRecordViewState() {
  viewState.clear();
}
export function useCollectionState<T>(
  scope: string,
  key: string,
  initial: T,
): [T, (next: T | ((old: T) => T)) => void] {
  const id = scope + ':' + key;
  const [value, setValue] = useState<T>(() =>
    viewState.has(id) ? (viewState.get(id) as T) : initial,
  );
  const current = useRef(value);
  current.current = value;
  const set = (next: T | ((old: T) => T)) => {
    const updated =
      typeof next === 'function'
        ? (next as (old: T) => T)(current.current)
        : next;
    current.current = updated;
    viewState.set(id, updated);
    setValue(updated);
  };
  return [value, set];
}

export function RecordValue({
  value,
  label,
}: {
  value: ReactNode;
  label?: string;
}) {
  if (value === null || value === undefined || value === '')
    return (
      <span
        className="record-missing"
        aria-label={`${label ?? 'Valeur'} non renseignée`}
        title="Non renseigné"
      >
        —
      </span>
    );
  if (typeof value === 'boolean') return <>{value ? 'Oui' : 'Non'}</>;
  return <>{value}</>;
}

export function RecordStatus({
  value,
  dot = true,
}: {
  value: string;
  dot?: boolean;
}) {
  return (
    <span className={`${ADMIN_BADGE_BASE} ${adminStatusClass(value)}`}>
      {dot && (
        <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
      )}
      {value}
    </span>
  );
}

export function RecordIdentity({
  title,
  reference,
  secondary,
  image,
  media = false,
}: {
  title: string;
  reference?: string;
  secondary?: string;
  image?: string;
  media?: boolean;
}) {
  return (
    <div className="record-identity">
      {media &&
        (image ? (
          <img src={image} alt="" className="record-thumb" loading="lazy" />
        ) : (
          <span className="record-thumb record-thumb-empty">
            <ImageOff size={16} />
          </span>
        ))}
      <div className="min-w-0">
        <span className="record-identity-title" title={title}>
          {title || 'Sans intitulé'}
        </span>
        <span className="record-identity-meta">
          <span className="record-ref">{reference || 'Sans référence'}</span>
          {secondary && <span> · {secondary}</span>}
        </span>
      </div>
    </div>
  );
}

export type SummaryFact = { label: string; value: ReactNode };
export function RecordFacts({
  facts,
  className = '',
}: {
  facts: SummaryFact[];
  className?: string;
}) {
  return (
    <dl className={`record-facts ${className}`}>
      {facts.map((f) => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd>
            <RecordValue value={f.value} label={f.label} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function SummaryStrip({ facts }: { facts: SummaryFact[] }) {
  return (
    <div className="record-summary-strip">
      <RecordFacts facts={facts} />
    </div>
  );
}

export function RecordHeader({
  module,
  title,
  reference,
  status,
  subtitle,
  backTo,
  action,
  mode = 'detail',
}: {
  module?: string;
  title: string;
  reference?: string;
  status?: string;
  subtitle?: ReactNode;
  backTo?: string;
  action?: ReactNode;
  mode?: 'detail' | 'edit' | 'create';
}) {
  return (
    <header className="record-page-header" data-record-header={mode}>
      <div className="record-breadcrumb">
        {backTo && (
          <Link to={backTo}>
            <ArrowLeft size={14} />
            {module ?? 'Retour à la liste'}
          </Link>
        )}
        {!backTo && module && <span>{module}</span>}
        {backTo && <span aria-hidden="true">/</span>}
        <span>
          {mode === 'edit'
            ? 'Modification'
            : mode === 'create'
              ? 'Création'
              : 'Fiche détaillée'}
        </span>
      </div>
      <div className="record-header-main">
        <div className="min-w-0">
          <div className="record-title-line">
            <h1>{title}</h1>
            {status && <RecordStatus value={status} />}
          </div>
          <div className="record-header-context">
            {reference && <span className="record-ref">{reference}</span>}
            {reference && subtitle && <span aria-hidden="true">·</span>}
            {subtitle && <span>{subtitle}</span>}
          </div>
        </div>
        {action && <div className="record-header-actions">{action}</div>}
      </div>
    </header>
  );
}

export function FormFooter({
  children,
  hint = 'Les champs marqués * sont obligatoires.',
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="record-form-footer">
      <span>{hint}</span>
      <div>{children}</div>
    </div>
  );
}

/** Aperçu en top layer : Échap, focus natif, défilement interne et contexte conservé. */
export function RecordDrawer({
  title,
  reference,
  children,
  onClose,
  onOpen,
  footer,
}: {
  title: ReactNode;
  reference?: string;
  children: ReactNode;
  onClose: () => void;
  onOpen?: () => void;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useBodyScrollLock(true);
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="record-drawer admin-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <p className="record-eyebrow">Aperçu du dossier</p>
          <h2 id={titleId}>{title}</h2>
          {reference && <p className="record-ref">{reference}</p>}
        </div>
        <button
          className={ADMIN_BUTTON_ICON}
          type="button"
          onClick={onClose}
          aria-label="Fermer l’aperçu"
        >
          <X size={18} />
        </button>
      </header>
      <div className="record-drawer-content">{children}</div>
      <footer>
        <button
          type="button"
          className={ADMIN_BUTTON_OUTLINE}
          onClick={onClose}
        >
          Fermer
        </button>
        {footer}
        {onOpen && (
          <button
            type="button"
            className={ADMIN_BUTTON_PRIMARY}
            onClick={() => {
              onClose();
              onOpen();
            }}
          >
            Ouvrir la fiche <ArrowRight size={15} />
          </button>
        )}
      </footer>
    </dialog>,
    document.body,
  );
}

function flatten(nodes: ReactNode): ReactNode[] {
  return Children.toArray(nodes).flatMap((child) =>
    isValidElement(child) && child.type === Fragment
      ? flatten((child.props as { children?: ReactNode }).children)
      : [child],
  );
}
/** Menu natif hors des conteneurs scrollables : jamais coupé par un tableau. */
export function RecordMenu({
  children,
  label = 'Autres actions',
}: {
  children: ReactNode;
  label?: string;
}) {
  const anchor = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null),
    id = useId();
  const [expanded, setExpanded] = useState(false);
  const entries = flatten(children).filter((c) => c !== null && c !== false);
  const choices =
    entries.length > 0 &&
    entries.every((c) => isValidElement(c) && c.type === 'label');
  const selector = choices ? 'input,button' : '[role="menuitem"]';
  const close = () => {
    popup.current?.hidePopover();
    setExpanded(false);
    anchor.current?.focus();
  };
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    const menu = popup.current,
      button = anchor.current;
    if (!menu || !button) return;
    if (expanded) {
      close();
      return;
    }
    const rect = button.getBoundingClientRect();
    menu.style.left =
      Math.max(8, Math.min(window.innerWidth - 224, rect.right - 216)) + 'px';
    menu.showPopover();
    setExpanded(true);
    const height = menu.getBoundingClientRect().height;
    menu.style.top =
      Math.max(8, Math.min(window.innerHeight - height - 8, rect.bottom + 5)) +
      'px';
    menu.querySelector<HTMLElement>(selector)?.focus();
  };
  useEffect(() => {
    const element = popup.current;
    const update = (e: Event) =>
      setExpanded((e as ToggleEvent).newState === 'open');
    element?.addEventListener('toggle', update);
    return () => element?.removeEventListener('toggle', update);
  }, []);
  return (
    <>
      <button
        ref={anchor}
        className={ADMIN_BUTTON_ICON}
        onClick={open}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup={choices ? 'dialog' : 'menu'}
        aria-expanded={expanded}
        aria-controls={id}
      >
        <MoreHorizontal size={18} />
      </button>
      {createPortal(
        <div
          ref={popup}
          id={id}
          popover="auto"
          role={choices ? 'dialog' : 'menu'}
          aria-label={label}
          className="record-menu admin-dialog"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            const items = [
                ...popup.current!.querySelectorAll<HTMLElement>(selector),
              ],
              index = items.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
              e.preventDefault();
              items[
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? items.length - 1
                    : (index +
                        (e.key === 'ArrowDown' ? 1 : -1) +
                        items.length) %
                      items.length
              ]?.focus();
            }
          }}
        >
          {entries.map((child, i) => {
            if (!isValidElement(child)) return child;
            const p = child.props as {
              title?: string;
              'aria-label'?: string;
              children?: ReactNode;
              onClick?: (e: React.MouseEvent) => void;
              className?: string;
            };
            if (choices)
              return cloneElement(child as React.ReactElement<any>, {
                key: i,
                className: 'record-column-choice record-menu-item',
              });
            const text = p.title ?? p['aria-label'],
              hasText = Children.toArray(p.children).some(
                (c) => typeof c === 'string',
              );
            return cloneElement(
              child as React.ReactElement<any>,
              {
                key: i,
                role: 'menuitem',
                className:
                  'record-menu-item ' +
                  (p.className?.includes('red') ? 'record-menu-danger' : ''),
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  close();
                  p.onClick?.(e);
                },
              },
              p.children,
              !hasText && text ? <span>{text}</span> : null,
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

export function RecordCard({
  title,
  reference,
  secondary,
  status,
  facts,
  image,
  media = false,
  onOpen,
  children,
}: {
  title: string;
  reference: string;
  secondary?: string;
  status?: string;
  facts: SummaryFact[];
  image?: string;
  media?: boolean;
  onOpen: () => void;
  children?: ReactNode;
}) {
  return (
    <article className="record-card">
      {media && (
        <div className="record-card-cover">
          {image ? (
            <img src={image} alt={`Visuel de ${title}`} loading="lazy" />
          ) : (
            <span>
              <ImageOff size={24} />
              Aucun visuel
            </span>
          )}
        </div>
      )}
      <div className="record-card-body">
        <div className="record-card-head">
          <h2 title={title}>{title}</h2>
          <p>
            <span className="record-ref">{reference}</span>
            {secondary && <> · {secondary}</>}
          </p>
        </div>
        <div className="record-card-state">
          {status && <RecordStatus value={status} />}
        </div>
        <RecordFacts facts={facts.slice(0, 4)} />
      </div>
      <footer>
        <button type="button" onClick={onOpen}>
          Voir la fiche <ArrowRight size={14} />
        </button>
        {children && (
          <RecordMenu label={`Actions pour ${title}`}>{children}</RecordMenu>
        )}
      </footer>
    </article>
  );
}
