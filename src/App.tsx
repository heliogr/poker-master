import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Replayer from './pages/Replayer';
import Upload from './pages/Upload';
import Rivals from './pages/Rivals';
import Streaks from './pages/Streaks';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error("Supabase error:", error);
          setError("Error de conexión. Si hace tiempo que no entras, la base de datos podría estar en pausa.");
        } else {
          setSession(session);
        }
      })
      .catch((err) => {
        console.error("Error fetching session:", err);
        setError("Error crítico de conexión. Es posible que el proyecto de Supabase esté en pausa por inactividad.");
      })
      .finally(() => {
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 max-w-md text-center shadow-xl">
          <div className="text-red-500 mb-4 flex justify-center">
            <svg xmlns="http://www.w3000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Servicio Inactivo</h1>
          <p className="text-slate-300 mb-6">{error}</p>
          <a 
            href="https://supabase.com/dashboard/projects" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Activar en Supabase
          </a>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="rivals" element={<Rivals />} />
          <Route path="replayer" element={<Replayer />} />
          <Route path="upload" element={<Upload />} />
          <Route path="streaks" element={<Streaks />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
