import { ReactNode } from 'react';
import { formatDateTime } from '../lib/format';
import type { RequestStatus } from '../lib/store';
import { adminStatusClass } from './status';
import {
  ADMIN_BADGE_BASE,
  ADMIN_BUTTON_GHOST,
  ADMIN_BUTTON_PRIMARY,
  ADMIN_INPUT,
  ADMIN_SURFACE,
} from './tokens';
export {
  FormFooter,
  RecordCard,
  RecordHeader,
  RecordIdentity,
  RecordMenu,
  SummaryStrip,
} from './records';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="record-page-header" data-record-header="collection">
      <p className="record-eyebrow">Espace de gestion / Collections</p>
      <div className="record-header-main">
        <div className="min-w-0">
          <div className="record-title-line">
            <h1>{title}</h1>
          </div>
          {subtitle && <p className="record-header-context">{subtitle}</p>}
        </div>
        {action && <div className="record-header-actions">{action}</div>}
      </div>
    </header>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${ADMIN_SURFACE} ${className}`}>{children}</div>;
}

export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`${ADMIN_BADGE_BASE} capitalize font-medium ${adminStatusClass(value)}`}
    >
      {value}
    </span>
  );
}

export const REQUEST_STATUSES: RequestStatus[] = [
  'nouveau',
  'traité',
  'archivé',
];

export function formatDate(iso: string) {
  return formatDateTime(iso);
}

// Primitives partagés avec les écrans CRM.
export const inputClass = ADMIN_INPUT;
export const btnPrimary = ADMIN_BUTTON_PRIMARY;
export const btnGhost = ADMIN_BUTTON_GHOST;
