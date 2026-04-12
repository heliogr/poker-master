import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, CheckCircle, Loader2, TrendingUp, ShieldCheck, Database } from 'lucide-react';
import * as mammoth from 'mammoth';
import { parseHandHistory, parseTournamentSummary, saveToSupabase, ParsedTournament, ParsedHand } from '../lib/parser';

interface UploadSummary {
  totalTournaments: number;
  totalHands: number;
  totalBuyIn: number;
  totalPrize: number;
  profit: number;
  itmCount: number;
  tournaments: ParsedTournament[];
}

const Upload = () => {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [pendingTournaments, setPendingTournaments] = useState<ParsedTournament[]>([]);
  const [pendingHands, setPendingHands] = useState<ParsedHand[]>([]);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setProcessing(true);
    setSummary(null);

    const allTournaments: ParsedTournament[] = [];
    const allHands: ParsedHand[] = [];
    let readerCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isDocx = file.name.endsWith('.docx');
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          let content = '';
          if (isDocx) {
            const ab = e.target?.result as ArrayBuffer;
            const result = await mammoth.extractRawText({ arrayBuffer: ab });
            content = result.value;
          } else {
            content = e.target?.result as string;
          }
          
          if (/Hand\s*#\d+/i.test(content)) {
            allHands.push(...parseHandHistory(content));
          } else {
            allTournaments.push(...parseTournamentSummary(content));
          }
        } catch (err) {
          console.error(`Error procesando ${file.name}:`, err);
        }
        
        readerCount++;
        
        if (readerCount === files.length) {
          setPendingTournaments(allTournaments);
          setPendingHands(allHands);
          setProcessing(false);
        }
      };

      if (isDocx) reader.readAsArrayBuffer(file);
      else reader.readAsText(file, 'UTF-8');
    }
  };

  const confirmImport = async () => {
    setProcessing(true);
    try {
      const result = await saveToSupabase(pendingHands, pendingTournaments);
      console.log('Save result:', result);
      
      let tBuyIn = 0;
      let tPrize = 0;
      let tItm = 0;

      pendingTournaments.forEach(t => {
        tBuyIn += t.buyIn;
        tPrize += t.prize;
        if (t.finishPosition === 1) tItm++;
      });

      setSummary({
        totalTournaments: pendingTournaments.length,
        totalHands: pendingHands.length,
        totalBuyIn: tBuyIn,
        totalPrize: tPrize,
        profit: tPrize - tBuyIn,
        itmCount: tItm,
        tournaments: [...pendingTournaments]
      });
      setPendingTournaments([]);
      setPendingHands([]);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (e) {
      alert('Error al guardar en la base de datos');
    }
    setProcessing(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto selection:bg-primary/30 font-sans">
      <header className="mb-12 border-b border-white/5 pb-8 flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black tracking-tighter text-white italic uppercase leading-none">IMPORTACIÓN <span className="text-zinc-700 not-italic font-light">TERMINAL</span></h2>
          <p className="text-zinc-500 font-bold tracking-widest text-[10px] mt-2 flex items-center gap-2 uppercase">
            SOPORTE DE HISTORIALES POKERSTARS Y WINAMAX
          </p>
        </div>
        {processing && (
          <div className="flex items-center gap-4 text-pokerGreenHighlight bg-pokerGreenHighlight/5 px-6 py-3 rounded-2xl border border-pokerGreenHighlight/20 animate-pulse transition-all">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest italic">PROCESANDO CAPA DE DATOS...</span>
          </div>
        )}
      </header>

      {!summary && pendingTournaments.length === 0 && (
        <div 
          className={`bg-zinc-900/20 backdrop-blur-2xl border-2 border-dashed rounded-[3rem] p-24 flex flex-col items-center justify-center text-center transition-all duration-500 hover:scale-[1.01] ${
            isDragging 
              ? 'border-primary bg-primary/5 shadow-[0_0_80px_rgba(230,0,0,0.2)]' 
              : 'border-white/5 hover:border-white/20 hover:bg-zinc-900/40 shadow-2xl'
          } ${processing ? 'opacity-50 pointer-events-none' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files); }}
        >
          <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center mb-10 shadow-inner border border-white/5">
            <UploadCloud size={48} className="text-primary animate-pulse" />
          </div>
          <h3 className="text-4xl font-black text-white italic tracking-tighter mb-4 uppercase">Arrastra tus archivos</h3>
          <p className="text-zinc-500 mb-12 max-w-md font-medium text-sm leading-relaxed">
            Sube los ficheros de texto o Word para validarlos. Podrás revisar el balance antes de guardarlos definitivamente.
          </p>
          <input type="file" ref={fileInputRef} onChange={(e) => handleFileSelect(e.target.files)} accept=".txt,.docx" multiple className="hidden" />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-white text-black px-12 py-5 rounded-full font-black text-[10px] uppercase tracking-widest hover:scale-110 active:scale-95 transition-all shadow-white/10 shadow-2xl"
          >
            Seleccionar Archivos
          </button>
        </div>
      )}

      {pendingTournaments.length > 0 && !summary && (
        <div className="animate-in slide-in-from-bottom-10 fade-in duration-700">
          <div className="bg-gradient-to-br from-zinc-900 via-black to-zinc-950 border border-white/10 rounded-[3rem] p-12 shadow-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10"></div>
            
            <div className="flex items-center justify-between mb-16">
              <div>
                <div className="flex items-center gap-3 text-primary mb-3">
                  <ShieldCheck size={28} />
                  <span className="text-[11px] font-black tracking-[0.4em] uppercase">VERIFICACIÓN REQUERIDA</span>
                </div>
                <h3 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none">REVISIÓN DE <span className="text-zinc-800">PAQUETE</span></h3>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setPendingTournaments([])} className="bg-white/5 hover:bg-white/10 text-zinc-500 px-8 py-3.5 rounded-full text-[10px] font-black tracking-widest uppercase transition-all">Cancelar</button>
                <button 
                  onClick={confirmImport}
                  className="bg-pokerGreenHighlight text-white px-10 py-3.5 rounded-full text-[10px] font-black tracking-widest uppercase shadow-[0_15px_40px_rgba(16,185,129,0.3)] hover:scale-105 transition-all flex items-center gap-3"
                >
                  <Database size={16} /> Guardar Todo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-16">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 min-h-[110px] flex flex-col justify-between">
                <div className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">Torneos</div>
                <div className="text-4xl font-black text-white italic font-mono">{pendingTournaments.length}</div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 min-h-[110px] flex flex-col justify-between">
                <div className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">Inversión</div>
                <div className="text-3xl font-black text-white italic font-mono">
                  €{pendingTournaments.reduce((acc, t) => acc + t.buyIn, 0).toFixed(0)}
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 min-h-[110px] flex flex-col justify-between">
                <div className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">Premios</div>
                <div className="text-3xl font-black text-pokerGreenHighlight italic font-mono">
                  €{pendingTournaments.reduce((acc, t) => acc + t.prize, 0).toFixed(0)}
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 min-h-[110px] flex flex-col justify-between col-span-2">
                <div className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">Balance</div>
                <div className={`text-4xl font-black italic font-mono ${
                  pendingTournaments.reduce((acc, t) => acc + (t.prize - t.buyIn), 0) >= 0 
                    ? 'text-pokerGreenHighlight' 
                    : 'text-primary'
                }`}>
                  €{pendingTournaments.reduce((acc, t) => acc + (t.prize - t.buyIn), 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-10">
              <h4 className="text-[11px] font-black text-zinc-500 tracking-[0.3em] uppercase mb-10 border-l-4 border-primary pl-6">Desglose del Historial</h4>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-6 custom-scrollbar">
                {pendingTournaments.map((t, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.05] transition-all group"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-[10px] font-black text-zinc-600 group-hover:text-white transition-all">
                        #{t.tournamentId.slice(-6)}
                      </div>
                      <div>
                        <div className="text-xs font-black text-white uppercase tracking-tighter">
                          {t.site} • {t.gameType}
                        </div>
                        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-1 italic">
                          {t.speed}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-12 items-center">
                      <div className="text-right">
                        <div className="text-[8px] font-black text-zinc-700 uppercase mb-1">Coste</div>
                        <div className="text-xs font-black text-zinc-300">€{t.buyIn.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] font-black text-zinc-700 uppercase mb-1">Pos</div>
                        <div className={`text-xs font-black ${t.finishPosition === 1 ? 'text-gold' : 'text-zinc-500'}`}>{t.finishPosition}º</div>
                      </div>
                      <div className="text-right min-w-[70px]">
                        <div className="text-[8px] font-black text-zinc-700 uppercase mb-1">Premio</div>
                        <div className={`text-xs font-black ${t.prize > 0 ? 'text-pokerGreenHighlight italic' : 'text-zinc-600'}`}>€{t.prize.toFixed(2)}</div>
                      </div>
                      <div className="text-right min-w-[80px] border-l border-white/5 pl-8">
                        <div className="text-[8px] font-black text-zinc-700 uppercase mb-1">Balance</div>
                        <div className={`text-sm font-black ${t.prize - t.buyIn >= 0 ? 'text-pokerGreenHighlight' : 'text-primary'}`}>
                          {t.prize - t.buyIn >= 0 ? '+' : ''}€{(t.prize - t.buyIn).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="animate-in zoom-in-95 fade-in duration-700">
          <div className="bg-gradient-to-br from-zinc-900 to-black border border-pokerGreenHighlight/20 rounded-[3rem] p-16 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-[600px] h-[600px] bg-pokerGreenHighlight/10 rounded-full blur-[150px] -z-10"></div>
            
            <div className="flex items-center justify-between mb-20 text-center md:text-left flex-col md:flex-row gap-10">
              <div>
                <div className="flex items-center gap-4 text-pokerGreenHighlight mb-4 justify-center md:justify-start">
                  <CheckCircle size={32} />
                  <span className="text-xs font-black tracking-[0.5em] uppercase">IMPORTACIÓN COMPLETADA</span>
                </div>
                <h3 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none">EQUITY <span className="text-zinc-800">ACTUALIZADA</span></h3>
              </div>
              <button 
                onClick={() => setSummary(null)}
                className="bg-white text-black px-12 py-5 rounded-full text-[11px] font-black tracking-widest uppercase hover:scale-110 active:scale-95 transition-all shadow-white/20 shadow-2xl"
              >
                Cargar Nuevo Paquete
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
              <div className="bg-zinc-800/20 border border-white/5 rounded-3xl p-8 flex flex-col justify-between h-44">
                <div className="text-[10px] font-black text-zinc-600 tracking-[0.2em] uppercase">Partidas</div>
                <div className="text-5xl font-black text-white italic font-mono">{summary.totalTournaments}</div>
              </div>
              <div className="bg-zinc-800/20 border border-white/5 rounded-3xl p-8 flex flex-col justify-between h-44">
                <div className="text-[10px] font-black text-zinc-600 tracking-[0.2em] uppercase">Tasa ITM</div>
                <div className="text-5xl font-black text-pokerGreenHighlight italic font-mono">
                  {summary.totalTournaments > 0 ? ((summary.itmCount / summary.totalTournaments) * 100).toFixed(0) : 0}%
                </div>
              </div>
              <div className="bg-zinc-800/20 border border-white/5 rounded-3xl p-8 flex flex-col justify-between h-44">
                <div className="text-[10px] font-black text-zinc-600 tracking-[0.2em] uppercase text-primary">Gasto Total</div>
                <div className="text-5xl font-black text-white italic font-mono">€{summary.totalBuyIn.toFixed(2)}</div>
              </div>
              <div className="bg-zinc-800/20 border border-primary/20 rounded-3xl p-8 flex flex-col justify-between h-44 shadow-glow-primary/10">
                <div className="text-[10px] font-black text-primary tracking-[0.2em] uppercase">Balance Neto</div>
                <div className={`text-5xl font-black italic font-mono ${summary.profit >= 0 ? 'text-pokerGreenHighlight' : 'text-primary'}`}>
                  {summary.profit >= 0 ? '+' : ''}€{summary.profit.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-10 flex flex-col lg:flex-row items-center gap-12 mt-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-3xl shadow-primary/20">
                <TrendingUp size={40} />
              </div>
              <div className="flex-1 text-center lg:text-left">
                <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">ROI del Paquete: {(summary.totalBuyIn > 0 ? (summary.profit / summary.totalBuyIn * 100) : 0).toFixed(1)}%</h4>
                <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                  Los datos han sido sincronizados con el terminal central. El balance acumulado en el Dashboard y en la sección de Rivales se actualizará automáticamente.
                </p>
              </div>
            </div>

            <div className="bg-black/20 border border-white/5 rounded-[2.5rem] p-8 mt-8">
               <h4 className="text-[10px] font-black text-zinc-600 tracking-widest uppercase mb-6">Auditoría del Paquete Guardado</h4>
               <div className="space-y-3 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                {summary.tournaments.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-all px-6 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-mono text-zinc-700">#{t.tournamentId.slice(-6)}</span>
                      <span className="text-[10px] font-black text-zinc-400 uppercase">{t.site}</span>
                    </div>
                    <div className="flex gap-10 items-center">
                      <div className="text-right">
                        <div className="text-[7px] text-zinc-700 uppercase">Gasto</div>
                        <div className="text-xs font-black text-zinc-400">€{t.buyIn.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[7px] text-zinc-700 uppercase">Premio</div>
                        <div className="text-xs font-black text-pokerGreenHighlight">€{t.prize.toFixed(2)}</div>
                      </div>
                      <div className="text-right min-w-[70px] border-l border-white/5 pl-6">
                        <div className="text-[7px] text-zinc-700 uppercase font-black">Balance</div>
                        <div className={`text-xs font-black ${t.prize - t.buyIn >= 0 ? 'text-pokerGreenHighlight' : 'text-primary'}`}>
                          {t.prize - t.buyIn >= 0 ? '+' : ''}€{(t.prize - t.buyIn).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
