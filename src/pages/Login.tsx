import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        alert('Registro exitoso. ¡Ya puedes ingresar!');
        setIsSignUp(false);
        setLoading(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        navigate('/');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl"></div>
        
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black italic tracking-tighter flex justify-center items-center gap-3 mb-3 text-white">
            <span className="text-primary not-italic">♠️</span> ACE
          </h1>
          <p className="text-zinc-500 font-bold tracking-widest text-[10px] uppercase">{isSignUp ? 'Crear nueva cuenta élite' : 'Panel de Analista Profesional'}</p>
        </div>
        
        {error && (
          <div className="bg-primary/10 border border-primary/20 text-primary p-4 rounded-2xl mb-6 text-[10px] font-black uppercase tracking-widest text-center">
            {error}
          </div>
        )}
        
        <form onSubmit={handleAction} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2 ml-1">Email de Acceso</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all font-medium text-sm"
              placeholder="pro@pokermaster.com"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2 ml-1">Contraseña Maestra</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all font-medium text-sm"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-primary hover:scale-[1.02] active:scale-95 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-[0.2em] py-5 rounded-2xl transition-all mt-6 shadow-lg shadow-primary/20"
          >
            {loading ? 'Sincronizando...' : (isSignUp ? 'Crear Cuenta' : 'Ingresar al Terminal')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors"
          >
            {isSignUp ? '¿Ya tienes cuenta? Ingresa aquí' : '¿No tienes acceso? Regístrate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
