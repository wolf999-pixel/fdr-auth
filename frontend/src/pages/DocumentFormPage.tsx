import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function DocumentFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    reference: '',
    subject: 'Correspondance administrative',
    recipient: 'Service Finances',
    service: 'Direction Générale',
    year: '2026'
  });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiNotice, setAiNotice] = useState('');

  // Generate a unique reference on component mount
  useEffect(() => {
    const timestamp = Date.now().toString().slice(-8);
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    setForm(prev => ({
      ...prev,
      reference: `DOC-2026-${timestamp}-${randomSuffix}`
    }));
  }, []);

  const handleChange = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setAiNotice('');
  };

  const handleAutoExtract = async () => {
    if (!file) {
      setError('Veuillez d\'abord sélectionner un fichier PDF à analyser.');
      return;
    }

    setAnalyzing(true);
    setError('');
    setAiNotice('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/documents/analyze-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success && response.data.metadata) {
        const meta = response.data.metadata;
        const engine = response.data.engine;
        setForm({
          reference: meta.reference || form.reference,
          subject: meta.subject || form.subject,
          recipient: meta.recipient || form.recipient,
          service: meta.service || form.service,
          year: meta.year || form.year,
        });
        if (engine === 'gemini-ai') {
          setAiNotice('🤖 Informations extraites avec précision par l’IA Google Gemini ! Vous pouvez les vérifier ou les ajuster avant enregistrement.');
        } else {
          setAiNotice('✨ Informations extraites par analyse documentaire ! Vous pouvez les vérifier ou les ajuster avant enregistrement.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Impossible d\'extraire automatiquement les informations. Vous pouvez les saisir manuellement.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('Veuillez sélectionner un fichier PDF.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('reference', form.reference);
      formData.append('subject', form.subject);
      formData.append('recipient', form.recipient);
      formData.append('service', form.service);
      formData.append('year', form.year);

      const response = await api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const documentId = response.data.document?.id;
      if (!documentId) {
        throw new Error('Identifiant du document introuvable');
      }

      await api.post(`/documents/${documentId}/qr`);
      setMessage(`Document enregistré et sécurisé avec succès.`);
      setTimeout(() => navigate(`/documents/qr?documentId=${documentId}`), 600);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur lors de l’enregistrement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <span className="eyebrow">Enregistrement</span>
          <h1>Document administratif</h1>
        </div>
      </header>

      <form className="form-panel" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Référence
            <input value={form.reference} onChange={(e) => handleChange('reference', e.target.value)} />
          </label>
          <label>
            Année
            <input value={form.year} onChange={(e) => handleChange('year', e.target.value)} />
          </label>
          <label className="full-width">
            Objet
            <input value={form.subject} onChange={(e) => handleChange('subject', e.target.value)} />
          </label>
          <label>
            Destinataire
            <input value={form.recipient} onChange={(e) => handleChange('recipient', e.target.value)} />
          </label>
          <label>
            Service
            <input value={form.service} onChange={(e) => handleChange('service', e.target.value)} />
          </label>
          <div className="full-width" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
              Fichier PDF officiel
              <input type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'block', marginTop: 6 }} />
            </label>

            {file && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px dashed #cbd5e1' }}>
                <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                  Fichier sélectionné : <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} Ko)
                </span>
                <button
                  type="button"
                  className="secondary-btn"
                  style={{ background: 'linear-gradient(135deg, #7b61ff, #6366f1)', color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: '0.85rem' }}
                  onClick={handleAutoExtract}
                  disabled={analyzing}
                >
                  {analyzing ? '⏳ Analyse IA en cours...' : '✨ Extraire automatiquement (IA)'}
                </button>
              </div>
            )}
          </div>
        </div>

        {aiNotice && <div className="success-box" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6b21a8' }}>{aiNotice}</div>}
        {error && <div className="error-box">{error}</div>}
        {message && <div className="success-box">{message}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Enregistrement & Sécurisation...' : 'Enregistrer et Sécuriser'}
          </button>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Les informations peuvent être saisies manuellement ou extraites par l'IA.
          </span>
        </div>
      </form>
    </div>
  );
}
