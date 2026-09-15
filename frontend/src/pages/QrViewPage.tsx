import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

type DocumentInfo = {
  id: string;
  reference: string | null;
  subject: string | null;
  recipient: string | null;
  service: string | null;
  year: number | null;
  fileName: string;
  sha256: string;
  qrcodes?: Array<{ token?: string; qrUuid?: string; id?: string; verification_url?: string }>;
};

type QrInfo = {
  qr_uuid: string;
  token: string;
  verification_url?: string;
  qr_image_data_url?: string;
};

export default function QrViewPage() {
  const [searchParams] = useSearchParams();
  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [qr, setQr] = useState<QrInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadDocument = async (targetId: string) => {
    const response = await api.get(`/documents/${targetId}`);
    const currentDocument = response.data.document as DocumentInfo;
    setDocument(currentDocument);

    const currentQr = currentDocument.qrcodes?.[0];
    if (currentQr?.token) {
      setQr({
        qr_uuid: currentQr.qrUuid || currentQr.id || '—',
        token: currentQr.token,
        verification_url: currentQr.verification_url,
      });
      return;
    }

    setQr(null);
  };

  useEffect(() => {
    const documentId = searchParams.get('documentId');

    const fetchDocument = async () => {
      try {
        const targetId = documentId || (await api.get('/documents')).data.data?.[0]?.id;
        if (!targetId) {
          setLoading(false);
          return;
        }

        await loadDocument(targetId);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    void fetchDocument();
  }, [searchParams]);

  const handleGenerateQr = async () => {
    if (!document?.id) return;

    setGenerating(true);
    try {
      const response = await api.post(`/documents/${document.id}/qr`);
      setQr(response.data.qr);
    } catch (error) {
      console.error(error);
      alert('Impossible de générer le QR demandé.');
    } finally {
      setGenerating(false);
    }
  };

  // Use the public LAN URL so QR codes work when scanned from other devices
  const publicUrl = (
    import.meta.env.VITE_PUBLIC_URL ||
    import.meta.env.VITE_API_BASE_URL?.replace('/api', '') ||
    window.location.origin
  ).replace(/\/$/, '');
  const verificationUrl = qr?.verification_url || (qr?.token ? `${publicUrl}/verify?token=${encodeURIComponent(qr.token)}` : '');

  if (loading) return <div className="panel">Chargement du QR...</div>;

  return (
    <div>
      <header className="page-header">
        <div>
          <span className="eyebrow">QR sécurisé</span>
          <h1>Code QR du document</h1>
        </div>
      </header>

      <div className="qr-panel">
        <div className="document-preview">
          <div className="doc-card">
            <h3>Document</h3>
            <p><strong>Référence :</strong> {document?.reference || '—'}</p>
            <p><strong>Objet :</strong> {document?.subject || '—'}</p>
            <p><strong>Destinataire :</strong> {document?.recipient || '—'}</p>
            <p><strong>Service :</strong> {document?.service || '—'}</p>
            <p><strong>Année :</strong> {document?.year || '—'}</p>
            <p><strong>Fichier :</strong> {document?.fileName || '—'}</p>
          </div>
        </div>

        <div className="qr-box">
          {qr?.token ? (
            <QRCodeSVG value={verificationUrl} size={220} includeMargin />
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <p>Le QR n’a pas encore été généré.</p>
              <button className="primary-btn" onClick={handleGenerateQr} disabled={generating}>
                {generating ? 'Génération...' : 'Générer le QR'}
              </button>
            </div>
          )}
        </div>

        <div className="qr-info">
          <h3>Informations du QR</h3>
          <p><strong>Document :</strong> {document?.reference || '—'}</p>
          <p><strong>QR UUID :</strong> {qr?.qr_uuid || '—'}</p>
          <p><strong>Empreinte SHA-256 :</strong> {document?.sha256 || '—'}</p>
          <p><strong>Signature :</strong> Token JWT signé</p>
          <p><strong>Fichier :</strong> {document?.fileName || '—'}</p>
          {!qr?.token && (
            <button className="primary-btn" onClick={handleGenerateQr} disabled={generating}>
              {generating ? 'Génération...' : 'Générer le QR'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
