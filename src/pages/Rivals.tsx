import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, Search, Trophy, TrendingUp, 
  ShieldAlert, Crosshair,
  Layers
} from 'lucide-react';

interface RivalStats {
  rival_name: string;
  times_met: number;
  times_won: number;
  times_lost: number;
  buy_ins: number[];
}

const Rivals = () => {
  const [rivals, setRivals] = useState<RivalStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  useEffect(() => {
    fetchRivals();
  }, []);

  const fetchRivals = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch all rival records for this user
    const { data, error } = await supabase
      .from('rivals')
      .select('rival_name, times_met, times_won, times_lost, buy_in_level')
      .eq('user_id', user.id);

    if (!error && data) {
      // Group by name to handle multi-buy-in rivals
      const grouped = data.reduce((acc, row) => {
        const existing = acc.get(row.rival_name);
        if (existing) {
          existing.times_met += row.times_met;
          existing.times_won += row.times_won;
          existing.times_lost += row.times_lost;
          if (!existing.buy_ins.includes(row.buy_in_level)) {
            existing.buy_ins.push(row.buy_in_level);
          }
        } else {
          acc.set(row.rival_name, {
            rival_name: row.rival_name,
            times_met: row.times_met,
            times_won: row.times_won,
            times_lost: row.times_lost,
            buy_ins: [row.buy_in_level]
          });
        }
        return acc;
      }, new Map<string, RivalStats>());

      setRivals(Array.from(grouped.values()).sort((a, b) => b.times_met - a.times_met));
    }
    setLoading(false);
  };

  const filteredRivals = useMemo(() => {
    return rivals.filter(r => {
      const matchesSearch = r.rival_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = selectedLevel ? r.buy_ins.includes(selectedLevel) : true;
      return matchesSearch && matchesLevel;
    });
  }, [rivals, searchTerm, selectedLevel]);

  if (loading) return <div className="h-screen flex items-center justify-center text-zinc-500 bg-black"><TrendingUp className="animate-pulse mr-2" /> SINCRONIZANDO RIVALES...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 p-4 md:p-8 pb-32 max-w-[1700px] mx-auto overflow-x-hidden selection:bg-primary/30">
      
      {/* Redesigned Header - Premium Localization */}
      <header className="mb-14 flex flex-col lg:flex-row lg:items-end justify-between gap-10 border-b border-white/5 pb-12 relative">
        <div className="absolute top-0 left-0 w-[400px] h-[300px] bg-primary/5 rounded-full blur-[150px] -z-10"></div>
        <div className="space-y-4">
          <div className="flex items-center gap-5">
            <div className="bg-gradient-to-tr from-primary to-primaryHover p-4 rounded-3xl shadow-[0_0_50px_rgba(230,0,0,0.4)] border border-primary/20">
              <Users size={36} className="text-white" />
            </div>
            <div>
              <h2 className="text-6xl font-black tracking-tighter text-white uppercase italic leading-none">RIVAL <span className="text-zinc-700 not-italic font-light">TRACKER</span></h2>
              <div className="flex items-center gap-3 mt-3">
                <span className="w-2 h-2 bg-pokerGreenHighlight rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></span>
                <div className="text-[11px] font-black tracking-[0.4em] text-primary uppercase">INTELIGENCIA DE OPONENTES GTO</div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Rival Stats */}
        <div className="flex flex-wrap gap-5">
          <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/[0.05] rounded-[2rem] px-10 py-6 flex flex-col justify-center shadow-3xl">
            <div className="text-[10px] uppercase text-zinc-500 font-black tracking-widest mb-2 flex items-center gap-2">RIVALES ÚNICOS</div>
            <div className="text-4xl font-black text-white">{rivals.length}</div>
          </div>
          <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/[0.05] rounded-[2rem] px-10 py-6 flex flex-col justify-center shadow-3xl">
            <div className="text-[10px] uppercase text-zinc-500 font-black tracking-widest mb-2 flex items-center gap-2">TOP AGRESOR</div>
            <div className="text-xl font-black text-pokerGreenHighlight truncate max-w-[150px] uppercase italic">
              {rivals[0]?.rival_name || '-'}
            </div>
          </div>
        </div>
      </header>

      {/* Control Bar - Search & Levels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 group-hover:text-primary transition-colors" size={20} />
          <input 
            type="text"
            placeholder="Buscar por nombre de usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/40 backdrop-blur-xl border border-white/[0.05] rounded-3xl py-6 pl-16 pr-8 text-lg text-white placeholder-zinc-700 focus:outline-none focus:border-primary/50 transition-all shadow-2xl"
          />
        </div>
        <div className="flex bg-zinc-900/40 backdrop-blur-xl border border-white/[0.05] rounded-3xl p-2 gap-2 shadow-2xl">
          <button 
            onClick={() => setSelectedLevel(null)}
            className={`flex-1 rounded-2xl text-[10px] font-black tracking-widest transition-all ${selectedLevel === null ? 'bg-primary text-white shadow-3xl' : 'text-zinc-600 hover:text-white'}`}
          >
            TODOS LOS NIVELES
          </button>
          {[1, 2, 5].map(lvl => (
            <button 
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-5 rounded-2xl text-[10px] font-black tracking-widest transition-all ${selectedLevel === lvl ? 'bg-zinc-800 text-white border border-white/10 shadow-3xl' : 'text-zinc-600 hover:text-white'}`}
            >
              €{lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Rivals Grid - Premium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredRivals.map((rival) => {
          const winRate = (rival.times_won / rival.times_met) * 100;
          return (
            <div 
              key={rival.rival_name}
              className="bg-zinc-900/20 backdrop-blur-3xl border border-white/[0.03] rounded-[3rem] p-8 shadow-3xl hover:bg-white/[0.04] transition-all duration-500 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-white italic tracking-tighter group-hover:text-primary transition-colors">{rival.rival_name}</h3>
                  <div className="flex gap-2">
                    {rival.buy_ins.sort((a,b)=>a-b).map(lvl => (
                      <span key={lvl} className="px-2 py-0.5 rounded-lg text-[8px] font-black bg-white/[0.05] text-zinc-500 border border-white/[0.05]">€{lvl}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-zinc-800/50 p-3 rounded-2xl border border-white/5 opacity-50 group-hover:opacity-100 transition-all">
                  <Crosshair size={20} className="text-primary" />
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                {/* Stats Row 1 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 rounded-2xl p-4 border border-white/[0.02]">
                    <div className="text-[9px] uppercase font-black text-zinc-600 tracking-widest mb-2 flex items-center gap-2">
                      ENFRENTAMIENTOS <Layers size={10} />
                    </div>
                    <div className="text-2xl font-black text-white italic">{rival.times_met} </div>
                  </div>
                  <div className="bg-black/40 rounded-2xl p-4 border border-white/[0.02]">
                    <div className="text-[9px] uppercase font-black text-zinc-600 tracking-widest mb-2 flex items-center gap-2">
                      TASA VICTORIA <Trophy size={10} />
                    </div>
                    <div className={`text-2xl font-black ${winRate >= 50 ? 'text-pokerGreenHighlight' : 'text-primary'}`}>
                      {winRate.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Wins / Loss Detail Row */}
                <div className="bg-zinc-800/20 rounded-[2rem] p-6 border border-white/[0.02] relative group/sub">
                  <div className="text-[9px] uppercase font-black text-zinc-600 tracking-widest mb-4">ESTADÍSTICAS CARA A CARA</div>
                  <div className="flex items-end gap-3 justify-center mb-1">
                    <div className="text-4xl font-black text-pokerGreenHighlight drop-shadow-sm">{rival.times_won}</div>
                    <div className="text-[10px] font-black text-zinc-600 mb-1.5 uppercase tracking-[0.2em]">Wins</div>
                    <div className="text-2xl font-light text-zinc-800 mb-0.5 opacity-40">/</div>
                    <div className="text-4xl font-black text-primary drop-shadow-sm">{rival.times_lost}</div>
                    <div className="text-[10px] font-black text-zinc-600 mb-1.5 uppercase tracking-[0.2em]">Loss</div>
                  </div>
                  {/* Progress bar visualizer */}
                  <div className="mt-4 h-1.5 bg-black/50 rounded-full overflow-hidden flex border border-white/5">
                    <div className="h-full bg-pokerGreenHighlight shadow-[0_0_10px_#10b98140]" style={{ width: `${winRate}%` }}></div>
                    <div className="h-full bg-primary shadow-[0_0_10px_#e6000040]" style={{ width: `${100-winRate}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Aggressor Badge */}
              {rival.times_met > 10 && winRate > 60 && (
                <div className="mt-6 flex items-center gap-2 bg-pokerGreenHighlight/10 border border-pokerGreenHighlight/20 px-4 py-2 rounded-xl text-pokerGreenHighlight text-[10px] font-black tracking-widest uppercase">
                  <ShieldAlert size={14} /> OBJETIVO PRIORITARIO
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredRivals.length === 0 && (
        <div className="mt-20 text-center space-y-4">
          <div className="text-zinc-700 font-black text-2xl uppercase tracking-[0.3em] italic">No se han detectado objetivos</div>
          <p className="text-zinc-800 text-sm font-medium">Prueba con un término de búsqueda diferente o sube más archivos de historial.</p>
        </div>
      )}
    </div>
  );
};

export default Rivals;