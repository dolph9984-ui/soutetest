import { ChevronLeft, ChevronRight, Minus, Plus, ScanLine } from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';

GlobalWorkerOptions.workerSrc = workerUrl;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.15;

export default function PdfViewer({
  source,
  title,
}: {
  source: string;
  title: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const task = getDocument({ url: source });
    documentRef.current = null;
    setPdf(null);
    setPageNumber(1);
    setPageCount(0);
    setZoom(1);
    setError('');
    setLoading(true);

    task.promise
      .then((document) => {
        if (!active) {
          void document.destroy();
          return;
        }
        documentRef.current = document;
        setPdf(document);
        setPageCount(document.numPages);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(
          'Ce PDF ne peut pas être affiché. Il est peut-être endommagé ou protégé par mot de passe.',
        );
        setLoading(false);
      });

    return () => {
      active = false;
      documentRef.current = null;
      void task.destroy().catch(() => {});
    };
  }, [source]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => setViewportWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !viewportWidth || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    setRendering(true);
    setError('');

    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.min(
          1.5,
          Math.max(0.25, (viewportWidth - 32) / baseViewport.width),
        );
        const viewport = page.getViewport({ scale: fitScale * zoom });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas indisponible.');

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;
        context.clearRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({
          canvas: null,
          canvasContext: context,
          viewport,
          transform:
            pixelRatio === 1
              ? undefined
              : [pixelRatio, 0, 0, pixelRatio, 0, 0],
          background: '#ffffff',
        });
        await renderTask.promise;
        if (!cancelled) setRendering(false);
      } catch (reason) {
        if (cancelled) return;
        if (reason instanceof Error && reason.name === 'RenderingCancelledException')
          return;
        setError('Impossible de préparer cette page du PDF.');
        setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, zoom, viewportWidth]);

  const changePage = (next: number) => {
    if (next >= 1 && next <= pageCount) setPageNumber(next);
  };

  return (
    <section
      aria-label={`Lecteur PDF : ${title}`}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg bg-slate-100 text-slate-800"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Page précédente"
            title="Page précédente"
            disabled={pageNumber <= 1 || loading}
            onClick={() => changePage(pageNumber - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-24 text-center text-xs tabular-nums text-slate-600" aria-live="polite">
            {pageCount ? `Page ${pageNumber} sur ${pageCount}` : '—'}
          </span>
          <button
            type="button"
            aria-label="Page suivante"
            title="Page suivante"
            disabled={pageNumber >= pageCount || loading}
            onClick={() => changePage(pageNumber + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Réduire le zoom"
            title="Réduire le zoom"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((value) => Math.max(MIN_ZOOM, +(value - ZOOM_STEP).toFixed(2)))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-slate-600">
            {Math.round(zoom * 100)} %
          </span>
          <button
            type="button"
            aria-label="Augmenter le zoom"
            title="Augmenter le zoom"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((value) => Math.min(MAX_ZOOM, +(value + ZOOM_STEP).toFixed(2)))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Ajuster à la largeur"
            title="Ajuster à la largeur"
            onClick={() => setZoom(1)}
            className="ml-1 inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs hover:bg-slate-100"
          >
            <ScanLine className="h-4 w-4" />
            <span className="hidden sm:inline">Ajuster</span>
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto p-4"
      >
        {loading && (
          <p role="status" className="m-auto text-sm text-slate-500">
            Chargement du PDF…
          </p>
        )}
        {!loading && error && (
          <div role="alert" className="m-auto max-w-md text-center text-sm text-slate-600">
            <p>{error}</p>
            <p className="mt-1 text-xs text-slate-500">
              Le bouton « Télécharger » reste disponible en haut de la fenêtre.
            </p>
          </div>
        )}
        {!loading && !error && (
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`${title} — page ${pageNumber} sur ${pageCount}`}
            className="block shrink-0 bg-white shadow-md"
          />
        )}
        {rendering && !error && !loading && (
          <span role="status" className="sr-only">
            Préparation de la page {pageNumber}…
          </span>
        )}
      </div>
    </section>
  );
}
