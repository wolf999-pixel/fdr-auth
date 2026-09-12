import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type Doc = any;

export default function SecureDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const refreshDocuments = async () => {
    const res = await api.get('/documents');
    setDocs(res.data.data || []);
  };

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const res = await api.get('/documents');
        setDocs(res.data.data || []);
      } catch (error) {
        setDocs([]);
      } finally {
        setLoading(false);
      }
    };

    void loadDocs();
  }, []);

  const handleGenerateQr = async (documentId: string) => {
    setProcessingId(documentId);
    try {
      await api.post(`/documents/${documentId}/qr`);
      await refreshDocuments();
    } catch (error) {
      console.error('Failed to generate QR:', error);
      alert('Impossible de générer le QR pour ce document.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleExport = async (id: string) => {
    const targetDocument = docs.find((item) => item.id === id);
    if (!targetDocument?.qrcodes?.length) {
      alert(`Ce document n'est pas encore sécurisé. Générez d'abord un QR.`);
      return;
    }

    setProcessingId(id);
    try {
      const token = localStorage.getItem('auth_token') || '';
      const response = await fetch(`/api/documents/${id}/secure-pdf?token=${encodeURIComponent(token)}`, {
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
        alert('Le fichier reçu est vide. Veuillez réessayer ou régénérer le QR.');
        return;
      }

      const cleanFileName = (targetDocument.fileName || 'document').replace(/\.pdf$/i, '');
      const filename = `${cleanFileName}-secure.pdf`;

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (error: any) {
      console.error('Download error:', error);
      alert('Impossible de joindre le serveur pour télécharger le document.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevoke = async (qrUuid: string) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer ce QR code ? Cette action est irréversible.')) {
      return;
    }
    setProcessingId(qrUuid);
    try {
      await api.post(`/qr/revoke/${qrUuid}`);
      alert('QR code révoqué avec succès.');
      await refreshDocuments();
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Erreur lors de la révocation';
      alert(msg);
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    const documentId = searchParams.get('documentId');
    if (!documentId) return;

    const autoOpenQrPage = () => {
      navigate('/documents/qr', { replace: true });
    };

    void autoOpenQrPage();
  }, [searchParams, navigate]);

  if (loading) return <div className="panel">Chargement...</div>;

  const docsWithQr = docs.filter((d) => d.qrcodes && d.qrcodes.length > 0);
  const docsWithoutQr = docs.filter((d) => !d.qrcodes || d.qrcodes.length === 0);

  return (
    <div>
      <header className="page-header">
        <div>
          <span className="eyebrow">Documents sécurisés</span>
          <h1>Documents avec QR</h1>
        </div>
        <Link to="/documents/new" className="primary-btn">+ Nouveau document</Link>
      </header>

      {docsWithoutQr.length > 0 && (
        <div className="panel" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--muted-200)', borderLeft: '4px solid var(--accent)' }}>
          <p><strong>ℹ️ {docsWithoutQr.length} document(s) en attente de QR</strong></p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            Générer le QR de chaque document avant de pouvoir le sécuriser puis le télécharger.
          </p>
        </div>
      )}

      <div className="panel">
        {docsWithQr.length === 0 && docsWithoutQr.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-600)' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Aucun document pour le moment</p>
            <p style={{ fontSize: '0.95rem' }}>Créez un document pour commencer la sécurisation.</p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Statut</th>
                <th>Référence</th>
                <th>Objet</th>
                <th>QR</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const hasQr = Boolean(d.qrcodes && d.qrcodes.length);
                const qr = hasQr ? d.qrcodes[0] : null;
                const isRevoked = qr?.revoked;
                return (
                  <tr key={d.id}>
                    <td>
                      {hasQr ? (
                        isRevoked ? (
                          <span className="status-badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Révoqué</span>
                        ) : (
                          <span className="status-badge success">Sécurisé</span>
                        )
                      ) : (
                        <span className="status-badge warning">Non sécurisé</span>
                      )}
                    </td>
                    <td>{d.reference || '—'}</td>
                    <td>{d.subject || '—'}</td>
                    <td>{(d.qrcodes && d.qrcodes.length) || 0}</td>
                    <td>
                      {hasQr ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <button className="secondary-btn" onClick={() => navigate(`/documents/${d.id}/secure`)}>Voir</button>
                          <button
                            className="primary-btn"
                            onClick={() => handleExport(d.id)}
                            disabled={processingId === d.id}
                          >
                            {processingId === d.id ? '...' : '📥 PDF'}
                          </button>
                          <button
                            className="secondary-btn"
                            onClick={() => navigate(`/documents/${d.id}/signed`)}
                          >
                            📎 Version signée
                          </button>
                          {isAdmin && qr && !isRevoked && (
                            <button
                              className="secondary-btn"
                              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                              onClick={() => handleRevoke(qr.qrUuid)}
                              disabled={processingId === qr.qrUuid}
                            >
                              {processingId === qr.qrUuid ? '...' : '🚫 Révoquer'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          className="primary-btn"
                          onClick={() => handleGenerateQr(d.id)}
                          disabled={processingId === d.id}
                        >
                          {processingId === d.id ? 'Génération...' : 'Générer le QR'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
