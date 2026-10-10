/* ==========================================================================
   Boîtes de dialogue uniformes du back office.
   Remplacent les confirm() / alert() natifs du navigateur par des modales
   au système commun (surface neutre, focus natif, pied d'actions).

   Module volontairement AUTONOME (seulement React) pour éviter tout cycle
   d'import : sync.ts s'en sert pour signaler un échec de synchronisation.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../shared/overlay';
import { ADMIN_BUTTON_OUTLINE, ADMIN_BUTTON_PRIMARY } from '../tokens';

type Pending = { message: string; confirm: boolean };
let resolver: ((v: boolean) => void) | null = null;
let setter: ((p: Pending | null) => void) | null = null;

function show(message: string, confirm: boolean): Promise<boolean> {
  if (!setter) {
    // Hôte non monté (hors back office) : repli sur les boîtes natives.
    if (confirm) return Promise.resolve(window.confirm(message));
    window.alert(message);
    return Promise.resolve(true);
  }
  resolver?.(false); // une seule boîte à la fois
  const next = new Promise<boolean>((resolve) => {
    resolver = resolve;
  });
  setter({ message, confirm });
  return next;
}

/** Demande de confirmation charté — résout true si « Confirmer ». */
export const askConfirm = (message: string): Promise<boolean> =>
  show(message, true);

/** Information bloquante chartée — équivalent de alert(). */
export const notice = (message: string): Promise<boolean> =>
  show(message, false);

/** Hôte unique ; le dialogue natif piège et restitue le focus sans libellé métier perdu. */
export function DialogHost() {
  const [p, setP] = useState<Pending | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  useBodyScrollLock(!!p);
  useEffect(() => {
    setter = setP;
    return () => {
      setter = null;
      resolver?.(false);
      resolver = null;
    };
  }, []);
  useEffect(() => {
    const d = dialog.current;
    if (p && d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, [p]);
  const done = (v: boolean) => {
    setP(null);
    resolver?.(v);
    resolver = null;
  };
  if (!p) return null;
  return createPortal(
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-label={p.confirm ? 'Confirmation' : 'Information'}
      className="record-modal record-confirm admin-dialog"
      onCancel={(e) => {
        e.preventDefault();
        done(false);
      }}
    >
      <header>
        <h2>{p.confirm ? 'Confirmation' : 'Information'}</h2>
      </header>
      <div className="record-modal-content">
        <p className="whitespace-pre-line text-sm leading-relaxed">
          {p.message}
        </p>
      </div>
      <footer>
        <div>
          {p.confirm && (
            <button
              className={ADMIN_BUTTON_OUTLINE}
              onClick={() => done(false)}
            >
              Annuler
            </button>
          )}
          <button className={ADMIN_BUTTON_PRIMARY} onClick={() => done(true)}>
            {p.confirm ? 'Confirmer' : 'OK'}
          </button>
        </div>
      </footer>
    </dialog>,
    document.body,
  );
}
