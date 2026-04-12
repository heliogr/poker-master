import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Trophy, 
  Loader2,
  Calendar,
  Medal
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { supabase } from '../lib/supabase';

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

const formatXAxis = (date: Date, filterId: string) => {
  if (filterId === '1D') {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } else if (filterId === '1S') {
    return date.getDate().toString();
  } else if (filterId === '1M') {
    return date.getDate().toString();
  } else {
    return date.toLocaleDateString('es-ES', { month: 'short' });
  }
};

interface ChartDataPoint {
  date: Date;
  rawDate: string;
  timestamp: number;
  balance: number;
  fullDate: string;
  position: number;
  prize: number;
  buyIn: number;
  multiplier: number;
  tournamentId: string;
  site: string;
  speed: string;
  gameType: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartDataPoint }>;
  label?: string;
  filterId: string;
  isPositive: boolean;
}

const formatTooltipDate = (rawDate: string, filterId: string): { dateDisplay: string; timeDisplay: string } => {
  if (!rawDate) return { dateDisplay: 'Sin fecha', timeDisplay: '' };

  const dateParts = rawDate.replace(' ', 'T').split('T');
  const [datePart, timePart] = dateParts;
  if (!datePart) return { dateDisplay: 'Sin fecha', timeDisplay: '' };

  const [year, month, day] = datePart.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthName = months[parseInt(month) - 1] || '';

  if (filterId === '1D' || filterId === '1S') {
    return {
      dateDisplay: `${day} ${monthName} ${year}`,
      timeDisplay: timePart ? timePart.slice(0, 5) : '',
    };
  }
  return { dateDisplay: `${day} ${monthName} ${year}`, timeDisplay: '' };
};

const CustomCursor = (props: { points?: Array<{ x: number; y: number }>; height?: number; isPositive: boolean }) => {
  const { points, height, isPositive } = props;
  if (!points || points.length === 0) return null;

  const x = points[0].x;
  const color = isPositive ? '#10b981' : '#ef4444';

  return (
    <g>
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={0.7}
      />
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={color}
        strokeWidth={6}
        strokeOpacity={0.08}
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload, filterId, isPositive }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0];
  const { dateDisplay, timeDisplay } = formatTooltipDate(
    data.payload.rawDate || data.payload.fullDate,
    filterId
  );
  const balance = data.value;
  const accentColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <div
      style={{ borderColor: `${accentColor}40` }}
      className="bg-[#0a0a0f]/95 backdrop-blur-md border rounded-xl p-3 shadow-2xl min-w-[170px]"
    >
      {/* Date header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
        <span className="text-zinc-400 text-[11px] font-semibold tracking-wide">
          {dateDisplay}
          {timeDisplay && <span className="text-zinc-500 ml-1">· {timeDisplay}</span>}
        </span>
      </div>

      {/* Balance value — large and prominent */}
      <div className="flex items-baseline gap-1 mb-2">
        <span
          className="text-2xl font-black tracking-tight"
          style={{ color: accentColor }}
        >
          {balance >= 0 ? '+' : ''}€{balance.toFixed(2)}
        </span>
      </div>

      {/* Tournament details */}
      <div className="border-t border-white/5 pt-2 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-zinc-500">Buy-in</span>
          <span className="text-zinc-300 font-medium">€{data.payload.buyIn}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-zinc-500">Premio</span>
          <span className="text-zinc-300 font-medium">€{data.payload.prize}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-zinc-500">Posición</span>
          <span className={data.payload.position === 1 ? 'text-yellow-500 font-bold' : 'text-zinc-300 font-medium'}>
            #{data.payload.position}
          </span>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuyIn, setSelectedBuyIn] = useState<number | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('3M');
  const [sortColumn, setSortColumn] = useState<'date' | 'buy_in' | 'finish_position' | 'prize' | 'result' | 'multiplier'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleSort = (column: 'date' | 'buy_in' | 'finish_position' | 'prize' | 'result' | 'multiplier') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return null;
    return (
      <span className="ml-1 text-primary">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;
      setTournaments(data || []);
    } catch (e) {
      console.error('Error fetching:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredTournaments = (() => {
    try {
      if (!tournaments || tournaments.length === 0) return [];
      
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
    } catch (e) {
      console.error('Error filtering:', e);
      return [];
    }
  })();

  const { totalProfit, totalInvested, totalPrize, totalGames } = (() => {
    let profit = 0;
    let invested = 0;
    let prize = 0;

    filteredTournaments.forEach(t => {
      invested += t.buy_in;
      prize += t.prize;
      profit += t.prize - t.buy_in;
    });

    return {
      totalProfit: profit,
      totalInvested: invested,
      totalPrize: prize,
      totalGames: filteredTournaments.length
    };
  })();

  const chartData = (() => {
    try {
      if (!filteredTournaments || filteredTournaments.length === 0) return [];
      
      let balance = 0;
      const sorted = [...filteredTournaments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      return sorted.map((t) => {
        const profit = t.prize - t.buy_in;
        balance += profit;
        const dateObj = new Date(t.date);
        
        return {
          date: dateObj,
          rawDate: t.date,
          timestamp: dateObj.getTime(),
          balance: parseFloat(balance.toFixed(2)),
          fullDate: t.date,
          position: t.finish_position,
          prize: t.prize,
          buyIn: t.buy_in,
          multiplier: t.multiplier,
          tournamentId: t.tournament_id?.slice(-6) || '000000',
          site: t.site || '',
          speed: t.speed || '',
          gameType: t.game_type || ''
        };
      });
    } catch (e) {
      console.error('Error in chartData:', e);
      return [];
    }
  })();

  const tableData = (() => {
    try {
      if (!filteredTournaments || filteredTournaments.length === 0) return [];
      const sorted = [...filteredTournaments].sort((a, b) => {
        let aVal: number, bVal: number;
        
        switch (sortColumn) {
          case 'date':
            aVal = new Date(a.date).getTime();
            bVal = new Date(b.date).getTime();
            break;
          case 'buy_in':
            aVal = a.buy_in;
            bVal = b.buy_in;
            break;
          case 'finish_position':
            aVal = a.finish_position;
            bVal = b.finish_position;
            break;
          case 'prize':
            aVal = a.prize;
            bVal = b.prize;
            break;
          case 'result':
            aVal = a.prize - a.buy_in;
            bVal = b.prize - b.buy_in;
            break;
          case 'multiplier':
            aVal = a.multiplier;
            bVal = b.multiplier;
            break;
          default:
            aVal = new Date(a.date).getTime();
            bVal = new Date(b.date).getTime();
        }
        
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      });
      return sorted.slice(0, 50);
    } catch (e) {
      console.error('Error in tableData:', e);
      return [];
    }
  })();

  const isPositiveBalance = totalProfit >= 0;
  const strokeColor = isPositiveBalance ? '#10b981' : '#dc2626';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-white">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-[10px] font-black tracking-[0.5em] uppercase animate-pulse">CARGANDO...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase italic">
              Estadísticas de Juego
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Tracking your spin & go performance</p>
          </div>
          
          <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-2xl">
            {tabs.map((tab) => (
              <button
                key={tab.id ?? 'general'}
                onClick={() => setSelectedBuyIn(tab.id)}
                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                  selectedBuyIn === tab.id
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">
            <Trophy size={14} className="text-yellow-500" />
            Partidas Jugadas
          </div>
          <div className="text-3xl font-black text-white">{totalGames}</div>
        </div>

        <div className="bg-surface border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">
            <Calendar size={14} />
            Invertido
          </div>
          <div className="text-3xl font-black text-white">€{totalInvested.toFixed(0)}</div>
        </div>

        <div className="bg-surface border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">
            <Medal size={14} className="text-yellow-500" />
            Premios
          </div>
          <div className="text-3xl font-black text-white">€{totalPrize.toFixed(0)}</div>
        </div>

        <div className={`border rounded-2xl p-5 ${totalProfit >= 0 ? 'bg-green-950/30 border-green-500/20' : 'bg-red-950/30 border-red-500/20'}`}>
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">
            <TrendingUp size={14} className={totalProfit >= 0 ? 'text-green-500' : 'text-red-500'} />
            Ganancia
          </div>
          <div className={`text-3xl font-black ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalProfit >= 0 ? '+' : ''}€{totalProfit.toFixed(0)}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-white/5 rounded-2xl p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <h3 className="text-lg font-bold text-white">Progreso del Bankroll</h3>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => {
              setShowDatePicker(!showDatePicker);
              setSelectedTimeFilter('custom');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              selectedTimeFilter === 'custom' || customRange
                ? 'bg-purple-600 text-white'
                : 'text-zinc-500 hover:text-white hover:bg-white/5 bg-zinc-800'
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
                  setCustomRange(null);
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
        
        {showDatePicker && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 mb-4 flex flex-wrap gap-4 items-center">
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
                  setShowDatePicker(false);
                }
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold mt-5"
            >
              Aplicar
            </button>
          </div>
        )}
        
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorBalancePositive" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5}/>
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02}/>
                </linearGradient>
                <linearGradient id="colorBalanceNegative" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity={0.5}/>
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
              <XAxis 
                dataKey="timestamp" 
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                stroke="#ffffff" 
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#ffffff', strokeWidth: 1 }}
                tickFormatter={(ts: number) => formatXAxis(new Date(ts), selectedTimeFilter)}
              />
              <YAxis 
                orientation="right"
                stroke="#ffffff" 
                fontSize={11}
                tickFormatter={(value) => `${value}€`}
                axisLine={{ stroke: '#ffffff', strokeWidth: 1 }}
                tickLine={false}
                width={50}
              />
              <Tooltip 
                content={<CustomTooltip filterId={selectedTimeFilter} isPositive={isPositiveBalance} />}
                cursor={<CustomCursor isPositive={isPositiveBalance} />}
                isAnimationActive={false}
                wrapperStyle={{ zIndex: 100 }}
              />
              <Area 
                type="monotone" 
                dataKey="balance" 
                stroke={strokeColor} 
                strokeWidth={3}
                fillOpacity={1} 
                fill={isPositiveBalance ? "url(#colorBalancePositive)" : "url(#colorBalanceNegative)"} 
                animationDuration={500}
                isAnimationActive={false}
                activeDot={{
                  r: 6,
                  fill: isPositiveBalance ? '#10b981' : '#ef4444',
                  stroke: '#0a0a0f',
                  strokeWidth: 3,
                  style: {
                    filter: `drop-shadow(0 0 6px ${isPositiveBalance ? '#10b98180' : '#ef444480'})`,
                  },
                }}
              />
              {chartData.length > 0 && (
                <ReferenceLine y={0} stroke="#ffffff30" strokeDasharray="3 3" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-lg font-bold text-white">Historial de Torneos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-900/50">
              <tr>
                <th 
                  className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort('date')}
                >
                  Fecha <SortIcon column="date" />
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Torneo</th>
                <th 
                  className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort('buy_in')}
                >
                  Buy-in <SortIcon column="buy_in" />
                </th>
                <th 
                  className="text-center text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort('finish_position')}
                >
                  Posición <SortIcon column="finish_position" />
                </th>
                <th 
                  className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort('prize')}
                >
                  Premio <SortIcon column="prize" />
                </th>
                <th 
                  className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort('result')}
                >
                  Resultado <SortIcon column="result" />
                </th>
                <th 
                  className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort('multiplier')}
                >
                  Multi <SortIcon column="multiplier" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tableData.map((t: Tournament) => {
                const result = t.prize - t.buy_in;
                const isWin = result >= 0;
                return (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {new Date(t.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-white">{t.site}</div>
                      <div className="text-xs text-zinc-600">{t.speed} • {t.game_type}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-zinc-300">€{t.buy_in}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold ${
                        t.finish_position === 1 
                          ? 'bg-yellow-500/20 text-yellow-500' 
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {t.finish_position}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-300">€{t.prize.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-bold ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                        {isWin ? '+' : ''}€{result.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 text-xs font-bold">
                        x{t.multiplier}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tableData.length === 0 && (
          <div className="p-12 text-center text-zinc-500">
            No hay torneos registrados
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;