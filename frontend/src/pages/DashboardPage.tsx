import { Link } from 'react-router-dom';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type DashboardStats = {
  totalDocuments: number;
  totalQr: number;
  totalAuthentications: number;
  monthlyAuthentications: Array<{ month: string; count: number }>;
};

type AgentItem = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  createdAt: string;
};

const defaultStats: DashboardStats = {
  totalDocuments: 0,
  totalQr: 0,
  totalAuthentications: 0,
  monthlyAuthentications: []
};

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentForm, setAgentForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'agent'
  });
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSuccess, setAgentSuccess] = useState('');
  const [agentError, setAgentError] = useState('');

  const loadStats = () => {
    api.get('/documents/stats')
      .then((response) => setStats(response.data.data || defaultStats))
      .catch(() => setStats(defaultStats));
  };

  const loadAgents = () => {
    if (!isAdmin) return;
    api.get('/auth/admin/agents')
      .then((response) => setAgents(response.data.data || []))
      .catch((err) => console.error('Erreur chargement agents:', err));
  };

  useEffect(() => {
    loadStats();
    if (isAdmin) {
      loadAgents();
    }
  }, [isAdmin]);

  const handleCreateAgent = async (e: FormEvent) => {
    e.preventDefault();
    setAgentLoading(true);
    setAgentError('');
    setAgentSuccess('');

    try {
      const response = await api.post('/auth/admin/agents', agentForm);
      setAgentSuccess(response.data.message || 'Compte agent créé avec succès !');
      setAgentForm({ full_name: '', email: '', password: '', role: 'agent' });
      loadAgents();
      setTimeout(() => {
        setAgentSuccess('');
        setShowAgentModal(false);
      }, 1500);
    } catch (err: any) {
      setAgentError(err?.response?.data?.error || 'Erreur lors de la création du compte');
    } finally {
      setAgentLoading(false);
    }
  };

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
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && (
            <button
              type="button"
              className="secondary-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: '#047857', color: '#047857' }}
              onClick={() => { setShowAgentModal(true); setAgentError(''); setAgentSuccess(''); }}
            >
              👤 + Créer un compte agent
            </button>
          )}
          <Link to="/documents/new" className="primary-btn">+ Nouveau document</Link>
        </div>
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
            <Link to="/documents/qr">Voir les documents sécurisés</Link>
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

      {/* Section exclusive Administrateur : Gestion des agents */}
      {isAdmin && (
        <div className="panel" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0 }}>Gestion des comptes agents & administrateurs</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Attribuez des identifiants (login/email) et mots de passe aux agents habilités de l'entreprise.
              </p>
            </div>
            <button
              type="button"
              className="primary-btn"
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
              onClick={() => { setShowAgentModal(true); setAgentError(''); setAgentSuccess(''); }}
            >
              + Nouvel agent
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Nom complet</th>
                  <th>Identifiant (Login / Email)</th>
                  <th>Rôle</th>
                  <th>Date de création</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((ag) => (
                  <tr key={ag.id}>
                    <td><strong>{ag.full_name}</strong></td>
                    <td><code>{ag.email}</code></td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          background: ag.role === 'admin' ? '#fef3c7' : '#e0f2fe',
                          color: ag.role === 'admin' ? '#92400e' : '#0369a1',
                          fontWeight: 700
                        }}
                      >
                        {ag.role === 'admin' ? 'Administrateur' : 'Agent'}
                      </span>
                    </td>
                    <td>{new Date(ag.createdAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fenêtre modale : Création d'un agent par l'administrateur */}
      {showAgentModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Créer un compte agent</h3>
              <button
                type="button"
                onClick={() => setShowAgentModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAgent}>
              <label style={{ display: 'block', marginBottom: 12 }}>
                Nom complet de l'agent
                <input
                  type="text"
                  required
                  placeholder="Ex: Paul BIYA ou Jean DUPONT"
                  value={agentForm.full_name}
                  onChange={(e) => setAgentForm({ ...agentForm, full_name: e.target.value })}
                  style={{ width: '100%', marginTop: 6 }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 12 }}>
                Identifiant / Email de connexion
                <input
                  type="email"
                  required
                  placeholder="Ex: agent.compta@fdr.test"
                  value={agentForm.email}
                  onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })}
                  style={{ width: '100%', marginTop: 6 }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 12 }}>
                Mot de passe temporaire ou définitif
                <input
                  type="password"
                  required
                  placeholder="Minimum 4 caractères"
                  value={agentForm.password}
                  onChange={(e) => setAgentForm({ ...agentForm, password: e.target.value })}
                  style={{ width: '100%', marginTop: 6 }}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 16 }}>
                Rôle attribué
                <select
                  value={agentForm.role}
                  onChange={(e) => setAgentForm({ ...agentForm, role: e.target.value })}
                  style={{ width: '100%', marginTop: 6 }}
                >
                  <option value="agent">Agent (Sécurisation, vérification, documents)</option>
                  <option value="admin">Administrateur (Tous les droits)</option>
                </select>
              </label>

              {agentError && <div className="error-box" style={{ marginBottom: 14 }}>{agentError}</div>}
              {agentSuccess && <div className="success-box" style={{ marginBottom: 14 }}>{agentSuccess}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowAgentModal(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={agentLoading}
                >
                  {agentLoading ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
