import { lazy, Suspense, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@context/AuthContext';
import { TodoProvider } from '@context/TodoContext';
import { ThemeProvider } from '@context/ThemeContext';
import BottomNav from '@components/navigation/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import SplashScreen from './components/SplashScreen';
import './styles/global.css';
import './App.css';

import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';

const ExpensesPage       = lazy(() => import('./pages/ExpensesPage'));
const SpacesPage         = lazy(() => import('./pages/SpacesPage'));
const SpaceDetailsPage   = lazy(() => import('./pages/SpaceDetailsPage'));
const ProfilePage        = lazy(() => import('./pages/ProfilePage'));
const AnalyticsPage      = lazy(() => import('./pages/AnalyticsPage'));
const SpaceAnalyticsPage = lazy(() => import('./pages/SpaceAnalyticsPage'));
const ShoppingListPage   = lazy(() => import('./pages/ShoppingListPage'));
const HistoryPage        = lazy(() => import('./pages/HistoryPage'));
const SchedulePage       = lazy(() => import('./pages/SchedulePage'));
const TodoPage           = lazy(() => import('./pages/TodoPage'));
const NotesPage          = lazy(() => import('./pages/NotesPage'));
const NoteEditorPage     = lazy(() => import('./pages/NoteEditorPage'));
const NotePublicPage     = lazy(() => import('./pages/NotePublicPage'));
const DrivePage          = lazy(() => import('./pages/DrivePage'));
const WordLibraryPage    = lazy(() => import('./pages/WordLibraryPage'));
const WalletPage         = lazy(() => import('./pages/WalletPage'));
const JobsPage           = lazy(() => import('./pages/JobsPage'));
const FamilyLinkPage     = lazy(() => import('./pages/FamilyLinkPage'));
const FamilyMessagesPage = lazy(() => import('./pages/FamilyMessagesPage'));
const ProfileInfoPage    = lazy(() => import('./pages/ProfileInfoPage'));
import { useEffect } from "react";
import { getNotificationToken } from "./getNotificationToken";




const LoadingScreen = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: 'var(--bg-primary)',
  }}>
    <img src="/animation.gif" alt="Loading" style={{ width: 80, height: 80, objectFit: 'contain' }} />
  </div>
);

const PageFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <img src="/animation.gif" alt="Loading" style={{ width: 60, height: 60, objectFit: 'contain' }} />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
};

const AppContent = () => {

  useEffect(()=>{

getNotificationToken();

},[]);
  const { user, loading } = useAuth();

  console.log(user)

  if (loading) return <LoadingScreen />;

  return (
    <div className="app">
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/"                     element={user ? <Navigate to={`/${localStorage.getItem('defaultView') || 'family'}`} replace /> : <LandingPage />} />
          <Route path="/auth"                 element={<AuthPage />} />
          <Route path="/expenses"             element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
          <Route path="/spaces"               element={<ProtectedRoute><SpacesPage /></ProtectedRoute>} />
          <Route path="/jobs"                 element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
          <Route path="/spaces/:id"           element={<ProtectedRoute><SpaceDetailsPage /></ProtectedRoute>} />
          <Route path="/spaces/:id/analytics" element={<ProtectedRoute><SpaceAnalyticsPage /></ProtectedRoute>} />
          <Route path="/profile"              element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/analytics"            element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/shopping"             element={<ProtectedRoute><ShoppingListPage /></ProtectedRoute>} />
          <Route path="/history"              element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/schedule"             element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
          <Route path="/todo"                 element={<ProtectedRoute><TodoPage /></ProtectedRoute>} />
          <Route path="/family"               element={<ProtectedRoute><FamilyLinkPage /></ProtectedRoute>} />
          <Route path="/family/messages"      element={<ProtectedRoute><FamilyMessagesPage /></ProtectedRoute>} />
          <Route path="/profile-info"         element={<ProtectedRoute><ProfileInfoPage /></ProtectedRoute>} />
          <Route path="/notes"                element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
          <Route path="/notes/:id"            element={<ProtectedRoute><NoteEditorPage /></ProtectedRoute>} />
          <Route path="/p/notes/:id"          element={<NotePublicPage />} />
          <Route path="/drive"                element={<ProtectedRoute><DrivePage /></ProtectedRoute>} />
          <Route path="/words"                element={<ProtectedRoute><WordLibraryPage /></ProtectedRoute>} />
          <Route path="/wallet"               element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
          <Route path="*"                     element={<Navigate to={user ? '/expenses' : '/'} replace />} />
        </Routes>
      </Suspense>
      {user && <BottomNav />}
      <InstallPrompt />
    </div>
  );
};

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  return (
    <Router>
      <ThemeProvider>
      <AuthProvider>
        <TodoProvider>
          {!splashDone && <SplashScreen onDone={handleSplashDone} />}
          {splashDone && <AppContent />}
        </TodoProvider>
      </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
