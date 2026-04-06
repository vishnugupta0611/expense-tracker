import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@context/AuthContext';
import { TodoProvider } from '@context/TodoContext';
import BottomNav from '@components/navigation/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import './styles/global.css';
import './App.css';

// Eagerly load only the two entry-point pages
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';

// Lazy load everything else — each becomes its own chunk
const ExpensesPage      = lazy(() => import('./pages/ExpensesPage'));
const SpacesPage        = lazy(() => import('./pages/SpacesPage'));
const SpaceDetailsPage  = lazy(() => import('./pages/SpaceDetailsPage'));
const ProfilePage       = lazy(() => import('./pages/ProfilePage'));
const AnalyticsPage     = lazy(() => import('./pages/AnalyticsPage'));
const SpaceAnalyticsPage = lazy(() => import('./pages/SpaceAnalyticsPage'));
const ShoppingListPage  = lazy(() => import('./pages/ShoppingListPage'));
const HistoryPage       = lazy(() => import('./pages/HistoryPage'));
const SchedulePage      = lazy(() => import('./pages/SchedulePage'));
const TodoPage          = lazy(() => import('./pages/TodoPage'));
const NotesPage         = lazy(() => import('./pages/NotesPage'));
const NoteEditorPage    = lazy(() => import('./pages/NoteEditorPage'));
const NotePublicPage    = lazy(() => import('./pages/NotePublicPage'));
const DrivePage         = lazy(() => import('./pages/DrivePage'));
const WordLibraryPage   = lazy(() => import('./pages/WordLibraryPage'));
const WalletPage        = lazy(() => import('./pages/WalletPage'));

// Minimal inline fallback — no spinner component needed
const PageFallback = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '60vh', color: 'var(--text-tertiary)', fontSize: '0.875rem',
  }}>
    Loading...
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
};

const AppContent = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="app">
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/"        element={user ? <Navigate to="/expenses" replace /> : <LandingPage />} />
          <Route path="/auth"    element={user ? <Navigate to="/expenses" replace /> : <AuthPage />} />

          <Route path="/expenses"            element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
          <Route path="/spaces"              element={<ProtectedRoute><SpacesPage /></ProtectedRoute>} />
          <Route path="/spaces/:id"          element={<ProtectedRoute><SpaceDetailsPage /></ProtectedRoute>} />
          <Route path="/spaces/:id/analytics" element={<ProtectedRoute><SpaceAnalyticsPage /></ProtectedRoute>} />
          <Route path="/profile"             element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/analytics"           element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/shopping"            element={<ProtectedRoute><ShoppingListPage /></ProtectedRoute>} />
          <Route path="/history"             element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/schedule"            element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
          <Route path="/todo"                element={<ProtectedRoute><TodoPage /></ProtectedRoute>} />
          <Route path="/notes"               element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
          <Route path="/notes/:id"           element={<ProtectedRoute><NoteEditorPage /></ProtectedRoute>} />
          <Route path="/p/notes/:id"         element={<NotePublicPage />} />
          <Route path="/drive"               element={<ProtectedRoute><DrivePage /></ProtectedRoute>} />
          <Route path="/words"               element={<ProtectedRoute><WordLibraryPage /></ProtectedRoute>} />
          <Route path="/wallet"              element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
          <Route path="*"                    element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {user && <BottomNav />}
      <InstallPrompt />
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <TodoProvider>
          <AppContent />
        </TodoProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
