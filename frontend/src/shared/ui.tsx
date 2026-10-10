import { useBodyScrollLock, useDialogFocus } from './overlay';
import { Fragment, useEffect, useId, useRef, useState } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import {
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  Search,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Land } from "../types";

/* ==========================================================================
   Kit UI — style des pages Accueil / À propos + conformité WCAG AA
   (focus visible géré globalement dans index.css :focus-visible).
   ========================================================================== */

export function Eyebrow({
  children,
  light = false,
  className = "",
}: {
  children: ReactNode;
  light?: boolean;
  className?: string;
}) {
  return (
    <p
      className={`flex items-center gap-3 text-sm font-semibold mb-3 ${light ? "text-gold-500" : "text-navy-900"} ${className}`}
    >
      <span className="h-[3px] w-7 rounded-full bg-gold-500" />
      {children}
    </p>
  );
}

export function PageHero({
  pill,
  title,
  lead,
  image,
  flat = false,
  children,
}: {
  pill: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Photo en fond à droite, dégradée vers le bleu marine (style maison). */
  image?: string;
  /** Bord inférieur droit (sans courbe), comme les en-têtes de la référence. */
  flat?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      className={`relative overflow-hidden bg-navy-900 pt-8 text-white md:pt-10 ${flat ? "pb-16 md:pb-20" : "pb-28 md:pb-32"}`}
    >
      {/* Photo à droite en fondu — comme l'en-tête de la page Contact de référence */}
      {image && (
        <div
          className="absolute inset-y-0 right-0 hidden w-[58%] md:block"
          aria-hidden
        >
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/75 to-navy-900/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 via-transparent to-transparent" />
        </div>
      )}

      {/* Galettes dorées organiques — signature des pages Accueil / À propos */}
      <svg
        className="absolute left-0 top-8 h-24 w-5 text-gold-500 md:h-32 md:w-7"
        viewBox="0 0 30 160"
        aria-hidden
      >
        <path fill="currentColor" d="M0,0 C30,30 30,120 0,160 Z" />
      </svg>
      <svg
        className="absolute bottom-16 right-0 z-10 h-32 w-8 text-gold-500"
        viewBox="0 0 40 180"
        aria-hidden
      >
        <path fill="currentColor" d="M40,0 C0,40 0,140 40,180 Z" />
      </svg>

      <div className="relative z-10 mx-auto max-w-full px-4 sm:px-6 lg:px-8 pt-4 md:pt-6">
        <span className="inline-block rounded-md bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em]">
          {pill}
        </span>
        <h1 className="mt-4 max-w-2xl text-3xl font-extrabold leading-[1.1] tracking-tight md:text-4xl">
          {title}
        </h1>
        {lead && (
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/80 md:text-base">
            {lead}
          </p>
        )}
        {children && <div className="w-full pt-5">{children}</div>}
      </div>

      {/* Courbe descendante vers le fond de page (désactivée en mode « flat ») */}
      {!flat && (
        <svg
          className="absolute -bottom-px left-0 z-0 block h-14 w-full text-mist md:h-20"
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M0,0 C330,72 830,95 1440,72 L1440,92 L0,92 Z"
          />
        </svg>
      )}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  text,
  action,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-6 ${align === "center" ? "flex-col items-center text-center" : ""}`}
    >
      <div
        className={
          align === "center" ? "flex flex-col items-center" : "max-w-xl"
        }
      >
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-navy-900 md:text-3xl">
          {title}
        </h2>
        {text && (
          <p className="mt-4 text-sm leading-relaxed text-navy-900/85">
            {text}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Message d'erreur : icône + texte + role="alert" — jamais la couleur seule. */
export function ErrorBanner({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role="alert"
      className={`flex items-start gap-2.5 rounded-xl bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700 ${className}`}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Piège de focus + restitution du focus — à attacher au panneau d'une modale/d'un drawer. */
/** Verrouille le défilement de la page tant qu'un overlay (modale, visionneuse)
    est ouvert — seule la modale reste accessible au scroll.
    - compense la disparition de la barre de défilement (aucun saut de mise en page)
    - les empilements de modales (ex. formulaire + connexion) sont gérés en LIFO :
      le scroll n'est rendu qu'à la fermeture de la dernière. */
export { useBodyScrollLock, useDialogFocus } from './overlay';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();
  const panelRef = useDialogFocus(open, onClose);
  useBodyScrollLock(open); // la page derrière est figée : seule la modale défile
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-navy-950/40 backdrop-blur-sm"
          onMouseDown={onClose}
        >
          {/* L'overlay défile (pas la carte) : la barre de défilement reste au bord droit de l'écran. */}
          <div className="flex min-h-full w-full items-end justify-center p-0 sm:items-center sm:p-6">
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              tabIndex={-1}
              initial={{ opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={`w-full ${widths[size]} rounded-t-[2rem] bg-white shadow-2xl outline-none sm:rounded-[2rem]`}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {(title || subtitle) && (
                <div className="flex items-start justify-between gap-6 border-b border-navy-900/10 px-8 pt-8 pb-6">
                  <div>
                    {title && (
                      <h2
                        id={titleId}
                        className="text-2xl font-bold tracking-tight text-navy-900"
                      >
                        {title}
                      </h2>
                    )}
                    {subtitle && (
                      <p className="mt-1.5 text-xs text-navy-900/75">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Fermer"
                    className="rounded-full border border-navy-900/20 p-3 text-navy-900/75 transition hover:bg-brand-50 hover:text-navy-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="px-8 pt-7 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
                {children}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function UploadZone({
  title,
  text,
  accept = "image/*",
  multiple = false,
  maxFiles,
  maxMb = 5,
  onFiles,
  onPick,
  files = [],
}: {
  title: string;
  text: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxMb?: number;
  onFiles: (names: string[]) => void;
  /** Reçoit les objets File retenus : ils sont réellement envoyés au backend. */
  onPick?: (picked: File[]) => void;
  files: string[];
}) {
  const inputId = `upload-${useId()}`;
  const hintId = `${inputId}-hint`;
  const fileLimit = maxFiles ?? (multiple ? 12 : 1);
  const allowedTypes = accept.split(",").map((rule) => rule.trim().toLowerCase()).filter(Boolean);
  const acceptedLabel = allowedTypes
    .map((rule) => rule.startsWith(".") ? rule.slice(1).toUpperCase() : rule.split("/").pop()?.replace("*", "tous formats").toUpperCase() ?? rule)
    .join(", ");
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    if (picked.length > fileLimit) {
      setError(`${fileLimit} fichier${fileLimit > 1 ? "s" : ""} maximum par envoi.`);
      return;
    }

    const valid: File[] = [];
    let problem: string | null = null;
    for (const file of picked) {
      const name = file.name.toLowerCase();
      const mime = file.type.toLowerCase();
      const typeAllowed = allowedTypes.some((rule) => {
        if (rule.startsWith(".")) return name.endsWith(rule);
        if (rule.endsWith("/*")) return mime.startsWith(rule.slice(0, -1));
        return mime === rule;
      });
      if (!typeAllowed) {
        problem = `« ${file.name} » n’est pas dans les formats acceptés (${acceptedLabel}).`;
        continue;
      }
      if (file.size > maxMb * 1024 * 1024) {
        problem = `« ${file.name} » dépasse la limite de ${maxMb} Mo par fichier.`;
        continue;
      }
      valid.push(file);
    }
    setError(problem);
    if (valid.length > 0) {
      onFiles(valid.map((file) => file.name));
      onPick?.(valid);
    }
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-navy-900/40 bg-white px-6 py-9 text-center transition hover:border-gold-500 hover:bg-white focus-within:ring-2 focus-within:ring-navy-900 focus-within:ring-offset-2"
      >
        <UploadCloud
          className="h-7 w-7 text-navy-900/60"
          strokeWidth={2}
          aria-hidden
        />
        <strong className="mt-3 text-sm font-semibold text-navy-900">
          {title}
        </strong>
        <p className="mt-1 text-xs text-navy-900/75">{text}</p>
        <span className="btn-outline mt-4 !px-4 !py-2 !text-xs">
          Choisir des fichiers
        </span>
        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          aria-describedby={hintId}
          onChange={(event) => {
            handleFiles(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <small id={hintId} className="mt-2 block text-xs text-navy-900/75">
        Formats autorisés : {acceptedLabel} · {maxMb} Mo maximum par fichier
        {multiple ? ` · ${fileLimit} fichiers maximum` : ""}.
      </small>
      {error && <ErrorBanner className="mt-3">{error}</ErrorBanner>}
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((file) => (
            <span key={file} className="chip-off !cursor-default !bg-white">
              <FileCheck2 className="h-3.5 w-3.5 text-green-700" aria-hidden />
              {file}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProgressSteps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="flex w-full items-start" aria-label="Étapes du formulaire">
      {steps.map((label, i) => (
        <Fragment key={label}>
          <div
            className="flex min-w-[3.6rem] flex-col items-center gap-2 sm:min-w-[5rem]"
            aria-current={i === current ? "step" : undefined}
          >
            <span
              className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition-all duration-300 ${
                i < current
                  ? "bg-navy-900 text-white"
                  : i === current
                    ? "bg-gold-500 text-navy-900 shadow-md shadow-gold-500/40"
                    : "border border-navy-900/20 bg-white text-navy-900/55"
              }`}
            >
              {i < current ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              ) : (
                i + 1
              )}
            </span>
            <small
              className={`text-center text-xs ${
                i === current
                  ? "font-bold text-navy-900"
                  : i < current
                    ? "font-semibold text-navy-900/85"
                    : "font-medium text-navy-900/55"
              }`}
            >
              {label}
            </small>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`mt-[1.05rem] h-[2px] flex-1 rounded-full transition-colors duration-500 ${i < current ? "bg-gold-500" : "bg-navy-900/15"}`}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

export function FormField({
  label,
  required = false,
  hint,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">
        {label}
        {required && (
          <em className="ml-0.5 not-italic text-gold-700" aria-hidden>
            *
          </em>
        )}
      </span>
      {children}
      {hint && (
        <small className="mt-1.5 block text-xs text-navy-900/75">{hint}</small>
      )}
    </label>
  );
}

export function Input({
  icon: Icon,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icon?: typeof Search }) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-900/55"
          aria-hidden
        />
      )}
      <input
        {...props}
        className={`input ${Icon ? "pl-11" : ""} ${className}`}
      />
    </div>
  );
}

export function Select({
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`select ${className}`}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-900/60"
        aria-hidden
      />
    </div>
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input resize-none ${className}`} />;
}

export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: {
    value: T;
    label: string;
    description?: string;
    icon?: typeof Search;
  }[];
  value: T;
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3 | 4;
}) {
  return (
    <div
      className={`grid gap-3 ${columns === 1 ? "" : columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}
    >
      {options.map((o) => {
        const Icon = o.icon;
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all duration-300 ${
              selected
                ? "border border-gold-500 bg-gold-500/10 shadow-lg shadow-gold-500/10"
                : "border border-navy-900/40 bg-white/80 hover:border-navy-900/60 hover:bg-white"
            }`}
          >
            {Icon && (
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors ${
                  selected
                    ? "bg-gold-500 text-navy-900"
                    : "bg-navy-900/5 text-navy-900/75"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            )}
            <span className="flex-1">
              <strong className="block text-sm font-bold text-navy-900">
                {o.label}
              </strong>
              {o.description && (
                <small className="mt-0.5 block text-xs text-navy-900/75">
                  {o.description}
                </small>
              )}
            </span>
            {selected && (
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-gold-700"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Confirmation affichée après l'enregistrement d'une demande (modale). */
export function RequestSuccess({
  reference,
  title = "Demande enregistrée",
  text,
  onClose,
}: {
  reference: string;
  title?: string;
  text?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-gold-500/15 text-gold-700">
        <CheckCircle2 className="h-8 w-8" aria-hidden />
      </span>
      <h3 className="text-2xl font-bold tracking-tight text-navy-900">
        {title}
      </h3>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-navy-900/75">
        Votre demande{" "}
        <strong className="font-bold text-navy-900">{reference}</strong> a bien
        été enregistrée. Notre équipe étudie votre dossier et vous recontacte
        très vite.
      </p>
      {text && (
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-navy-900/60">
          {text}
        </p>
      )}
      <button onClick={onClose} className="btn-gold mt-7">
        Fermer
      </button>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Search,
  title,
  text,
  action,
  onAction,
  children,
}: {
  icon?: typeof Search;
  title: string;
  text?: ReactNode;
  action?: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="card-soft flex flex-col items-center px-8 py-20 text-center">
      <span className="mb-6 grid h-14 w-14 place-items-center rounded-full bg-navy-900 text-gold-500">
        <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
      </span>
      <h3 className="text-2xl font-bold tracking-tight text-navy-900">
        {title}
      </h3>
      {text && (
        <p className="mt-3 max-w-md text-sm leading-relaxed text-navy-900/80">
          {text}
        </p>
      )}
      {action && (
        <button onClick={onAction} className="btn-outline mt-7">
          {action}
        </button>
      )}
      {children}
    </div>
  );
}
