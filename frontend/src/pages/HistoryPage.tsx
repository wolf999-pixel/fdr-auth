import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

type HistoryItem = {
  id?: string;
  type: 'verification' | 'audit';
  date: string;
  action: string;
  reason?: string | null;
  actor: string;
  document?: {
    id?: string | null;
    reference?: string | null;
    subject?: string | null;
    recipient?: string | null;
    service?: string | null;
    year?: number | null;
    fileName?: string | null;
    sha256?: string | null;
  } | null;
  qr?: {
    qrUuid?: string;
    revoked?: boolean;
  } | null;
  details?: any;
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/history')
      .then((response) => setItems(response.data.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const getActionBadge = (action: string) => {
    if (action === 'AUTHENTIQUE') return <span className="status-badge success">Authentique</span>;
    if (action === 'NON_AUTHENTIQUE') return <span className="status-badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Non authentique</span>;
    if (action === 'QR_REVOKED' || action.includes('REVOKE')) return <span className="status-badge" style={{ background: '#ffedd5', color: '#9a3412' }}>Révocation</span>;
    if (action === 'DOCUMENT_CREATED') return <span className="status-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>Création</span>;
    if (action === 'QR_GENERATED') return <span className="status-badge" style={{ background: '#f3e8ff', color: '#6b21a8' }}>Génération QR</span>;
    if (action === 'SIGNED_DOCUMENT_UPLOADED') return <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>Version signée</span>;
    return <span className="status-badge warning">{action}</span>;
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <span className="eyebrow">Traçabilité & Audit</span>
          <h1>Historique des opérations</h1>
        </div>
      </header>

      <div className="panel">
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
          💡 <strong>Astuce :</strong> Cliquez sur une ligne du journal pour afficher les détails complets de l'opération et du document associé.
        </p>

        {loading ? (
          <p>Chargement de l’historique...</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Date & Heure</th>
                <th>Type</th>
                <th>Action / Résultat</th>
                <th>Référence Document</th>
                <th>Auteur / Source</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>Aucune opération enregistrée pour le moment.</td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr
                    key={`${item.date}-${index}`}
                    onClick={() => setSelectedItem(item)}
                    style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                    title="Cliquez pour voir les détails"
                  >
                    <td>{new Date(item.date).toLocaleString('fr-FR')}</td>
                    <td>
                      <span style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: '6px', background: item.type === 'verification' ? '#e0f2fe' : '#f1f5f9', color: item.type === 'verification' ? '#0369a1' : '#475569', fontWeight: 600 }}>
                        {item.type === 'verification' ? 'Scan Vérif' : 'Audit'}
                      </span>
                    </td>
                    <td>{getActionBadge(item.action)}</td>
                    <td><strong>{item.document?.reference || '—'}</strong></td>
                    <td>{item.actor}</td>
                    <td>
                      <button
                        className="secondary-btn"
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                        }}
                      >
                        🔍 Voir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal / Tiroir de détails complets */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 31, 58, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            style={{
              background: '#ffffff',
              width: 'min(680px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div>
                <span className="eyebrow" style={{ fontSize: '0.75rem' }}>Journal d'audit détaillé</span>
                <h2 style={{ margin: '4px 0 0', fontSize: '1.4rem' }}>Détails de l'opération</h2>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: '1.2rem', display: 'grid', placeItems: 'center' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Type & Action</div>
                  <div style={{ marginTop: 4 }}>{getActionBadge(selectedItem.action)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Date & Heure</div>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{new Date(selectedItem.date).toLocaleString('fr-FR')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Intervenant</div>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{selectedItem.actor}</div>
                </div>
              </div>

              {selectedItem.reason && (
                <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>
                  <strong>Motif / Résultat :</strong> {selectedItem.reason}
                </div>
              )}

              {/* Fiche d'identification du document lié */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px' }}>
                <h3 style={{ fontSize: '1rem', margin: '0 0 12px', color: '#163d76' }}>📄 Informations sur le document</h3>
                {selectedItem.document ? (
                  <div className="form-grid">
                    <div><strong>Référence :</strong> {selectedItem.document.reference || '—'}</div>
                    <div><strong>Objet :</strong> {selectedItem.document.subject || '—'}</div>
                    <div><strong>Destinataire :</strong> {selectedItem.document.recipient || '—'}</div>
                    <div><strong>Service émetteur :</strong> {selectedItem.document.service || '—'}</div>
                    <div><strong>Année :</strong> {selectedItem.document.year || '—'}</div>
                    <div><strong>Fichier :</strong> {selectedItem.document.fileName || '—'}</div>
                    {selectedItem.document.sha256 && (
                      <div className="full-width" style={{ wordBreak: 'break-all', fontSize: '0.8rem', color: '#475569', marginTop: 6, background: '#f8fafc', padding: 8, borderRadius: 6 }}>
                        <strong>Empreinte SHA-256 :</strong><br />
                        <code>{selectedItem.document.sha256}</code>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>Aucun document direct associé à cet événement d'audit système.</p>
                )}
              </div>

              {/* QR uuid si présent */}
              {selectedItem.qr && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', fontSize: '0.85rem' }}>
                  <strong>Code QR associé :</strong> <code>{selectedItem.qr.qrUuid}</code>
                  {selectedItem.qr.revoked !== undefined && (
                    <span style={{ marginLeft: 10, fontWeight: 700, color: selectedItem.qr.revoked ? '#dc2626' : '#16a34a' }}>
                      ({selectedItem.qr.revoked ? 'Actuellement révoqué' : 'Actif'})
                    </span>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
              {selectedItem.document?.id && (
                <button
                  className="primary-btn"
                  onClick={() => {
                    navigate(`/documents/${selectedItem.document?.id}/secure`);
                    setSelectedItem(null);
                  }}
                >
                  Voir la fiche du document →
                </button>
              )}
              <button className="secondary-btn" onClick={() => setSelectedItem(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
