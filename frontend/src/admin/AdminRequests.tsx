import { Mail, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatPhone, phoneHref } from '../lib/phone';
import {
  ContactMessage,
  RequestStatus,
  deleteMessage,
  getMessages,
  updateMessage,
} from '../lib/store';
import { askConfirm, notice } from './crm/dialog';
import {
  Badge,
  Column,
  DataTable,
  Field,
  Info,
  ListToolbar,
  Modal,
  RelDate,
  Section,
  Select,
  Stat,
  Tabs,
  btnIcon,
  btnOutline,
  btnPrimary,
  fmtDateTime,
} from './crm/kit';
import { refreshCache, subscribeCache } from './crm/sync';
import {
  RecordHeader,
  RecordIdentity,
  SummaryStrip,
  useCollectionState,
} from './records';
import { PageHeader, REQUEST_STATUSES } from './ui';

const BASE = '/admin/messages';
const nameOf = (m: ContactMessage) =>
  [m.firstName, m.lastName].filter(Boolean).join(' ') ||
  'Expéditeur non renseigné';
const labelOf = (status: RequestStatus) =>
  status === 'nouveau' ? 'Nouveau' : status === 'traité' ? 'Traité' : 'Archivé';
const titleOf = (m: ContactMessage) => m.subject || 'Sans objet';
const columns: Column<ContactMessage>[] = [
  {
    key: 'identity',
    label: 'Message / référence',
    render: (m) => (
      <RecordIdentity
        title={titleOf(m)}
        reference={`#${m.id}`}
        secondary={nameOf(m)}
      />
    ),
    sort: (m) => titleOf(m),
    csv: (m) => titleOf(m),
  },
  {
    key: 'status',
    label: 'État de traitement',
    width: 145,
    render: (m) => <Badge value={labelOf(m.status)} dot />,
    sort: (m) => m.status,
    csv: (m) => m.status,
  },
  {
    key: 'sender',
    label: 'Expéditeur',
    width: 190,
    render: (m) => (
      <span className="block truncate" title={nameOf(m)}>
        {nameOf(m)}
      </span>
    ),
    sort: (m) => nameOf(m),
    csv: (m) => nameOf(m),
  },
  {
    key: 'phone',
    label: 'Téléphone',
    width: 145,
    render: (m) => (m.phone ? formatPhone(m.phone) : '—'),
    csv: (m) => m.phone,
  },
  {
    key: 'date',
    label: 'Reçu le',
    width: 110,
    render: (m) => <RelDate iso={m.createdAt} />,
    sort: (m) => m.createdAt,
    csv: (m) => fmtDateTime(m.createdAt),
  },
  {
    key: 'email',
    label: 'Email',
    render: (m) => m.email || '—',
    csv: (m) => m.email ?? '',
    defaultVisible: false,
  },
];

export function AdminMessages() {
  const navigate = useNavigate();
  const [items, setItems] = useState(getMessages),
    [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useCollectionState(BASE, 'status', ''),
    [q, setQ] = useCollectionState(BASE, 'q', '');
  const [editing, setEditing] = useState<ContactMessage | null>(null);
  useEffect(() => {
    refreshCache().then(() => setItems(getMessages()));
    return subscribeCache(() => setItems(getMessages()));
  }, []);
  const shown = items
    .filter(
      (m) =>
        (!filter || m.status === filter) &&
        (!q ||
          [nameOf(m), m.email ?? '', m.subject ?? '', m.phone, m.message]
            .join(' ')
            .toLowerCase()
            .includes(q.toLowerCase())),
    )
    .sort(
      (a, b) =>
        Number(a.status !== 'nouveau') - Number(b.status !== 'nouveau') ||
        b.createdAt.localeCompare(a.createdAt),
    );
  const remove = async (m: ContactMessage) => {
    if (await askConfirm('Supprimer ce message ?')) {
      try {
        await deleteMessage(m.id);
        setItems(getMessages());
      } catch (e) {
        void notice(e instanceof Error ? e.message : 'Suppression impossible.');
      }
    }
  };
  const reset = () => {
    setQ('');
    setFilter('');
  };
  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Messages reçus depuis le site et suivi de leur traitement."
      />
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Messages" value={items.length} />
        <Stat
          label="À traiter"
          value={items.filter((m) => m.status === 'nouveau').length}
        />
        <Stat
          label="Traités"
          value={items.filter((m) => m.status === 'traité').length}
        />
      </div>
      <ListToolbar
        q={q}
        onQ={setQ}
        placeholder="Rechercher : objet, expéditeur, téléphone…"
        onReset={reset}
        activeFilters={filter ? 1 : 0}
        filters={
          <Select
            value={filter}
            onChange={setFilter}
            options={REQUEST_STATUSES}
            placeholder="Tous les états"
          />
        }
        exportRows={() =>
          selected.length ? shown.filter((m) => selected.includes(m.id)) : shown
        }
        exportColumns={columns}
        exportName="messages"
      />
      <DataTable
        rows={shown}
        columns={columns}
        selected={selected}
        onSelect={setSelected}
        entityLabel="messages"
        filtered={!!(q || filter)}
        onClearFilters={reset}
        onOpen={(m) => navigate(`${BASE}/${m.id}`)}
        previewContent={(m) => (
          <>
            <h3 className="mb-3 text-xs text-slate-500">Contenu du message</h3>
            <p className="text-sm whitespace-pre-line text-slate-600">
              {m.message || 'Aucun contenu.'}
            </p>
          </>
        )}
        rowActions={(m) => (
          <>
            <button title="Modifier le suivi" onClick={() => setEditing(m)}>
              <Pencil size={15} />
            </button>
            <button
              title="Supprimer le message"
              className="text-red-600"
              onClick={() => remove(m)}
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      />
      {editing && (
        <MessageStatusForm message={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function MessageStatusForm({
  message,
  onClose,
}: {
  message: ContactMessage;
  onClose: () => void;
}) {
  const [status, setStatus] = useState(message.status),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await updateMessage(message.id, { status });
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Le suivi n’a pas pu être enregistré.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Modifier le suivi du message"
      onClose={onClose}
      footer={
        <>
          <button className={btnOutline} onClick={onClose}>
            Annuler
          </button>
          <button className={btnPrimary} disabled={busy} onClick={save}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      {error && (
        <p role="alert" className="text-sm text-red-700 mb-4">
          {error}
        </p>
      )}
      <Field label="État de traitement">
        <Select
          value={status}
          onChange={(v) => setStatus(v as RequestStatus)}
          options={REQUEST_STATUSES}
        />
      </Field>
      <p className="mt-4 text-xs text-slate-500">
        Le texte original et les coordonnées de l’expéditeur ne sont pas
        modifiés.
      </p>
    </Modal>
  );
}

export function MessageDetail() {
  const { id } = useParams(),
    navigate = useNavigate();
  const [message, setMessage] = useState(() =>
      getMessages().find((m) => m.id === id),
    ),
    [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<'overview' | 'contact'>('overview');
  useEffect(() => {
    refreshCache(true).then(() =>
      setMessage(getMessages().find((m) => m.id === id)),
    );
    return subscribeCache(() =>
      setMessage(getMessages().find((m) => m.id === id)),
    );
  }, [id]);
  if (!message)
    return (
      <p className="py-12 text-slate-500">
        Message introuvable. <Link to={BASE}>Retour à la liste</Link>
      </p>
    );
  return (
    <>
      <RecordHeader
        module="Messages"
        backTo={BASE}
        title={titleOf(message)}
        reference={`#${message.id}`}
        status={labelOf(message.status)}
        subtitle={`Reçu le ${fmtDateTime(message.createdAt)}`}
        action={
          <>
            <button className={btnOutline} onClick={() => setEditing(true)}>
              <Pencil size={15} />
              Modifier le suivi
            </button>
            {message.email && (
              <a href={`mailto:${message.email}`} className={btnPrimary}>
                <Mail size={15} />
                Répondre
              </a>
            )}
            <button
              className={btnIcon}
              aria-label="Supprimer le message"
              onClick={async () => {
                if (await askConfirm('Supprimer ce message ?')) {
                  try {
                    await deleteMessage(message.id);
                    navigate(BASE);
                  } catch (e) {
                    void notice(
                      e instanceof Error
                        ? e.message
                        : 'Suppression impossible.',
                    );
                  }
                }
              }}
            >
              <Trash2 size={15} />
            </button>
          </>
        }
      />
      <SummaryStrip
        facts={[
          { label: 'Expéditeur', value: nameOf(message) },
          {
            label: 'Téléphone',
            value: message.phone ? formatPhone(message.phone) : '',
          },
          { label: 'Email', value: message.email },
          { label: 'Reçu le', value: fmtDateTime(message.createdAt) },
        ]}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Résumé' },
          { id: 'contact', label: 'Coordonnées' },
        ]}
      />
      {tab === 'overview' && (
        <Section title="Contenu du message" icon={<Mail size={16} />}>
          <p className="whitespace-pre-line text-sm leading-7 text-slate-600">
            {message.message || 'Aucun contenu renseigné.'}
          </p>
        </Section>
      )}
      {tab === 'contact' && (
        <Section title="Coordonnées de l’expéditeur">
          <dl className="grid sm:grid-cols-2 gap-5">
            <Info label="Nom" value={nameOf(message)} />
            <Info
              label="Téléphone"
              value={
                message.phone ? (
                  <a href={phoneHref(message.phone)}>
                    {formatPhone(message.phone)}
                  </a>
                ) : (
                  ''
                )
              }
            />
            <Info
              label="Email"
              value={
                message.email ? (
                  <a href={`mailto:${message.email}`}>{message.email}</a>
                ) : (
                  ''
                )
              }
            />
            <Info label="Origine" value="Formulaire de contact du site" />
          </dl>
        </Section>
      )}
      {editing && (
        <MessageStatusForm
          message={message}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
