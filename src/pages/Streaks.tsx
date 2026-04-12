import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, TrendingUp, TrendingDown, Zap, Target, Flame, Award, Clock } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  ReferenceLine
} from 'recharts';

interface Tournament {
  id: string;
  tournament_id: string;
  site: string;
  buy_in: number;
  currency: string;
  game_type: string;
  speed: string;
  date: string;
  finish_position: number;
  prize: number;
  total_players: number;
  multiplier: number;
}

interface MultiplierStats {
  x2: { total: number; wins: number };
  x3: { total: number; wins: number };
  x4: { total: number; wins: number };
  x5: { total: number; wins: number };
  x10: { total: number; wins: number };
  x25: { total: number; wins: number };
  x50: { total: number; wins: number };
  x100: { total: number; wins: number };
}

const Streaks = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuyIn, setSelectedBuyIn] = useState<number | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('3M');
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [selectedMultiTab, setSelectedMultiTab] = useState<number | null>(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (!error && data) {
      setTournaments(data);
    }
    setLoading(false);
  };

  const filteredTournaments = useMemo(() => {
    if (!tournaments.length) return [];
    
    let filtered = selectedBuyIn === null ? tournaments : tournaments.filter(t => t.buy_in === selectedBuyIn);
    
    const now = new Date();
    const daysMap: Record<string, number> = { '1D': 1, '1S': 7, '1M': 30, '3M': 90, '6M': 180, '1A': 365 };
    const days = daysMap[selectedTimeFilter] || 90;
    const cutoffDate = now.getTime() - days * 24 * 60 * 60 * 1000;
    
    filtered = filtered.filter(t => {
      const tournamentDate = new Date(t.date).getTime();
      
      if (customRange) {
        const startDate = new Date(customRange.start).getTime();
        const endDate = new Date(customRange.end).getTime() + 86400000;
        return tournamentDate >= startDate && tournamentDate <= endDate;
      }
      
      return tournamentDate >= cutoffDate;
    });
    
    return filtered;
  }, [tournaments, selectedBuyIn, selectedTimeFilter, customRange]);

  const stats = useMemo(() => {
    const tournaments = filteredTournaments;
    const total = tournaments.length;
    const wins = tournaments.filter(t => t.finish_position === 1).length;
    const losses = total - wins;
    const itm = tournaments.filter(t => t.finish_position <= 3).length;
    
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLoseStreak = 0;
    let tempWinStreak = 0;
    let tempLoseStreak = 0;
    
    for (const t of tournaments) {
      if (t.finish_position === 1) {
        tempWinStreak++;
        tempLoseStreak = 0;
        currentStreak = tempWinStreak;
        maxWinStreak = Math.max(maxWinStreak, tempWinStreak);
      } else {
        tempLoseStreak++;
        tempWinStreak = 0;
        currentStreak = -tempLoseStreak;
        maxLoseStreak = Math.max(maxLoseStreak, tempLoseStreak);
      }
    }

    const multiplierStats: MultiplierStats = {
      x2: { total: 0, wins: 0 },
      x3: { total: 0, wins: 0 },
      x4: { total: 0, wins: 0 },
      x5: { total: 0, wins: 0 },
      x10: { total: 0, wins: 0 },
      x25: { total: 0, wins: 0 },
      x50: { total: 0, wins: 0 },
      x100: { total: 0, wins: 0 }
    };

    const multiStreaksByValue: Record<number, { max: number; current: number }> = {
      2: { max: 0, current: 0 },
      3: { max: 0, current: 0 },
      4: { max: 0, current: 0 },
      5: { max: 0, current: 0 },
      10: { max: 0, current: 0 },
      25: { max: 0, current: 0 },
      50: { max: 0, current: 0 },
      100: { max: 0, current: 0 }
    };

    let maxMultiStreak = 0;
    let maxMultiStreakValue = 0;
    let currentMultiStreak = 0;
    let currentMultiStreakValue = 0;
    let tempMultiStreak = 0;
    let tempMultiStreakValue = 0;
    let lastMultiplier = 0;

    for (const t of tournaments) {
      const mult = t.multiplier;
      multiplierStats[`x${mult}` as keyof MultiplierStats] = {
        total: (multiplierStats[`x${mult}` as keyof MultiplierStats]?.total || 0) + 1,
        wins: (multiplierStats[`x${mult}` as keyof MultiplierStats]?.wins || 0) + (t.finish_position === 1 ? 1 : 0)
      };

      if (mult === lastMultiplier) {
        tempMultiStreak++;
        tempMultiStreakValue = mult;
        if (multiStreaksByValue[mult]) {
          multiStreaksByValue[mult].current = tempMultiStreak;
        }
      } else {
        if (multiStreaksByValue[lastMultiplier] && tempMultiStreak > 0) {
          multiStreaksByValue[lastMultiplier].max = Math.max(multiStreaksByValue[lastMultiplier].max, tempMultiStreak);
        }
        tempMultiStreak = 1;
        tempMultiStreakValue = mult;
        Object.keys(multiStreaksByValue).forEach(k => {
          multiStreaksByValue[parseInt(k)].current = 0;
        });
        if (multiStreaksByValue[mult]) {
          multiStreaksByValue[mult].current = 1;
        }
      }
      currentMultiStreak = tempMultiStreak;
      currentMultiStreakValue = tempMultiStreakValue;
      if (tempMultiStreak > maxMultiStreak) {
        maxMultiStreak = tempMultiStreak;
        maxMultiStreakValue = tempMultiStreakValue;
      }
      lastMultiplier = mult;
    }

    if (lastMultiplier > 0 && multiStreaksByValue[lastMultiplier]) {
      multiStreaksByValue[lastMultiplier].max = Math.max(multiStreaksByValue[lastMultiplier].max, tempMultiStreak);
    }

    const avgPosition = total > 0 
      ? tournaments.reduce((acc, t) => acc + t.finish_position, 0) / total 
      : 0;

    const avgProfit = total > 0 
      ? tournaments.reduce((acc, t) => acc + (t.prize - t.buy_in), 0) / total 
      : 0;

    return {
      total,
      wins,
      losses,
      itm,
      itmRate: total > 0 ? (itm / total) * 100 : 0,
      winRate: total > 0 ? (wins / total) * 100 : 0,
      currentStreak,
      maxWinStreak,
      maxLoseStreak,
      maxMultiStreak,
      maxMultiStreakValue,
      currentMultiStreak,
      currentMultiStreakValue,
      multiplierStats,
      multiStreaksByValue,
      avgPosition: avgPosition.toFixed(1),
      avgProfit: avgProfit.toFixed(2),
      rawAvgProfit: avgProfit
    };
  }, [filteredTournaments]);

  const timeData = useMemo(() => {
    const hours = Array(24).fill(0).map((_, i) => ({ 
      name: `${i}h`, 
      hour: i, 
      profit: 0, 
      games: 0 
    }));
    
    const days = [
      { name: 'Lun', profit: 0, games: 0, index: 1 },
      { name: 'Mar', profit: 0, games: 0, index: 2 },
      { name: 'Mié', profit: 0, games: 0, index: 3 },
      { name: 'Jue', profit: 0, games: 0, index: 4 },
      { name: 'Vie', profit: 0, games: 0, index: 5 },
      { name: 'Sáb', profit: 0, games: 0, index: 6 },
      { name: 'Dom', profit: 0, games: 0, index: 0 },
    ];

    filteredTournaments.forEach(t => {
      const d = new Date(t.date);
      const h = d.getHours();
      const dayIdx = d.getDay();

      const profit = t.prize - t.buy_in;

      hours[h].profit = parseFloat((hours[h].profit + profit).toFixed(2));
      hours[h].games += 1;

      const dayObj = days.find(day => day.index === dayIdx);
      if (dayObj) {
        dayObj.profit = parseFloat((dayObj.profit + profit).toFixed(2));
        dayObj.games += 1;
      }
    });

    const sortedDays = [...days].sort((a, b) => {
      const order = [1, 2, 3, 4, 5, 6, 0];
      return order.indexOf(a.index) - order.indexOf(b.index);
    });

    const bestHour = [...hours].sort((a, b) => b.profit - a.profit)[0];
    const bestDay = [...days].sort((a, b) => b.profit - a.profit)[0];

    return { 
      hours, 
      days: sortedDays,
      bestHour: bestHour && bestHour.profit > 0 ? bestHour : null,
      bestDay: bestDay && bestDay.profit > 0 ? bestDay : null
    };
  }, [filteredTournaments]);

  const tabs = [
    { id: null, label: 'GENERAL' },
    { id: 1, label: '€1' },
    { id: 2, label: '€2' },
    { id: 5, label: '€5' },
  ];

  const timeFilters = [
    { id: '1D', label: '1D', days: 1 },
    { id: '1S', label: '1S', days: 7 },
    { id: '1M', label: '1M', days: 30 },
    { id: '3M', label: '3M', days: 90 },
    { id: '6M', label: '6M', days: 180 },
    { id: '1A', label: '1A', days: 365 },
  ];

  const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <div className="bg-surface border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">
        <Icon size={14} className={color} />
        {title}
      </div>
      <div className="text-3xl font-black text-white">{value}</div>
      {subtitle && <div className="text-xs text-zinc-500 mt-1">{subtitle}</div>}
    </div>
  );

  const MultiBar = ({ label, total, wins, color }: { label: string; total: number; wins: number; color: string }) => {
    const percentage = total > 0 ? (wins / total) * 100 : 0;
    return (
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-zinc-400">{label}</span>
          <span className="text-white font-bold">{wins}/{total} ({percentage.toFixed(0)}%)</span>
        </div>
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className={`h-full ${color}`} 
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center text-zinc-500 bg-black">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-bold tracking-widest uppercase">CARGANDO...</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 p-4 md:p-8 pb-32">
      <header className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase italic leading-none">
            RESUMEN <span className="text-zinc-700 not-italic font-light">Y RACHAS</span>
          </h2>
          <p className="text-zinc-500 text-sm mt-2">Estadísticas detalladas de rendimiento</p>
        </div>
        
        <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id ?? 'general'}
              onClick={() => setSelectedBuyIn(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                selectedBuyIn === tab.id
                  ? 'bg-primary text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Torneos" value={stats.total} subtitle="Totales jugados" icon={Trophy} color="text-yellow-500" />
        <StatCard title="Victorias" value={stats.wins} subtitle={`${stats.winRate.toFixed(1)}% win rate`} icon={Award} color="text-green-500" />
        <StatCard title="Derrotas" value={stats.losses} subtitle="Sin premio" icon={TrendingDown} color="text-red-500" />
        <StatCard 
          title="Racha actual" 
          value={Math.abs(stats.currentStreak)} 
          subtitle={stats.currentStreak > 0 ? ` Victorias` : stats.currentStreak < 0 ? ` Derrotas` : ' Sin rachas'}
          icon={stats.currentStreak > 0 ? TrendingUp : stats.currentStreak < 0 ? TrendingDown : Flame} 
          color={stats.currentStreak > 0 ? 'text-green-500' : stats.currentStreak < 0 ? 'text-red-500' : 'text-zinc-500'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Victorias seguidas" value={stats.maxWinStreak} subtitle="Racha máxima" icon={TrendingUp} color="text-green-400" />
        <StatCard title="Derrotas seguidas" value={stats.maxLoseStreak} subtitle="Racha máxima" icon={TrendingDown} color="text-red-400" />
        
        <div className="bg-surface border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">
            <Zap size={14} className="text-yellow-500" />
            Rachas por Multi
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {Object.keys(stats.multiStreaksByValue).map((mult) => (
              <button
                key={mult}
                onClick={() => setSelectedMultiTab(selectedMultiTab === parseInt(mult) ? null : parseInt(mult))}
                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                  selectedMultiTab === parseInt(mult)
                    ? 'bg-yellow-500 text-black'
                    : stats.multiStreaksByValue[parseInt(mult)].max > 0
                      ? 'bg-zinc-700 text-white'
                      : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                x{mult}
              </button>
            ))}
          </div>
          {selectedMultiTab ? (
            <div>
              <div className="text-3xl font-black text-yellow-500">
                {stats.multiStreaksByValue[selectedMultiTab]?.max || 0}
              </div>
              <div className="text-xs text-zinc-500">veces seguidas</div>
              <div className="text-xs text-zinc-400 mt-1">
                Actual: {stats.multiStreaksByValue[selectedMultiTab]?.current || 0}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-3xl font-black text-white">{stats.maxMultiStreak}</div>
              <div className="text-xs text-zinc-500">racha máxima total</div>
              <div className="text-xs text-zinc-400 mt-1">x{stats.maxMultiStreakValue}</div>
            </div>
          )}
        </div>
        
        <StatCard title="Posición media" value={stats.avgPosition} subtitle="Avg position" icon={Target} color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Zap size={20} className="text-yellow-500" />
            Multiplicadores
          </h3>
          
          <div className="space-y-4">
            {Object.entries(stats.multiplierStats)
              .sort(([a], [b]) => parseInt(a.replace('x', '')) - parseInt(b.replace('x', '')))
              .map(([key, value]: [string, any]) => (
              value.total > 0 && (
                <MultiBar 
                  key={key}
                  label={`x${key.replace('x', '')}`}
                  total={value.total}
                  wins={value.wins}
                  color={value.wins > 0 ? 'bg-green-500' : 'bg-red-500'}
                />
              )
            ))}
          </div>
        </div>

        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Flame size={20} className="text-orange-500" />
            Información Adicional
          </h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-white/5">
              <span className="text-zinc-400">Beneficio medio por torneo</span>
              <span className={`font-bold ${parseFloat(stats.avgProfit) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {parseFloat(stats.avgProfit) >= 0 ? '+' : ''}€{stats.avgProfit}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-white/5">
              <span className="text-zinc-400">Perdidos</span>
              <span className="font-bold text-red-500">{stats.losses}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-white/5">
              <span className="text-zinc-400">Racha actual multiplicadores</span>
              <span className="font-bold text-yellow-500">x{stats.currentMultiStreakValue} ({stats.currentMultiStreak} veces)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-white/5 rounded-2xl p-4 mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => {
              setSelectedTimeFilter('custom');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              customRange ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5 bg-zinc-800'
            }`}
          >
            📅 Personalizar
          </button>
          
          {customRange && (
            <span className="text-xs text-purple-400 bg-purple-900/30 px-3 py-2 rounded-lg">
              {new Date(customRange.start).toLocaleDateString('es-ES')} - {new Date(customRange.end).toLocaleDateString('es-ES')}
              <button 
                onClick={() => {
                  setCustomRange(null);
                  setSelectedTimeFilter('3M');
                }}
                className="ml-2 text-purple-300 hover:text-white"
              >
                ✕
              </button>
            </span>
          )}
          
          <div className="flex gap-1 bg-black/30 p-1 rounded-xl ml-auto">
            {timeFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  setSelectedTimeFilter(filter.id);
                  if (filter.id !== 'custom') setCustomRange(null);
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  selectedTimeFilter === filter.id && !customRange
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        
        {customRange && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 flex flex-wrap gap-4 items-center">
            <div className="flex flex-col">
              <label className="text-xs text-zinc-500 mb-1">Desde</label>
              <input 
                type="date" 
                className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                onChange={(e) => setCustomRange(prev => prev ? { ...prev, start: e.target.value } : { start: e.target.value, end: '' })}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-zinc-500 mb-1">Hasta</label>
              <input 
                type="date" 
                className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                onChange={(e) => setCustomRange(prev => prev ? { ...prev, end: e.target.value } : { start: '', end: e.target.value })}
              />
            </div>
            <button
              onClick={() => {
                if (customRange?.start && customRange?.end) {
                  setSelectedTimeFilter('custom');
                }
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold mt-5"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      <div className="mb-8">
        <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-6 flex items-center gap-3">
          <Clock className="text-primary" />
          OPTIMIZACIÓN <span className="text-zinc-700 not-italic font-light">DE SESIÓN</span>
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-widest">Beneficio por Hora</h4>
                <p className="text-xs text-zinc-500 uppercase">Análisis de franja horaria (24h)</p>
              </div>
              {timeData.bestHour && (
                <div className="bg-green-500/10 border border-green-500/20 px-3 py-1 rounded text-[10px] font-black text-green-500 uppercase">
                  TOP: {timeData.bestHour.name}
                </div>
              )}
            </div>
            
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeData.hours}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#52525b" 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    stroke="#52525b" 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(v) => `€${v}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'white', opacity: 0.05 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#0a0a0f] border border-white/10 p-2 rounded-lg shadow-2xl">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">{data.name}</p>
                            <p className={`text-sm font-black ${data.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {data.profit >= 0 ? '+' : ''}€{data.profit}
                            </p>
                            <p className="text-[10px] text-zinc-600 mt-1">{data.games} torneos</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={0} stroke="#ffffff10" />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                    {timeData.hours.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} 
                        fillOpacity={entry.profit === 0 ? 0.1 : 0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-surface border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-widest">Rendimiento por Día</h4>
                <p className="text-xs text-zinc-500 uppercase">Días de la semana</p>
              </div>
              {timeData.bestDay && (
                <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded text-[10px] font-black text-blue-500 uppercase">
                  TOP: {timeData.bestDay.name}
                </div>
              )}
            </div>
            
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeData.days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#52525b" 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    stroke="#52525b" 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(v) => `€${v}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'white', opacity: 0.05 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#0a0a0f] border border-white/10 p-2 rounded-lg shadow-2xl">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">{data.name}</p>
                            <p className={`text-sm font-black ${data.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {data.profit >= 0 ? '+' : ''}€{data.profit}
                            </p>
                            <p className="text-[10px] text-zinc-600 mt-1">{data.games} torneos</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={0} stroke="#ffffff10" />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                    {timeData.days.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.profit >= 0 ? '#3b82f6' : '#ef4444'} 
                        fillOpacity={entry.profit === 0 ? 0.1 : 0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-center">
          <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl">
            <p className="text-[10px] text-zinc-500 uppercase font-black mb-1">Mejor Hora para jugar</p>
            <p className="text-xl font-black text-white italic tracking-tighter">
              {timeData.bestHour ? timeData.bestHour.name : 'N/A'}
            </p>
          </div>
          <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl">
            <p className="text-[10px] text-zinc-500 uppercase font-black mb-1">Mejor Día de la semana</p>
            <p className="text-xl font-black text-white italic tracking-tighter">
              {timeData.bestDay ? timeData.bestDay.name : 'N/A'}
            </p>
          </div>
          <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl">
            <p className="text-[10px] text-zinc-500 uppercase font-black mb-1">ROI Promedio</p>
            <p className={`text-xl font-black italic tracking-tighter ${parseFloat(stats.avgProfit) >= 0 ? 'text-green-500' : 'text-zinc-500'}`}>
              {parseFloat(stats.avgProfit) >= 0 ? '+' : ''}€{stats.avgProfit}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Streaks;