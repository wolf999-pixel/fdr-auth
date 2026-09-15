import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configuration du worker PDF.js vers cdnjs ou local
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type Props = {
  url: string;
};

export default function PdfCanvasViewer({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    const renderPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false });
        const pdfDoc = await loadingTask.promise;
        if (!isMounted) return;

        setNumPages(pdfDoc.numPages);
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          if (!isMounted) return;

          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.maxWidth = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 16px auto';
          canvas.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
          canvas.style.borderRadius = '6px';
          canvas.style.background = '#ffffff';

          if (context) {
            await page.render({ canvasContext: context, viewport, canvas } as any).promise;
          }
          if (isMounted && container) {
            container.appendChild(canvas);
          }
        }
      } catch (err: any) {
        console.warn('PDF.js render failed, will use fallback:', err.message);
        if (isMounted) {
          setError(err.message || 'Impossible de charger l\'aperçu direct.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void renderPdf();

    return () => {
      isMounted = false;
    };
  }, [url]);

  return (
    <div style={{ width: '100%', background: '#f1f5f9', padding: '14px', borderRadius: '10px' }}>
      {loading && (
        <div style={{ textAlign: 'center', padding: '30px 10px', color: '#475569' }}>
          <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>📄</div>
          <p style={{ margin: 0, fontWeight: 600 }}>Génération de l'aperçu du document certifié...</p>
        </div>
      )}

      {error ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ color: '#b91c1c', marginBottom: 12 }}>
            L'aperçu interactif n'a pas pu s'afficher directement ({error}).
          </p>
          <iframe
            src={url}
            title="Aperçu du document sécurisé"
            style={{ width: '100%', height: '520px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
          />
        </div>
      ) : (
        <>
          {numPages > 0 && (
            <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', marginBottom: 10 }}>
              {numPages} page{numPages > 1 ? 's' : ''} — Document avec cachet QR
            </div>
          )}
          <div ref={containerRef} style={{ width: '100%', overflowY: 'auto', maxHeight: '680px' }} />
        </>
      )}
    </div>
  );
}
