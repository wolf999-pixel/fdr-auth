import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import logoUrl from '../fond routier.jpg';
import { useAuth } from '../contexts/AuthContext';
import { LayoutShell } from '../components/Layout';
import PdfCanvasViewer from '../components/PdfCanvasViewer';

type VerificationResponse = {
  result: 'AUTHENTIQUE' | 'NON_AUTHENTIQUE';
  message?: string;
  reason?: string;
  qr?: {
    qr_uuid?: string;
    document_id?: string;
  };
  document?: {
    id?: string | null;
    reference?: string | null;
    subject?: string | null;
    recipient?: string | null;
    service?: string | null;
    year?: number | null;
    fileName?: string | null;
    sha256?: string | null;
    createdAt?: string | null;
  } | null;
};

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scannedMode, setScannedMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleDownloadPdf = async () => {
    const docId = result?.document?.id || result?.qr?.document_id;
    if (!docId || !token) return;

    setDownloadingPdf(true);
    const downloadUrl = `/api/documents/${docId}/public-secure-pdf?token=${encodeURIComponent(token)}`;

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        let errJson = null;
        try { errJson = await response.json(); } catch (_) {}
        alert(errJson?.error || `Erreur ${response.status} lors du téléchargement.`);
        return;
      }

      const blob = await response.blob();
      const cleanFileName = (result?.document?.fileName || 'document').replace(/\.pdf$/i, '');
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${cleanFileName}-certifie-fdr.pdf`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (err: any) {
      console.warn('Blob download failed, opening direct URL:', err);
      // Fallback direct URL pour smartphones
      window.open(downloadUrl, '_blank');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null);

  const verifyToken = async (tokenToVerify: string, fileToVerify: File | null = null) => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('token', tokenToVerify);
      if (fileToVerify) formData.append('file', fileToVerify);

      const response = await api.post('/verify', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult({
        result: response.data.result || 'NON_AUTHENTIQUE',
        message: response.data.message || (response.data.result === 'AUTHENTIQUE' ? 'DOCUMENT AUTHENTIQUE' : 'DOCUMENT NON AUTHENTIQUE'),
        reason: response.data.reason || '',
        qr: response.data.qr || null,
        document: response.data.document || null,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur lors de la vérification');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token.trim()) {
      setError('Veuillez renseigner un token de vérification ou scanner un QR code');
      return;
    }
    await verifyToken(token, file);
  };

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      setScannedMode(true);
      void verifyToken(urlToken, null);
    }
  }, [searchParams]);

  const isAuthentic = result?.result === 'AUTHENTIQUE';
  const isRevoked = result?.reason?.toLowerCase().includes('révoqué') || result?.reason?.toLowerCase().includes('revoked');

  const content = (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: scannedMode && !isAuthenticated ? '20px 16px' : '10px 0' }}>
      {/* Entête institutionnel pour le vérificateur externe sur smartphone */}
      {scannedMode && !isAuthenticated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, padding: '14px 18px', background: '#0b1f3a', borderRadius: 16, color: '#ffffff' }}>
          <img src={logoUrl} alt="Fonds Routier" style={{ width: 48, height: 48, borderRadius: 10, background: '#fff', padding: 3, objectFit: 'cover' }} />
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8 }}>Fonds Routier du Cameroun</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Portail de Vérification Officielle</div>
          </div>
        </div>
      )}

      <header className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <span className="eyebrow">Certification & Intégrité</span>
          <h1>Vérification d’authenticité</h1>
        </div>
        {isAuthenticated && (
          <Link to="/documents/qr" className="secondary-btn">← Liste des documents</Link>
        )}
      </header>

      {/* État de chargement initial lors du scan */}
      {loading && scannedMode && !result && (
        <div className="panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>🔍</div>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Vérification en cours...</h2>
          <p style={{ color: '#64748b', marginTop: 8 }}>Contrôle de l'authenticité et de l'intégrité auprès du registre FDR...</p>
        </div>
      )}

      {/* Résultat d'authentification proéminent */}
      {result && (
        <div
          style={{
            marginBottom: '24px',
            padding: '24px',
            borderRadius: '16px',
            border: isAuthentic ? '2px solid #22c55e' : isRevoked ? '2px solid #f97316' : '2px solid #ef4444',
            background: isAuthentic ? '#f0fdf4' : isRevoked ? '#fff7ed' : '#fef2f2',
            boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: '2.4rem' }}>
              {isAuthentic ? '✅' : isRevoked ? '⚠️' : '❌'}
            </span>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isAuthentic ? '#166534' : isRevoked ? '#9a3412' : '#991b1b' }}>
                Résultat de l’audit cryptographique
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: isAuthentic ? '#15803d' : isRevoked ? '#c2410c' : '#b91c1c' }}>
                {isAuthentic ? 'DOCUMENT AUTHENTIQUE ET VALIDE' : isRevoked ? 'DOCUMENT RÉVOQUÉ' : 'DOCUMENT NON AUTHENTIQUE'}
              </div>
            </div>
          </div>

          {result.reason && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.7)', borderRadius: 10, fontSize: '0.95rem', color: '#334155' }}>
              <strong>Constat :</strong> {result.reason}
            </div>
          )}

          {/* Fiche d'identification du document officiel */}
          {result.document && (
            <div style={{ marginTop: 18, background: '#ffffff', borderRadius: 12, padding: '18px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 10 }}>
                Informations du document certifié
              </div>
              <div className="form-grid">
                <div><strong>Référence :</strong> {result.document.reference || '—'}</div>
                <div><strong>Objet :</strong> {result.document.subject || '—'}</div>
                <div><strong>Destinataire :</strong> {result.document.recipient || '—'}</div>
                <div><strong>Service émetteur :</strong> {result.document.service || '—'}</div>
                <div><strong>Année fiscale :</strong> {result.document.year || '—'}</div>
                <div><strong>Nom du fichier :</strong> {result.document.fileName || '—'}</div>
              </div>
            </div>
          )}

          {/* Actions pour le vérificateur : Aperçu complet et Téléchargement PDF */}
          {isAuthentic && (result.document?.id || result.qr?.document_id) && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #bbf7d0', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="primary-btn"
                style={{ background: '#047857', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontSize: '1rem', fontWeight: 700 }}
                onClick={() => handleDownloadPdf()}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? 'Préparation du PDF...' : '📥 Télécharger le document certifié (PDF)'}
              </button>

              <button
                type="button"
                className="secondary-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', fontSize: '0.95rem', borderColor: '#047857', color: '#047857' }}
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? '🙈 Masquer l’aperçu' : '👁️ Aperçu du document complet avec QR'}
              </button>
            </div>
          )}

          {/* Section d'aperçu dynamique intégré du PDF sécurisé (Canvas PDF.js universel) */}
          {showPreview && isAuthentic && (result.document?.id || result.qr?.document_id) && (
            <div style={{ marginTop: 18, background: '#ffffff', borderRadius: 12, padding: '16px', border: '2px solid #22c55e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong style={{ fontSize: '1rem', color: '#166534' }}>
                  Aperçu officiel certifié — {result.document?.reference || 'Document FDR'}
                </strong>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 8px' }}
                >
                  ✕
                </button>
              </div>
              <PdfCanvasViewer
                url={`/api/documents/${result.document?.id || result.qr?.document_id}/public-secure-pdf?token=${encodeURIComponent(token)}`}
              />
            </div>
          )}

          {/* QR info technique */}
          {result.qr && (
            <div style={{ marginTop: 14, fontSize: '0.8rem', color: '#64748b' }}>
              <span>Identifiant unique QR : <code>{result.qr.qr_uuid}</code></span>
            </div>
          )}
        </div>
      )}

      {/* Formulaire manuel de vérification (pour les agents ou vérification avec fichier PDF) */}
      <div className="panel">
        <h3 style={{ margin: '0 0 14px' }}>
          {scannedMode ? 'Vérifier également avec le fichier PDF' : 'Contrôler un QR code ou un document'}
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 18 }}>
          Vous pouvez soumettre le token QR ou déposer le fichier PDF pour vérifier son empreinte numérique SHA-256.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 14 }}>
            Token cryptographique du QR code
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={3}
              placeholder="Collez ici le token JWT ou le lien scanné..."
              style={{ width: '100%', marginTop: 6 }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 14 }}>
            Fichier PDF original ou sécurisé (optionnel pour comparer le hash)
            <input type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'block', marginTop: 6 }} />
          </label>

          {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Vérification en cours...' : 'Lancer la vérification'}
          </button>
        </form>
      </div>

      {/* Pied de page du portail public */}
      {scannedMode && !isAuthenticated && (
        <div style={{ textAlign: 'center', marginTop: 30, color: '#64748b', fontSize: '0.85rem' }}>
          <p>© 2026 Fonds Routier du Cameroun — Système de certification et d'authentification numérique</p>
          <Link to="/login" style={{ color: '#163d76', fontWeight: 600 }}>Espace réservé aux agents du Fonds Routier →</Link>
        </div>
      )}
    </div>
  );

  // Si l'agent est connecté et qu'il consulte la page depuis le menu, on affiche la sidebar Layout
  if (isAuthenticated && !scannedMode) {
    return <LayoutShell>{content}</LayoutShell>;
  }

  // Sinon (visiteur scannant le QR code, ou mode public), affichage propre sans sidebar
  return content;
}

