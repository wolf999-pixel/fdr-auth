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
    setFile(event.target.files?.[0] ?? null);
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
          <label className="full-width">
            Fichier PDF
            <input type="file" accept="application/pdf" onChange={handleFile} />
          </label>
        </div>

        {error && <div className="error-box">{error}</div>}
        {message && <div className="success-box">{message}</div>}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? 'Enregistrement...' : 'Enregistrer le document'}
        </button>
      </form>
    </div>
  );
}
