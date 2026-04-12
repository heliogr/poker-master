import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };


  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl"></div>
        
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black italic tracking-tighter flex justify-center items-center gap-3 mb-3 text-white uppercase">
            <img src="/icon.png" alt="Clover" className="w-12 h-12 object-contain" /> POKERMASTER
          </h1>
          <p className="text-zinc-500 font-bold tracking-widest text-[10px] uppercase">Panel de Analista Profesional</p>
        </div>
        
        {error && (
          <div className="bg-primary/10 border border-primary/20 text-primary p-4 rounded-2xl mb-6 text-[10px] font-black uppercase tracking-widest text-center">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
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
            {loading ? 'Sincronizando...' : 'Ingresar al Terminal'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
