import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@context/AuthContext';
import { TodoProvider } from '@context/TodoContext';
import BottomNav from '@components/navigation/BottomNav';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import ExpensesPage from './pages/ExpensesPage';
import SpacesPage from './pages/SpacesPage';
import SpaceDetailsPage from './pages/SpaceDetailsPage';
import ProfilePage from './pages/ProfilePage';
import AnalyticsPage from './pages/AnalyticsPage';
import SpaceAnalyticsPage from './pages/SpaceAnalyticsPage';
import ShoppingListPage from './pages/ShoppingListPage';
import HistoryPage from './pages/HistoryPage';
import SchedulePage from './pages/SchedulePage';
import TodoPage from './pages/TodoPage';
import NotesPage from './pages/NotesPage';
import NoteEditorPage from './pages/NoteEditorPage';
import NotePublicPage from './pages/NotePublicPage';
import DrivePage from './pages/DrivePage';
import InstallPrompt from './components/InstallPrompt';
import './styles/global.css';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="app">
      <Routes>
        {/* Public routes */}
        <Route path="/" element={user ? <Navigate to="/expenses" replace /> : <LandingPage />} />
        <Route path="/auth" element={user ? <Navigate to="/expenses" replace /> : <AuthPage />} />

        {/* Protected routes */}
        <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
        <Route path="/spaces" element={<ProtectedRoute><SpacesPage /></ProtectedRoute>} />
        <Route path="/spaces/:id" element={<ProtectedRoute><SpaceDetailsPage /></ProtectedRoute>} />
        <Route path="/spaces/:id/analytics" element={<ProtectedRoute><SpaceAnalyticsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/shopping" element={<ProtectedRoute><ShoppingListPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/schedule" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
        <Route path="/todo" element={<ProtectedRoute><TodoPage /></ProtectedRoute>} />
        <Route path="/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
        <Route path="/notes/:id" element={<ProtectedRoute><NoteEditorPage /></ProtectedRoute>} />
        {/* Public note — no auth */}
        <Route path="/p/notes/:id" element={<NotePublicPage />} />
        <Route path="/drive" element={<ProtectedRoute><DrivePage /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
