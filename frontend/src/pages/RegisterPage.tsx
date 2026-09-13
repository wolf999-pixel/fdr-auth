import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import logoUrl from '../fond routier.jpg';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/register', {
        full_name: fullName,
        email,
        password
      });

      login(response.data.token, response.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur lors de l’inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-block">
          <img src={logoUrl} alt="Fond Routier" className="brand-logo" />
          <span className="eyebrow">Fonds Routier du Cameroun</span>
          <h1>Espace Agents</h1>
          <p>Création de compte pour les agents assermentés du Fonds Routier.</p>
        </div>

        <form onSubmit={handleSubmit} className="form-card">
          <h2>Inscription Agent</h2>

          <label>
            Nom complet
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Jean Paul Ndongo"
              required
            />
          </label>

          <label>
            Email professionnel
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@fdr.cm ou agent@fdr.test"
              required
            />
          </label>

          <label>
            Mot de passe (min. 6 caractères)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <label>
            Confirmer le mot de passe
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className="error-box">{error}</div>}

          <button type="submit" className="primary-btn" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Création en cours...' : 'Créer mon compte agent'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.9rem', color: '#64748b' }}>
            Déjà inscrit ? <Link to="/login" style={{ color: '#163d76', fontWeight: 700 }}>Se connecter</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
