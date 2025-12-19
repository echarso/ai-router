import { useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import AuthenticatedApp from './components/AuthenticatedApp';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  const { authenticated, loading } = useAuth();

  // Don't clear URL params here - let AuthContext handle redirect processing

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>🔄 Initializing...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {authenticated ? <AuthenticatedApp /> : <Login />}
    </ErrorBoundary>
  );
}

export default App;
