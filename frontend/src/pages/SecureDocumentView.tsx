import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  qrcodes?: Array<{ id: string; qrUuid: string; token: string; revoked: boolean }>;
};

export default function SecureDocumentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadDocument = async () => {
      try {
        const response = await api.get(`/documents/${id}`);
        setDocument(response.data.document as DocumentInfo);
      } catch (error) {
        console.error('Unable to load secure document', error);
      } finally {
        setLoading(false);
      }
    };

    void loadDocument();
  }, [id]);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!document) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem('auth_token') || '';
      const response = await fetch(`/api/documents/${document.id}/secure-pdf?token=${encodeURIComponent(token)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        alert('Votre session a expiré. Veuillez vous reconnecter.');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        let errorMsg = `Erreur ${response.status} lors du téléchargement`;
        try {
          const errData = await response.json();
          if (errData?.error) errorMsg = errData.error;
        } catch (_) {}
        alert(errorMsg);
        return;
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        alert('Le fichier reçu est vide.');
        return;
      }

      const cleanFileName = (document.fileName || 'document').replace(/\.pdf$/i, '');
      const filename = `${cleanFileName}-secure.pdf`;

      const blobUrl = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      window.document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (err: any) {
      console.error('Download error:', err);
      alert('Erreur lors du téléchargement du document sécurisé.');
    } finally {
      setDownloading(false);
    }
  };

  if (!id) return <div className="panel">Document introuvable</div>;
  if (loading) return <div className="panel">Chargement de l’aperçu...</div>;

  const qr = document?.qrcodes?.[0];
  const verificationUrl = qr?.token
    ? `${window.location.origin}/verify?token=${encodeURIComponent(qr.token)}`
    : '';

  return (
    <div>
      <header className="page-header">
        <div>
          <span className="eyebrow">Aperçu</span>
          <h1>Document sécurisé</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="secondary-btn" onClick={() => navigate('/documents/qr')}>
            ← Retour aux documents
          </button>
          <button className="primary-btn" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Téléchargement...' : '📥 Télécharger le PDF sécurisé'}
          </button>
        </div>
      </header>

      <div className="panel" style={{ display: 'grid', placeItems: 'center', minHeight: '65vh' }}>
        <div
          style={{
            width: 'min(720px, 100%)',
            background: '#ffffff',
            border: '1px solid #d9dfe8',
            borderRadius: '18px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
            padding: '2rem',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280' }}>
                Document sécurisé officiel
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
                {document?.reference || 'Référence inconnue'}
              </div>
            </div>
            <span
              style={{
                padding: '0.45rem 0.8rem',
                borderRadius: '999px',
                background: qr?.revoked ? '#fee2e2' : '#dcfce7',
                color: qr?.revoked ? '#991b1b' : '#166534',
                fontWeight: 700,
                fontSize: '0.8rem'
              }}
            >
              {qr?.revoked ? 'QR révoqué' : 'QR actif'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '14px', padding: '1.2rem', background: '#f9fafb' }}>
              <p style={{ margin: '0.4rem 0' }}><strong>Objet :</strong> {document?.subject || '—'}</p>
              <p style={{ margin: '0.4rem 0' }}><strong>Destinataire :</strong> {document?.recipient || '—'}</p>
              <p style={{ margin: '0.4rem 0' }}><strong>Service :</strong> {document?.service || '—'}</p>
              <p style={{ margin: '0.4rem 0' }}><strong>Année :</strong> {document?.year || '—'}</p>
              <p style={{ margin: '0.4rem 0' }}><strong>Fichier :</strong> {document?.fileName || '—'}</p>
              <p style={{ margin: '0.4rem 0', wordBreak: 'break-all', fontSize: '0.8rem' }}>
                <strong>SHA-256 :</strong> {document?.sha256 || '—'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              {verificationUrl ? (
                <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <QRCodeSVG value={verificationUrl} size={170} includeMargin />
                </div>
              ) : (
                <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>Aucun QR code disponible</div>
              )}
              <small style={{ color: '#64748b', fontSize: '0.75rem', textAlign: 'center' }}>
                Scannable par smartphone pour vérification immédiate
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
