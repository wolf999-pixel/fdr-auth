import { useEffect, useState } from 'react';
import api from '../services/api';

type HistoryItem = {
  type: 'verification' | 'audit';
  date: string;
  action: string;
  reason?: string | null;
  actor: string;
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/history')
      .then((response) => setItems(response.data.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <header className="page-header">
        <div>
          <span className="eyebrow">Historique</span>
          <h1>Historique des opérations</h1>
        </div>
      </header>

      <div className="panel">
        {loading ? (
          <p>Chargement de l’historique...</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Raison</th>
                <th>Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4}>Aucune opération enregistrée.</td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={`${item.date}-${index}`}>
                    <td>{new Date(item.date).toLocaleString('fr-FR')}</td>
                    <td>{item.action}</td>
                    <td>{item.reason || '—'}</td>
                    <td>{item.actor}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
