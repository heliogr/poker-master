import { supabase } from './supabase';

export interface DuplicateCheckResult {
  tournamentId: string;
  isDuplicate: boolean;
}

export const checkDuplicates = async (tournamentIds: string[]): Promise<DuplicateCheckResult[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || tournamentIds.length === 0) return [];

  const { data, error } = await supabase
    .from('tournaments')
    .select('tournament_id')
    .eq('user_id', user.id)
    .in('tournament_id', tournamentIds);

  if (error) {
    console.error('Error checking duplicates:', error);
    return [];
  }

  const existingIds = new Set(data?.map(d => d.tournament_id) || []);
  return tournamentIds.map(id => ({
    tournamentId: id,
    isDuplicate: existingIds.has(id)
  }));
};

export interface ParsedHand {
  handId: string;
  tournamentId: string;
  tableName: string;
  date: string;
  gameType: string;
  limit: string;
  currency: string;
  board: string[];
  pot: number;
  actions: HandAction[];
  players: PlayerInfo[];
}

export interface HandAction {
  player: string;
  action: string;
  amount?: number;
  street: 'preflop' | 'flop' | 'turn' | 'river';
}

export interface PlayerInfo {
  name: string;
  seat: number;
  stack: number;
  holeCards?: string[];
}

export interface ParsedTournament {
  tournamentId: string;
  site: 'PokerStars' | 'Winamax';
  buyIn: number;
  currency: string;
  gameType: string;
  speed: string;
  date: string;
  finishPosition: number;
  prize: number;
  totalPlayers: number;
  rivals: { name: string; position: number }[];
  multiplier: number;
}

export const parseHandHistory = (content: string): ParsedHand[] => {
  const hands: ParsedHand[] = [];
  const handBlocks = content.split(/\n(?=PokerStars|Winamax)/gi).filter(h => h.trim());
  
  for (const block of handBlocks) {
    try {
      const hand = parseSingleHand(block);
      if (hand) hands.push(hand);
    } catch (e) {
      console.error('Error parsing hand:', e);
    }
  }
  
  return hands;
};

const parseSingleHand = (block: string): ParsedHand | null => {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 3) return null;
  
  const handIdMatch = lines[0].match(/Hand #(\d+)/i);
  const tournamentMatch = lines.find(l => l.match(/Tournament #(\d+)/i));
  const tableMatch = lines.find(l => l.match(/Table '([^']+)'/i));
    const dateMatch = lines.find(l => l.match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}:\d{2})/));
    
    if (!handIdMatch) return null;
    
    const hand: ParsedHand = {
      handId: handIdMatch[1],
      tournamentId: tournamentMatch ? tournamentMatch.match(/Tournament #(\d+)/i)?.[1] || '' : '',
      tableName: tableMatch ? tableMatch.match(/Table '([^']+)'/i)?.[1] || '' : '',
      date: dateMatch ? new Date(`${dateMatch[1]} ${dateMatch[2]} UTC`).toISOString() : new Date().toISOString(),
    gameType: "Hold'em",
    limit: "No Limit",
    currency: '€',
    board: [],
    pot: 0,
    actions: [],
    players: []
  };
  
  return hand;
};

const parseDateFromContent = (chunk: string): string => {
  const patterns = [
    // Support 08-04-2026 1:24:20 CET
    /Comienzo del tournament?\s+(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}:\d{2}:\d{2})\s*(CET|CEST|ET|EDT|UTC)?/i,
    /(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}:\d{2}:\d{2})/i,
  ];
  
  for (const regex of patterns) {
    const match = chunk.match(regex);
    if (match) {
      const datePart = `${match[3]}-${match[2]}-${match[1]} ${match[4]}`;
      const tzPart = match[5] || 'CET'; // Default to CET if not found but is STARS format
      try {
        const d = new Date(`${datePart} ${tzPart}`);
        if (!isNaN(d.getTime())) return d.toISOString();
      } catch (e) {
        console.error('Error in complex date parse, falling back');
      }
      return `${match[3]}-${match[2]}-${match[1]}T${match[4]}Z`;
    }
  }
  return new Date().toISOString();
};

export const parseTournamentSummary = (content: string): ParsedTournament[] => {
  const tournamentsMap = new Map<string, ParsedTournament>();
  const normalized = content.replace(/\r\n/g, '\n').replace(/[–—]/g, '-');

  // SPLIT ONLY ON NEWLINES FOLLOWED BY KEYWORDS
  let chunks = normalized
    .split(/\n(?=PokerStars|Winamax|Torneo|Tournament|S&G|S\s*&\s*G|Spin|Mano)/i)
    .map(c => c.trim())
    .filter(c => c.length > 20);

  if (chunks.length === 0 && normalized.length > 30) {
    chunks = [normalized.trim()];
  }

  chunks.forEach((chunk, index) => {
    // Robust ID: look for 8-12 digits following any ID-looking keyword
    const idMatch = chunk.match(/(?:Torneo|T|N[.\s]?[ºo]|#)\s*(?:n.º|#|numero|num)?\.?\s*(\d{6,12})/i) ||
                    chunk.match(/(\d{8,12})/);
    
    const tournamentId = idMatch ? idMatch[1] : `manual-${index}`;
    
    // Improved Buy-in + Fee
    const buyInMatch = chunk.match(/(?:Entrada|Buy-in|Buyin|Puesta|Precio):?\s*€?\s*([\d.,]+)\s*[\/|+]\s*[^\d]*([\d.,]+)?/i) ||
                      chunk.match(/([\d.,]+)\s*€?\s*[\/|+]\s*([\d.,]+)/i);

    const buyInRaw = buyInMatch ? parseFloat(buyInMatch[1].replace(',', '.')) : 0;
    const fee = (buyInMatch && buyInMatch[2]) ? parseFloat(buyInMatch[2].replace(',', '.')) : 0;
    const totalBuyIn = buyInRaw + fee;
    
    const posMatch = chunk.match(/(?:finalizado en|posición|puesto|pos)\s*(\d+)/i) ||
                     chunk.match(/(\d+)\.?[ºo]\s*pos/i) ||
                     chunk.match(/Has\s+finalizado\s+en\s+(\d+)/i);
    const totalPlayersChunk = chunk.includes('jugadores') ? (chunk.match(/(\d+)\s*jugadores/)?.[1] ? parseInt(chunk.match(/(\d+)\s*jugadores/)![1]) : 3) : 3;
    let userPosition = posMatch ? parseInt(posMatch[1]) : 0;
    if (userPosition > totalPlayersChunk) userPosition = 0;
    
    let totalPrize = 0;
    let userPrize = 0;
    const prizeLines = chunk.split('\n').filter(l => /\d+:/.test(l));

    for (const l of prizeLines) {
      const pAmountMatch = l.match(/€\s*([\d.,]+)/) || l.match(/([\d.,]+)\s*€/);
      if (pAmountMatch) {
        const val = parseFloat(pAmountMatch[1].replace(',', '.'));
        if (l.match(/^\s*1:/)) totalPrize = Math.max(totalPrize, val);
        if (userPosition > 0 && l.match(new RegExp(`^\\s*${userPosition}:`))) userPrize = val;
      }
    }

    const prizeHeader = chunk.match(/(?:Bote de premios total|Prize Pool|Bote):?\s*€?([\d.,]+)/i);
    if (prizeHeader) totalPrize = parseFloat(prizeHeader[1].replace(',', '.'));
    if (userPosition === 1 && userPrize === 0) userPrize = totalPrize;

    // Extract rivals
    const rivals: { name: string; position: number }[] = [];
    const playerLines = chunk.split('\n').filter(l => /^\s*\d+:/.test(l));
    for (const line of playerLines) {
      const posMatch = line.match(/^\s*(\d+):\s*(\w+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1]);
        const name = posMatch[2].trim();
        if (pos !== userPosition && name) {
          rivals.push({ name, position: pos });
        }
      }
    }

    // FUSION LOGIC: Merge chunks that share the same ID
    const existing = tournamentsMap.get(tournamentId);
    if (existing) {
      if (totalBuyIn > 0) existing.buyIn = totalBuyIn;
      if (userPosition > 0) existing.finishPosition = userPosition;
      if (userPrize > 0) existing.prize = userPrize;
      if (totalPrize > 0 && existing.buyIn > 0) existing.multiplier = Math.round(totalPrize / existing.buyIn);
    } else {
      const parsedDate = parseDateFromContent(chunk);
      tournamentsMap.set(tournamentId, {
        tournamentId,
        site: chunk.includes('Winamax') ? 'Winamax' : 'PokerStars',
        buyIn: totalBuyIn || 1,
        currency: '€',
        gameType: chunk.includes('Omaha') ? 'Omaha' : "Hold'em",
        speed: chunk.includes('Hyper') ? 'Hyper' : 'Turbo',
        date: parsedDate,
        finishPosition: userPosition || 1,
        prize: userPrize || (userPosition === 1 ? totalPrize : 0),
        totalPlayers: chunk.includes('jugadores') ? (chunk.match(/(\d+)\s*jugadores/)?.[1] ? parseInt(chunk.match(/(\d+)\s*jugadores/)![1]) : 3) : 3,
        rivals: rivals,
        multiplier: totalBuyIn > 0 ? Math.round(totalPrize / totalBuyIn) : 2
      });
    }
  });

  return Array.from(tournamentsMap.values());
};

export const saveToSupabase = async (hands: ParsedHand[], tournaments: ParsedTournament[]) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No login');
  
  if (tournaments.length > 0) {
    const tournamentData = tournaments.map(t => ({
      tournament_id: t.tournamentId,
      site: t.site,
      buy_in: t.buyIn,
      currency: t.currency,
      game_type: t.gameType,
      speed: t.speed,
      date: t.date,
      finish_position: t.finishPosition,
      prize: t.prize,
      total_players: t.totalPlayers,
      multiplier: t.multiplier,
      user_id: user.id
    }));
    await supabase.from('tournaments').upsert(tournamentData, { onConflict: 'tournament_id,user_id' });

    const rivalMap = new Map<string, { name: string; buyIn: number; won: boolean }[]>();
    tournaments.forEach(t => {
      const playerWon = t.finishPosition === 1;
      t.rivals.forEach(r => {
        if (!rivalMap.has(r.name)) {
          rivalMap.set(r.name, []);
        }
        rivalMap.get(r.name)!.push({ name: r.name, buyIn: t.buyIn, won: playerWon });
      });
    });

    for (const [rivalName, encounters] of rivalMap) {
      const timesMet = encounters.length;
      const timesWon = encounters.filter(e => e.won).length;
      const timesLost = timesMet - timesWon;
      const buyInLevels = [...new Set(encounters.map(e => e.buyIn))];

      const { data: existing } = await supabase
        .from('rivals')
        .select('*')
        .eq('user_id', user.id)
        .eq('rival_name', rivalName)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('rivals')
          .update({
            times_met: existing.times_met + timesMet,
            times_won: existing.times_won + timesWon,
            times_lost: existing.times_lost + timesLost
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('rivals').insert({
          rival_name: rivalName,
          times_met: timesMet,
          times_won: timesWon,
          times_lost: timesLost,
          buy_in_level: buyInLevels[0],
          user_id: user.id
        });
      }
    }
  }
  return { hands: hands.length, tournaments: tournaments.length };
};