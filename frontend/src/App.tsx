import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import DashboardPage from './pages/DashboardPage';
import DocumentFormPage from './pages/DocumentFormPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';
import QrViewPage from './pages/QrViewPage';
import SecureDocumentsPage from './pages/SecureDocumentsPage';
import SecureDocumentView from './pages/SecureDocumentView';
import SignedDocumentPage from './pages/SignedDocumentPage';
import VerifyPage from './pages/VerifyPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<Layout />}>
            <Route path="/verify" element={<VerifyPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/documents/new" element={<DocumentFormPage />} />
              <Route path="/documents/qr" element={<SecureDocumentsPage />} />
              <Route path="/documents/:id/secure" element={<SecureDocumentView />} />
              <Route path="/documents/:id/signed" element={<SignedDocumentPage />} />
              <Route path="/history" element={<HistoryPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
