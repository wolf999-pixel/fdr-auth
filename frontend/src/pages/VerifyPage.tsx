import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

type VerificationResponse = {
  result: 'AUTHENTIQUE' | 'NON_AUTHENTIQUE';
  message?: string;
  reason?: string;
  document?: {
    reference?: string | null;
    subject?: string | null;
    recipient?: string | null;
    service?: string | null;
    year?: number | null;
  } | null;
};

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null);

  const verifyToken = async (tokenToVerify: string) => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('token', tokenToVerify);
      if (file) formData.append('file', file);

      const response = await api.post('/verify', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult({
        result: response.data.result || 'NON_AUTHENTIQUE',
        message: response.data.message || 'DOCUMENT NON AUTHENTIQUE',
        reason: response.data.reason || 'Invalid',
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
      setError('Veuillez saisir un token de vérification');
      return;
    }

    await verifyToken(token);
  };

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      void verifyToken(urlToken);
    }
  }, [searchParams]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
      <header className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <span className="eyebrow">Vérification</span>
          <h1>Authenticité du document</h1>
        </div>
      </header>

      <form className="form-panel" onSubmit={handleSubmit}>
        <label>
          Token QR ou lien scanné
          <textarea value={token} onChange={(e) => setToken(e.target.value)} rows={4} placeholder="https://votre-site/verify?token=..." />
        </label>

        <label>
          Document à vérifier (optionnel)
          <input type="file" accept="application/pdf" onChange={handleFile} />
        </label>

        {error && <div className="error-box">{error}</div>}

        {result && (
          <div className={result.result === 'AUTHENTIQUE' ? 'success-box' : 'error-box'}>
            <strong style={{ display: 'block', fontSize: '1.5rem', marginBottom: '8px' }}>
              {result.message || (result.result === 'AUTHENTIQUE' ? 'DOCUMENT AUTHENTIQUE' : 'DOCUMENT NON AUTHENTIQUE')}
            </strong>
            {result.reason && <p style={{ margin: '6px 0 0' }}>Raison : {result.reason}</p>}
          </div>
        )}

        {result?.document && (
          <div className="panel" style={{ marginTop: '18px' }}>
            <h3>Informations du document</h3>
            <div className="form-grid">
              <div><strong>Référence :</strong> {result.document.reference || '—'}</div>
              <div><strong>Objet :</strong> {result.document.subject || '—'}</div>
              <div><strong>Destinataire :</strong> {result.document.recipient || '—'}</div>
              <div><strong>Service :</strong> {result.document.service || '—'}</div>
              <div className="full-width"><strong>Année :</strong> {result.document.year || '—'}</div>
            </div>
          </div>
        )}

        <button type="submit" className="primary-btn" disabled={loading} style={{ marginTop: '18px' }}>
          {loading ? 'Vérification...' : 'Lancer la vérification'}
        </button>
      </form>
    </div>
  );
}
