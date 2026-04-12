import { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Upload, FolderOpen, Loader2 } from 'lucide-react';
import * as mammoth from 'mammoth';

// Configuración de palos y normalización de cartas
const formatCardDisplay = (card: string) => {
  if (!card || typeof card !== 'string' || card.length < 2) {
    return { rank: '?', suitChar: '', image: '10S.png' };
  }
  
  let rank = card.slice(0, -1).toUpperCase();
  let suitChar = card[card.length - 1].toLowerCase();
  
  if (rank === 'T') rank = '10';
  
  const suitMap: Record<string, string> = {
    'h': 'H', 'c': 'H',
    'd': 'D',
    's': 'S', 'p': 'S',
    't': 'C', 'clubs': 'C', 'hearts': 'H', 'spades': 'S', 'diamonds': 'D'
  };
  
  const suit = suitMap[suitChar] || (['H','D','C','S'].includes(suitChar.toUpperCase()) ? suitChar.toUpperCase() : 'S');
  return { rank, suitChar, image: `${rank}${suit}.png` };
};

const CardDisplay = ({ card, size = 'normal', rotated = false }: { card: string; size?: 'small' | 'normal' | 'large'; rotated?: boolean }) => {
  const { rank, suitChar, image } = useMemo(() => formatCardDisplay(card), [card]);
  const dims = size === 'small' ? { w: 60, h: 80 } : size === 'large' ? { w: 100, h: 140 } : { w: 80, h: 110 };
  
  if (rotated) {
    return (
      <div style={{ width: dims.w, height: dims.h }} className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg border-2 border-white/30 shadow-lg flex items-center justify-center">
        <div className="w-6 h-8 rounded border border-white/20 bg-white/10" />
      </div>
    );
  }
  
  return (
    <div style={{ width: dims.w, height: dims.h }} className="bg-white rounded-lg border border-gray-100 shadow-xl flex flex-col items-center justify-center select-none overflow-hidden relative">
      <img 
        src={`/${image}`} 
        alt={`${rank}${suitChar}`}
        className="absolute inset-0 w-full h-full object-contain z-10"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
      />
    </div>
  );
};

const ChipStack = ({ amount }: { amount: number }) => {
  if (amount <= 0) return null;
  return (
    <div className="flex items-center justify-center bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
      <span className="text-[10px] font-bold text-yellow-500">€{amount}</span>
    </div>
  );
};

// --- Tipos e Interfaces ---
interface HandAction {
  player: string;
  action: string;
  amount?: number;
  street: string;
}

interface PlayerInfo {
  name: string;
  seat: number;
  stack: number;
  holeCards?: string[];
  position: string;
  isHero: boolean;
}

interface HandHistory {
  id: string;
  handId: string;
  date: string;
  sb: number;
  bb: number;
  heroHand: string[];
  board: string[];
  pot: number;
  winner?: string;
  players: PlayerInfo[];
  actions: HandAction[];
  rawBlock: string;
}

// --- Parser Simple y Robusto ---
const parsePokerStarsSpanish = (content: string): HandHistory[] => {
  const hands: HandHistory[] = [];
  const blocks = content.split(/(?=Mano de PokerStars|Mano n\.\º)/gi).filter(b => b.length > 50);
  
  for (const block of blocks) {
    try {
      const handId = block.match(/(?:Mano n\.\º|Hand #|n\.\º)\s*(\d+)/i)?.[1] || Math.random().toString();
      const players: PlayerInfo[] = [];
      // Regex más flexible para capturar asientos con o sin símbolos de moneda
      const playerMatches = [...block.matchAll(/Asiento (\d+): (.*?) \((.*?)\)/g)];
      
      playerMatches.forEach(m => {
        const stackStr = m[3].replace(/[^\d]/g, ''); // Limpiar todo lo que no sea número
        players.push({
          name: m[2].trim(),
          seat: parseInt(m[1]),
          stack: parseInt(stackStr) || 0,
          position: '',
          isHero: false // Se corregirá abajo
        });
      });

      const heroMatch = block.match(/(?:Repartidas a|Dealt to) (.*?)\s*\[([^\]]+)\]/i);
      const heroHand = heroMatch ? heroMatch[2].split(/\s+/).filter(c => c.length >= 2) : [];
      const heroName = heroMatch ? heroMatch[1].trim() : '';
      
      const sbPlayerMatch = block.match(/(.*?):\s+pone\s+(?:la\s+)?ciega pequeña/i);
      const bbPlayerMatch = block.match(/(.*?):\s+pone\s+(?:la\s+)?ciega grande/i);
      const sbPlayer = sbPlayerMatch ? sbPlayerMatch[1].trim() : '';
      const bbPlayer = bbPlayerMatch ? bbPlayerMatch[1].trim() : '';

      // Actualizar roles basados en detección
      players.forEach(p => {
        if (heroName && (p.name.includes(heroName) || heroName.includes(p.name))) p.isHero = true;
        // @ts-ignore
        if (sbPlayer && (p.name.includes(sbPlayer) || sbPlayer.includes(p.name))) p.isSB = true;
        // @ts-ignore
        if (bbPlayer && (p.name.includes(bbPlayer) || bbPlayer.includes(p.name))) p.isBB = true;
      });
      
      const cardRegexSimple = /\b(10|[2-9TJQKA])([shdcpt])\b/gi;
      const boardCards: string[] = [];
      const boardLines = block.split('\n').filter(l => l.includes('*** FLOP ***') || l.includes('*** TURN ***') || l.includes('*** RIVER ***'));
      
      boardLines.forEach(line => {
        const lineCards = line.match(cardRegexSimple);
        if (lineCards) {
          lineCards.forEach(c => {
            const upper = c.toUpperCase();
            if (!boardCards.includes(upper)) boardCards.push(upper);
          });
        }
      });

      const actions: HandAction[] = [];
      const lines = block.split('\n');
      let currentStreet = 'preflop';
      
      lines.forEach(line => {
        if (line.includes('*** FLOP ***')) currentStreet = 'flop';
        if (line.includes('*** TURN ***')) currentStreet = 'turn';
        if (line.includes('*** RIVER ***')) currentStreet = 'river';
        
        const actionMatch = line.match(/(.*?):\s+(se retira|pasa|apuesta|sube|iguala|apuesta .* all-in|sube .* all-in|iguala .* all-in|all-in)(?:\s+(\d+))?/i);
        if (actionMatch) {
          actions.push({
            player: actionMatch[1].trim(),
            action: actionMatch[2].toLowerCase(),
            amount: actionMatch[3] ? parseInt(actionMatch[3]) : undefined,
            street: currentStreet
          });
        }
      });

      const sbMatch = block.match(/posteó ciega pequeña\s+€?(\d+)/i);
      const bbMatch = block.match(/posteó ciega grande\s+€?(\d+)/i);
      const sb = sbMatch ? parseInt(sbMatch[1]) : 10;
      const bb = bbMatch ? parseInt(bbMatch[1]) : 20;

      // Detección universal del Dealer para PokerStars.es ("El asiento n.º X es el botón")
      const dealerMatch = block.match(/(?:asiento|seat)\s*(?:n[.\ºo]|#)\s*(\d+).*?bot[oó]n/i) || 
                          block.match(/bot[oó]n.*?(\d+)/i) ||
                          block.match(/(\d+).*?es el bot[oó]n/i);
      const dealerSeat = dealerMatch ? parseInt(dealerMatch[1]) : 1;

      hands.push({
        id: handId,
        handId,
        date: new Date().toISOString(),
        sb, bb,
        heroHand,
        board: boardCards,
        pot: 0,
        players,
        dealerSeat, // Guardamos el asiento del dealer
        actions,
        rawBlock: block
      });
    } catch (e) { console.error("Error parsing block", e); }
  }
  return hands;
};

// --- Componente Principal ---
const Replayer = () => {
  const [hands, setHands] = useState<HandHistory[]>([]);
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  const [currentStreet, setCurrentStreet] = useState<string>('preflop');
  const [currentActionIndex, setCurrentActionIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showImportModal, setShowImportModal] = useState(true);

  const streetOrder = ['preflop', 'flop', 'turn', 'river', 'showdown'];

  const currentHand = hands[currentHandIndex] || null;

  // Calculados (Memoizados para evitar crashes)
  const streetActions = useMemo(() => {
    if (!currentHand) return [];
    return currentHand.actions.filter(a => {
      const s = a.street.toLowerCase();
      if (currentStreet === 'preflop') return s === 'preflop';
      if (currentStreet === 'showdown') return s === 'river';
      return s === currentStreet;
    });
  }, [currentHand, currentStreet]);

  const boardForStreet = useMemo(() => {
    if (!currentHand) return [];
    if (currentStreet === 'preflop') return [];
    if (currentStreet === 'flop') return currentHand.board.slice(0, 3);
    if (currentStreet === 'turn') return currentHand.board.slice(0, 4);
    if (currentStreet === 'river' || currentStreet === 'showdown') return currentHand.board.slice(0, 5);
    return [];
  }, [currentHand, currentStreet]);

  const getPlayerAction = (playerName: string) => {
    if (!currentHand || !playerName) return null;
    
    // CASO ESPECIAL: Estado Inicial (Solo Ciegas)
    if (currentStreet === 'preflop' && currentActionIndex === -1) {
      const player = currentHand.players.find(p => p.name.includes(playerName) || playerName.includes(p.name));
      // @ts-ignore
      if (player?.isSB) return { action: 'SB', amount: currentHand.sb };
      // @ts-ignore
      if (player?.isBB) return { action: 'BB', amount: currentHand.bb };
      return null;
    }
    
    if (currentActionIndex === -1) return null;

    const action = streetActions[currentActionIndex];
    if (action && (action.player.includes(playerName) || playerName.includes(action.player))) {
      return action;
    }
    return null;
  };

  const getActionLabel = (action: string) => {
    if (action === 'SB') return 'SB';
    if (action === 'BB') return 'BB';
    const labels: Record<string, string> = {
      'se retira': 'Fold',
      'pasa': 'Check',
      'apuesta': 'Bet',
      'iguala': 'Call',
      'sube': 'Raise',
      'apuesta .* all-in': 'All-in',
      'sube .* all-in': 'All-in',
      'iguala .* all-in': 'All-in',
      'all-in': 'All-in'
    };
    return labels[action] || action.toUpperCase();
  };

  const potCalculated = useMemo(() => {
    if (!currentHand) return 0;
    if (currentStreet === 'preflop' && currentActionIndex === -1) return (currentHand.sb || 0) + (currentHand.bb || 0);
    
    // El bote inicial son las ciegas
    let total = (currentHand.sb || 0) + (currentHand.bb || 0);
    
    // Calculamos cuánto ha contribuido cada jugador en cada calle previa
    const currentStreetIdx = streetOrder.indexOf(currentStreet);
    
    // 1. Sumar acciones de calles completadas totalmente
    currentHand.actions.forEach(a => {
      const aStreetIdx = streetOrder.indexOf(a.street.toLowerCase());
      
      // Si la acción es de una calle anterior a la actual, sumamos su contribución incremental
      if (aStreetIdx < currentStreetIdx && aStreetIdx !== -1) {
        // En los historiales de texto, 'iguala', 'apuesta' o 'sube X a Y' 
        // la cantidad Y es el TOTAL que el jugador ha puesto en ESA calle hasta ese momento.
        // Pero para el bote necesitamos solo lo que SE AÑADE en esa acción.
        
        // Estrategia: Buscar la acción anterior del mismo jugador en la misma calle
        const actionsInStreet = currentHand.actions.filter(prevA => prevA.street === a.street);
        const playerActionsInStreet = actionsInStreet.filter(prevA => prevA.player === a.player);
        const myIndexInStreet = playerActionsInStreet.indexOf(a);
        
        if (a.amount) {
          const prevAmount = myIndexInStreet > 0 ? (playerActionsInStreet[myIndexInStreet - 1].amount || 0) : 0;
          total += (a.amount - prevAmount);
        }
      }
    });
    
    // 2. Sumar acciones de la calle actual hasta el índice actual
    for (let i = 0; i <= currentActionIndex; i++) {
      const a = streetActions[i];
      if (a && a.amount) {
        const playerActionsInCurrentStreet = streetActions.filter(prevA => prevA.player === a.player);
        const myIndexInCurrentStreet = playerActionsInCurrentStreet.indexOf(a);
        const prevAmount = myIndexInCurrentStreet > 0 ? (playerActionsInCurrentStreet[myIndexInCurrentStreet - 1].amount || 0) : 0;
        total += (a.amount - prevAmount);
      }
    }
    
    return total;
  }, [currentHand, currentStreet, currentActionIndex, streetActions]);

  const handleNext = () => {
    if (currentActionIndex < streetActions.length - 1) {
      setCurrentActionIndex(currentActionIndex + 1);
    } else {
      const nextIdx = streetOrder.indexOf(currentStreet) + 1;
      if (nextIdx < streetOrder.length) {
        setCurrentStreet(streetOrder[nextIdx]);
        setCurrentActionIndex(currentStreet === 'preflop' ? 0 : 0); // En Flop/Turn el primer paso es ver las cartas
      } else if (currentHandIndex < hands.length - 1) {
        setCurrentHandIndex(currentHandIndex + 1);
        setCurrentStreet('preflop');
        setCurrentActionIndex(-1); // Volver al estado de ciegas para la nueva mano
      } else {
        setIsPlaying(false);
      }
    }
  };

  const handlePrev = () => {
    if (currentActionIndex > -1) {
      setCurrentActionIndex(currentActionIndex - 1);
    } else {
      const prevIdx = streetOrder.indexOf(currentStreet) - 1;
      if (prevIdx >= 0) {
        setCurrentStreet(streetOrder[prevIdx]);
        // Volver al final de la calle anterior
        const prevStreetActions = currentHand.actions.filter(a => a.street === streetOrder[prevIdx]);
        setCurrentActionIndex(prevStreetActions.length - 1);
      }
    }
  };

  useEffect(() => {
    if (isPlaying) {
      const t = setTimeout(handleNext, 1000);
      return () => clearTimeout(t);
    }
  }, [isPlaying, currentActionIndex, currentStreet, currentHandIndex]);

  if (showImportModal) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-spin-gradient">
        <div className="max-w-md w-full bg-surface border border-white/10 p-10 rounded-3xl text-center shadow-2xl">
          <Upload className="mx-auto text-primary mb-4" size={48} />
          <h2 className="text-2xl font-bold mb-6">Cargar Historial</h2>
          <input 
            type="file" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              
              let text = '';
              if (file.name.toLowerCase().endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                text = result.value;
              } else {
                text = await file.text();
              }
              
              const parsed = parsePokerStarsSpanish(text);
              if (parsed.length > 0) {
                setHands(parsed);
                setShowImportModal(false);
              } else {
                alert("No se encontraron manos válidas en el archivo.");
              }
            }} 
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primaryHover cursor-pointer"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex bg-[#0a0a0c] overflow-hidden">
      {/* MESA DE POKER */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-8 bg-spin-gradient">
        <header className="absolute top-8 left-8 z-20 flex items-center gap-6">
          <button onClick={() => setShowImportModal(true)} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-gray-400 group">
            <FolderOpen size={24} className="group-hover:text-primary transition-colors" />
          </button>
          <div className="flex flex-col">
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span className="text-primary">♠️</span> ACE REPLAYER
            </h2>
            <div className="flex items-center gap-3 mt-1">
               <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">Mano #{currentHandIndex + 1}</span>
               <span className="text-[10px] text-primary font-black uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded">Ciegas: {currentHand.sb}/{currentHand.bb}€</span>
            </div>
          </div>
        </header>

        {/* Timeline de Calles */}
        <div className="absolute top-8 right-8 z-20 flex gap-2">
           {['preflop', 'flop', 'turn', 'river'].map((street) => {
             const isAvailable = (street === 'preflop') || 
                                 (street === 'flop' && currentHand.board.length >= 3) ||
                                 (street === 'turn' && currentHand.board.length >= 4) ||
                                 (street === 'river' && currentHand.board.length >= 5);
             const isActive = currentStreet === street;
             
             return (
               <button
                 key={street}
                 disabled={!isAvailable}
                 onClick={() => {
                   setCurrentStreet(street);
                   setCurrentActionIndex(0);
                 }}
                 className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${
                   isActive ? 'bg-primary text-white shadow-lg shadow-primary/20' : 
                   isAvailable ? 'bg-white/5 text-zinc-400 hover:bg-white/10' : 'opacity-20 cursor-not-allowed bg-transparent text-zinc-600'
                 }`}
               >
                 {street}
               </button>
             );
           })}
        </div>

        <div className="relative w-[1000px] h-[500px] bg-pokerGreen rounded-full shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_0_60px_rgba(0,0,0,0.5)] border-[15px] border-[#222]">
          {/* Cartas Comunitarias */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-3">
             {boardForStreet.map((c, i) => <CardDisplay key={i} card={c} />)}
             {boardForStreet.length === 0 && <span className="opacity-10 text-black text-6xl font-black">SPIN & GO</span>}
          </div>

          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 bg-black/60 px-6 py-2 rounded-full border border-white/10 text-xl font-bold text-primary">
             €{potCalculated}
          </div>

          {/* Jugadores */}
          {currentHand?.players.map((p, i) => {
            const isHero = p.isHero;
            const isDealer = p.seat === currentHand.dealerSeat;
            const action = getPlayerAction(p.name);
            const isTurn = action !== null;
            
            const posClasses = isHero ? 'bottom-[-50px] left-1/2 -translate-x-1/2' : (i === 0 ? 'top-4 left-24' : 'top-4 right-24');
            
            return (
              <div key={p.name} className={`absolute ${posClasses} flex flex-col items-center z-10 transition-all duration-300 ${isTurn ? 'scale-110' : 'scale-100'}`}>
                {isHero && (
                  <div className="flex gap-1 mb-2">
                    <CardDisplay card={currentHand.heroHand[0] || 'AS'} size="normal" />
                    <CardDisplay card={currentHand.heroHand[1] || 'KS'} size="normal" />
                  </div>
                )}
                
                <div className="relative">
                  {/* Action Label */}
                  {action && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full shadow-xl animate-bounce z-30 flex items-center gap-1 border border-white/20 whitespace-nowrap">
                      {getActionLabel(action.action)} {action.amount ? `€${action.amount}` : ''}
                    </div>
                  )}

                  <div className={`bg-gradient-to-b from-zinc-800 to-zinc-950 border-2 ${isTurn ? 'border-primary shadow-[0_0_20px_rgba(230,0,0,0.4)]' : 'border-white/10'} rounded-2xl px-5 py-2.5 flex items-center gap-3 shadow-2xl min-w-[220px] transition-all`}>
                    <div className={`w-10 h-10 rounded-full bg-zinc-800 flex-shrink-0 border-2 ${isHero ? 'border-primary' : (isTurn ? 'border-primary' : 'border-zinc-700')} overflow-hidden shadow-inner`}>
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`} alt="av" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-black truncate text-white uppercase tracking-tight">{p.name === 'pralija' ? 'Héroe (Pralija)' : p.name}</div>
                      <div className="text-[11px] text-zinc-400 font-bold">€{p.stack}</div>
                    </div>
                  </div>
                  
                  {isDealer && (
                    <div className="absolute -right-3 -top-3 w-8 h-8 bg-white rounded-full flex items-center justify-center border-2 border-zinc-900 shadow-xl z-20">
                      <span className="text-zinc-900 font-black text-xs">D</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="absolute bottom-8 flex items-center gap-6 bg-surface/80 backdrop-blur-md p-4 rounded-3xl border border-white/10 shadow-2xl">
          <button onClick={handlePrev} className="p-3 bg-white/5 rounded-full hover:bg-white/10 text-white"><SkipBack size={20} /></button>
          <button onClick={() => setIsPlaying(!isPlaying)} className="p-4 bg-primary rounded-full hover:scale-110 transition-all text-white shadow-lg shadow-primary/20">
            {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
          </button>
          <button onClick={handleNext} className="p-3 bg-white/5 rounded-full hover:bg-white/10 text-white"><SkipForward size={20} /></button>
        </div>
      </div>
    </div>
  );
};

export default Replayer;