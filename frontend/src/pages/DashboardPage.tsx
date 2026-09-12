import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

type DashboardStats = {
  totalDocuments: number;
  totalQr: number;
  totalAuthentications: number;
  monthlyAuthentications: Array<{ month: string; count: number }>;
};

const defaultStats: DashboardStats = {
  totalDocuments: 0,
  totalQr: 0,
  totalAuthentications: 0,
  monthlyAuthentications: []
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);

  useEffect(() => {
    api.get('/documents/stats')
      .then((response) => setStats(response.data.data || defaultStats))
      .catch(() => setStats(defaultStats));
  }, []);

  const statCards = useMemo<Array<{ label: string; value: number; tone: string }>>(() => [
    { label: 'Documents enregistrés', value: stats.totalDocuments, tone: 'blue' },
    { label: 'QR générés', value: stats.totalQr, tone: 'green' },
    { label: 'Authentifiés', value: stats.totalAuthentications, tone: 'orange' },
    { label: 'Mois actifs', value: stats.monthlyAuthentications.length, tone: 'purple' }
  ], [stats]);

  return (
    <div>
      <header className="page-header">
        <div>
          <span className="eyebrow">Tableau de bord</span>
          <h1>Suivi des documents signés</h1>
        </div>
        <Link to="/documents/new" className="primary-btn">+ Nouveau document</Link>
      </header>

      <div className="stats-grid">
        {statCards.map((item) => (
          <div key={item.label} className={`stat-card ${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="card-grid">
        <div className="panel">
          <h3>Actions rapides</h3>
          <div className="action-stack">
            <Link to="/documents/new">Enregistrer un document</Link>
            <Link to="/documents/qr">Voir le QR</Link>
            <Link to="/verify">Vérifier un document</Link>
            <Link to="/history">Consulter l’historique</Link>
          </div>
        </div>

        <div className="panel">
          <h3>Authentifications par mois</h3>
          <ul className="timeline">
            {stats.monthlyAuthentications.length === 0 ? (
              <li>Aucune vérification authentifiée pour le moment.</li>
            ) : (
              stats.monthlyAuthentications.map((entry) => (
                <li key={entry.month}>
                  <strong>{entry.month}</strong> — {entry.count} document(s) authentifié(s)
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
