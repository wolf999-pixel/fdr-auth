import { ChangeEvent, FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

export default function SignedDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setMessage(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    
    if (!file) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner un fichier' });
      return;
    }
    
    if (!id) {
      setMessage({ type: 'error', text: 'ID du document manquant' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/documents/${id}/signed`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setMessage({
        type: 'success',
        text: `Document signé enregistré avec succès : ${file.name}`,
      });
      setFile(null);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Erreur lors de l\'enregistrement';
      setMessage({
        type: 'error',
        text: `Erreur : ${errorMsg}`,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!id) {
    return (
      <div>
        <header className="page-header">
          <div>
            <span className="eyebrow">Version signée</span>
            <h1>Enregistrer le document signé</h1>
          </div>
        </header>
        <div className="error-box">Document introuvable. Veuillez accéder à cette page depuis une fiche document.</div>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <span className="eyebrow">Version signée</span>
          <h1>Enregistrer le document signé</h1>
        </div>
      </header>

      <form className="form-panel" onSubmit={handleSubmit}>
        <label>
          Fichier PDF signé
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={handleFile}
            disabled={loading}
          />
        </label>

        {message && (
          <div className={message.type === 'success' ? 'success-box' : 'error-box'}>
            {message.text}
          </div>
        )}

        <button 
          type="submit" 
          className="primary-btn"
          disabled={loading || !file}
        >
          {loading ? 'Enregistrement...' : 'Enregistrer la version signée'}
        </button>
      </form>
    </div>
  );
}
