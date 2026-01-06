
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Game, Idea, SageResponse } from './types';
import { consultSage, autoFillGameData } from './services/geminiService';
import { getProcessedGames } from './data/games';
import GameCard from './components/GameCard';
import GameModal from './components/GameModal';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'STATUS' | 'INV' | 'IDEAS' | 'SAGE'>('STATUS');
  const [inventory, setInventory] = useState<Game[]>(() => {
    const saved = localStorage.getItem('tao_inventory');
    if (saved) return JSON.parse(saved);
    return getProcessedGames();
  });
  const [ideas, setIdeas] = useState<Idea[]>(() => {
    const saved = localStorage.getItem('tao_ideas');
    if (saved) return JSON.parse(saved);
    return [
      { id: '1', title: 'Contraste Estético', description: 'Gráficos fofos vs Temas pesados', trigger: 'Curiosidade' },
      { id: '2', title: 'Redenção de Vilão', description: 'Análise de personagens incompreendidos', trigger: 'Revolta' }
    ];
  });
  
  const [logs, setLogs] = useState<string[]>(['SISTEMA TAO OPERANTE.', 'BEM-VINDO AO OS-X CREATIVE PATH.']);
  const [loadingSage, setLoadingSage] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sageResult, setSageResult] = useState<SageResponse | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Form States
  const [newGame, setNewGame] = useState({ n: '', p: 'PS2' });
  const [newIdea, setNewIdea] = useState({ title: '', description: '', trigger: 'Curiosidade' });
  const [massInput, setMassInput] = useState('');
  const [showMassImport, setShowMassImport] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('tao_inventory', JSON.stringify(inventory));
    localStorage.setItem('tao_ideas', JSON.stringify(ideas));
  }, [inventory, ideas]);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const stats = useMemo(() => {
    const tagMap: Record<string, number> = {};
    inventory.forEach(g => {
      const tags = [...g.t, g.g];
      tags.forEach(tag => {
        if (tag && tag !== 'Retro' && tag !== 'Geral') {
          tagMap[tag] = (tagMap[tag] || 0) + 1;
        }
      });
    });
    const total = Object.values(tagMap).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(tagMap).map(([name, count]) => ({
      name,
      percent: (count / total) * 100
    })).sort((a, b) => b.percent - a.percent).slice(0, 8);
  }, [inventory]);

  const addGame = async () => {
    if (!newGame.n) return;
    setLoadingAdd(true);
    setLogs(prev => [...prev, `[IA] INICIANDO SCAN ÚNICO: ${newGame.n.toUpperCase()}...`]);
    try {
      const data = await autoFillGameData(newGame.n);
      const game: Game = {
        id: Date.now().toString(),
        n: newGame.n, p: newGame.p, g: data.genre, t: data.tags,
        synopsis: data.synopsis, popularity: data.popularity,
        obs: '', status: 'Backlog'
      };
      setInventory(prev => [game, ...prev]);
      setLogs(prev => [...prev, `[OK] ${game.n} SINCRONIZADO. NOTA: ${data.popularity}*`]);
      setNewGame({ n: '', p: 'PS2' });
    } catch (e) {
      setLogs(prev => [...prev, `[ERRO] FALHA NO UPLINK COM A BASE DE DADOS.`]);
    }
    setLoadingAdd(false);
  };

  const syncAllGames = async () => {
    if (isSyncing) return;
    
    const unclassified = inventory.filter(g => !g.synopsis);
    const total = unclassified.length;
    
    if (total === 0) {
      setLogs(prev => [...prev, `[SISTEMA] TODOS OS ARTEFATOS JÁ ESTÃO SINCRONIZADOS.`]);
      return;
    }

    setIsSyncing(true);
    setLogs(prev => [...prev, `[SISTEMA] ${total} ARTEFATOS PENDENTES DETECTADOS.`]);
    setLogs(prev => [...prev, `[SISTEMA] INICIANDO PROCESSAMENTO EM LOTES DE 3...`]);
    
    // Processamento em lotes de 3
    for (let i = 0; i < total; i += 3) {
      const batch = unclassified.slice(i, i + 3);
      const batchNum = Math.floor(i / 3) + 1;
      const totalBatches = Math.ceil(total / 3);

      setLogs(prev => [...prev, `[LOTE ${batchNum}/${totalBatches}] ESCANEANDO GRUPO...`]);

      // Executa o lote
      await Promise.all(batch.map(async (game) => {
        try {
          const data = await autoFillGameData(game.n);
          setInventory(prev => prev.map(item => item.id === game.id ? {
            ...item, g: data.genre, t: data.tags, synopsis: data.synopsis, popularity: data.popularity
          } : item));
          setLogs(prev => [...prev, ` -> ${game.n} CONCLUÍDO.`]);
        } catch (e) {
          setLogs(prev => [...prev, ` -> [FALHA] ${game.n}: SINAL FRACO.`]);
        }
      }));

      setLogs(prev => [...prev, `[LOTE ${batchNum}] FINALIZADO. (${Math.min(i + 3, total)}/${total} JOGOS)`]);
      
      // Pequena pausa para respiro da API e percepção do usuário
      if (i + 3 < total) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }

    setLogs(prev => [...prev, `[SISTEMA] ESCANEAMENTO TOTAL CONCLUÍDO COM SUCESSO.`]);
    setIsSyncing(false);
  };

  const addIdea = () => {
    if (!newIdea.title) return;
    const idea: Idea = { id: Date.now().toString(), ...newIdea };
    setIdeas(prev => [...prev, idea]);
    setNewIdea({ title: '', description: '', trigger: 'Curiosidade' });
    setLogs(prev => [...prev, `[SISTEMA] NOVA IDEIA MEMORIZADA: ${idea.title.toUpperCase()}`]);
  };

  return (
    <div className="flex h-screen bg-[#050505] text-[#00f2ff] mono">
      {/* Sidebar HUD */}
      <aside className="w-72 border-r border-[#00f2ff]/10 bg-black/40 flex flex-col p-6 z-20">
        <div className="mb-12">
          <h1 className="text-4xl font-black italic tracking-tighter glow-text mb-1 glitch cursor-default">TAO <span className="text-[#b026ff]">OS</span></h1>
          <p className="text-[10px] opacity-30 uppercase tracking-[0.4em]">Neural Core v4.2</p>
        </div>
        <nav className="flex flex-col space-y-3">
          {(['STATUS', 'INV', 'IDEAS', 'SAGE'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-6 py-4 text-[11px] font-bold tracking-[0.2em] transition-all text-left group ${
                activeTab === tab ? 'text-black' : 'text-[#00f2ff]/50 hover:text-[#00f2ff]'
              }`}
            >
              <div className={`absolute inset-0 transition-all duration-300 ${activeTab === tab ? 'bg-[#00f2ff] opacity-100' : 'bg-white/5 opacity-0 group-hover:opacity-100'}`} style={{ clipPath: 'polygon(0 0, 92% 0, 100% 25%, 100% 100%, 8% 100%, 0 75%)' }}></div>
              <span className="relative z-10">{tab === 'INV' ? '01. INVENTÁRIO' : tab === 'IDEAS' ? '02. IDEIAS' : tab === 'SAGE' ? '03. SÁBIO' : '00. STATUS'}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-white/5">
          <div className="p-4 bg-[#b026ff]/5 border border-[#b026ff]/20 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-[9px] text-[#b026ff] font-bold uppercase tracking-widest">Neural Sync</h4>
              <span className="text-[9px] font-black text-white">{Math.round((inventory.filter(g => g.synopsis).length / Math.max(1, inventory.length)) * 100)}%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-[#b026ff] transition-all duration-1000 shadow-[0_0_10px_#b026ff]" style={{ width: `${(inventory.filter(g => g.synopsis).length / Math.max(1, inventory.length)) * 100}%` }}></div>
            </div>
            <p className="text-[8px] opacity-30 mt-2 uppercase tracking-tighter">Sincronia total recomendada para análise</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
          
          {activeTab === 'STATUS' && (
            <div className="max-w-4xl space-y-12 animate-in fade-in slide-in-from-left-4">
              <h2 className="text-5xl font-black uppercase tracking-tighter text-white">Status Operacional</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h3 className="text-[#b026ff] text-[10px] font-bold uppercase tracking-[0.4em] border-b border-[#b026ff]/20 pb-2">Distribuição de Conceitos</h3>
                  {stats.map(s => (
                    <div key={s.name} className="space-y-1.5">
                      <div className="flex justify-between text-[9px] uppercase tracking-widest opacity-60"><span>{s.name}</span><span>{s.percent.toFixed(0)}%</span></div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#00f2ff] shadow-[0_0_8px_#00f2ff]" style={{ width: `${s.percent}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-[#0d0d12] p-8 border border-white/5 rounded-[40px] flex items-center justify-around shadow-2xl">
                   <div className="text-center">
                      <div className="text-6xl font-black text-white">{inventory.length}</div>
                      <div className="text-[9px] opacity-30 uppercase mt-2 tracking-widest">Arquivos</div>
                   </div>
                   <div className="text-center">
                      <div className="text-6xl font-black text-[#b026ff]">{ideas.length}</div>
                      <div className="text-[9px] opacity-30 uppercase mt-2 tracking-widest">Ideias</div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'INV' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="flex justify-between items-end border-b border-white/5 pb-6">
                <div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-white">Base de Dados</h2>
                  <p className="text-[10px] opacity-40 uppercase tracking-[0.2em] mt-1">Artefatos recuperados do vácuo digital</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={syncAllGames} 
                    disabled={isSyncing} 
                    className={`text-[10px] font-black px-8 py-3 rounded-2xl uppercase tracking-widest border transition-all ${isSyncing ? 'opacity-30 border-white/10 bg-white/5 text-white/40' : 'border-[#00f2ff] bg-[#00f2ff]/10 hover:bg-[#00f2ff] hover:text-black shadow-[0_0_20px_rgba(0,242,255,0.25)]'}`}
                  >
                    {isSyncing ? 'Sincronizando Lotes...' : 'Sincronia Total IA (3 em 3)'}
                  </button>
                  <button onClick={() => setShowMassImport(!showMassImport)} className="text-[10px] font-bold px-6 py-3 rounded-2xl uppercase tracking-widest bg-white/5 border border-white/10 hover:border-[#00f2ff] transition-all text-white/60">Importar Lote</button>
                </div>
              </div>

              {!showMassImport && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-[#0d0d12] border border-white/5 rounded-3xl shadow-2xl">
                  <input className="bg-black border border-white/10 p-4 rounded-2xl text-sm outline-none focus:border-[#00f2ff] transition-all text-[#00f2ff] placeholder:opacity-20" placeholder="IDENTIFICAR NOVO JOGO..." value={newGame.n} disabled={loadingAdd} onChange={e => setNewGame({...newGame, n: e.target.value})} />
                  <select className="bg-black border border-white/10 p-4 rounded-2xl text-sm outline-none focus:border-[#00f2ff] transition-all uppercase" value={newGame.p} disabled={loadingAdd} onChange={e => setNewGame({...newGame, p: e.target.value})}>
                    <option value="PS1">PlayStation 1</option><option value="PS2">PlayStation 2</option><option value="SNES">Super Nintendo</option><option value="Arcade">Arcade Systems</option><option value="PC">Personal Computer</option>
                  </select>
                  <button onClick={addGame} disabled={loadingAdd || !newGame.n} className={`bg-[#00f2ff] text-black font-black uppercase text-[12px] tracking-[0.2em] rounded-2xl shadow-lg active:scale-95 transition-all ${loadingAdd ? 'opacity-50 animate-pulse' : ''}`}>
                    {loadingAdd ? 'IA BUSCANDO...' : 'Adicionar ao Core'}
                  </button>
                </div>
              )}

              {showMassImport && (
                <div className="bg-black border border-dashed border-[#00f2ff]/20 p-10 rounded-[40px] animate-in zoom-in-95 shadow-inner">
                  <textarea value={massInput} onChange={e => setMassInput(e.target.value)} placeholder="Insira os títulos aqui (um por linha)..." className="w-full h-40 bg-[#0d0d12] border border-white/10 p-6 text-[#00f2ff] text-sm mb-6 rounded-3xl outline-none focus:border-[#00f2ff] transition-all" />
                  <button onClick={() => {
                    const names = massInput.split('\n').map(n => n.trim()).filter(n => n.length > 0);
                    const games = names.map((n, i) => ({ id: `${Date.now()}-${i}`, n, p: 'Retro', g: 'Geral', t: ['Geral'], obs: '', status: 'Backlog' as any }));
                    setInventory(prev => [...games, ...prev]);
                    setMassInput(''); setShowMassImport(false);
                    setLogs(prev => [...prev, `[SISTEMA] ${names.length} NOVOS ARTEFATOS INJETADOS NO BUFFER.`]);
                  }} className="bg-[#b026ff] text-white font-black px-12 py-4 text-[11px] uppercase rounded-2xl tracking-[0.3em] shadow-[0_0_20px_#b026ff44]">Processar Injeção</button>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 pb-20">
                {inventory.map(game => (
                  <GameCard key={game.id} game={game} onSelect={setSelectedGame} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'IDEAS' && (
             <div className="space-y-8 animate-in fade-in">
                <h2 className="text-4xl font-black uppercase text-[#b026ff] tracking-tighter">Fábrica de Conceitos</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-[#b026ff]/5 border border-[#b026ff]/20 rounded-3xl">
                  <input className="bg-black/40 border border-white/10 p-3 rounded-xl text-xs text-white" placeholder="Título da Ideia..." value={newIdea.title} onChange={e => setNewIdea({...newIdea, title: e.target.value})} />
                  <input className="bg-black/40 border border-white/10 p-3 rounded-xl text-xs text-white" placeholder="Gatilho Emocional..." value={newIdea.trigger} onChange={e => setNewIdea({...newIdea, trigger: e.target.value})} />
                  <input className="bg-black/40 border border-white/10 p-3 rounded-xl text-xs text-white md:col-span-2" placeholder="Descreva o conceito técnico ou criativo..." value={newIdea.description} onChange={e => setNewIdea({...newIdea, description: e.target.value})} />
                  <button onClick={addIdea} className="bg-[#b026ff] text-white font-black uppercase text-[10px] rounded-xl tracking-widest hover:bg-[#b026ff]/80 transition-all">Sincronizar Ideia</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {ideas.map(idea => (
                    <div key={idea.id} className="p-8 bg-[#0d0d12] border border-white/5 rounded-[32px] relative overflow-hidden group hover:border-[#b026ff]/40 transition-all shadow-xl">
                      <div className="absolute top-0 right-0 p-8 text-7xl opacity-5 font-black italic group-hover:opacity-10 transition-opacity uppercase">{idea.trigger}</div>
                      <h3 className="text-2xl font-black uppercase mb-3 text-white group-hover:text-[#b026ff] transition-colors">{idea.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed mb-6 opacity-70 group-hover:opacity-100 transition-opacity">{idea.description}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-[#b026ff] px-4 py-1.5 bg-[#b026ff]/10 rounded-full border border-[#b026ff]/20 uppercase tracking-[0.2em]">Target: {idea.trigger}</span>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'SAGE' && (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center">
              {loadingSage ? (
                <div className="space-y-8">
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 border-4 border-[#b026ff]/10 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-[#b026ff] rounded-full animate-spin"></div>
                  </div>
                  <p className="text-[#b026ff] font-bold uppercase tracking-[0.5em] text-[10px] animate-pulse">Sintonizando Frequências Sábias...</p>
                </div>
              ) : sageResult ? (
                <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-8">
                  <div className="p-12 bg-[#0d0d12] border border-white/5 rounded-[60px] flex items-center justify-between shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f2ff]/5 blur-[60px] rounded-full"></div>
                    <div className="text-left relative z-10">
                      <div className="text-8xl font-black text-[#00f2ff] leading-none">{sageResult.synergy}%</div>
                      <div className="text-[10px] opacity-30 uppercase mt-4 text-white tracking-[0.6em]">Nível de Sinergia</div>
                    </div>
                    <div className="max-w-xs text-right relative z-10">
                        <p className="text-xs italic opacity-80 text-gray-300 leading-relaxed">"{sageResult.analysis}"</p>
                    </div>
                  </div>
                  <div className="grid gap-6">
                    {sageResult.titles.map((t, i) => (
                      <div key={i} className="p-8 bg-[#111114] border border-white/5 rounded-3xl hover:border-[#00f2ff]/40 cursor-pointer transition-all group flex items-center justify-between" onClick={() => {
                        navigator.clipboard.writeText(t);
                        setLogs(prev => [...prev, `[CLIPBOARD] COPIADO: ${t}`]);
                      }}>
                        <div className="text-left">
                           <div className="text-[8px] text-[#00f2ff] opacity-40 mb-1 font-black uppercase tracking-[0.4em]">Propulsão {i+1}</div>
                           <div className="text-xl font-bold italic text-white group-hover:text-[#00f2ff] transition-colors leading-tight">"{t}"</div>
                        </div>
                        <svg className="w-5 h-5 opacity-0 group-hover:opacity-40 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="opacity-10 space-y-6">
                  <div className="text-9xl font-black tracking-tighter">SAGE</div>
                  <p className="text-xs tracking-[0.8em] uppercase">Selecione uma semente para iniciar análise</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Console Rodapé Minimalista */}
        <div className="h-44 bg-black/80 backdrop-blur-2xl border-t border-white/5 p-6 flex flex-col z-30">
          <div ref={scrollRef} className="flex-1 overflow-y-auto mb-4 custom-scrollbar-mini font-mono">
            {logs.map((log, i) => (
              <div key={i} className={`text-[10px] mb-1.5 tracking-tight ${log.includes('[ERRO]') ? 'text-red-500 font-bold' : log.includes('[LOTE') ? 'text-[#00f2ff] font-bold' : log.includes('[OK]') || log.includes('CONCLUÍDO') ? 'text-green-400' : log.includes('[IA]') || log.includes('[SCAN]') ? 'text-[#b026ff]' : 'text-white/30'}`}>
                {log}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 border-t border-white/5 pt-4">
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-[#00f2ff]/40">System Heartbeat: Stable</div>
              <div className="flex-1 h-[1px] bg-white/5"></div>
              <div className="flex gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                  <div className="w-1 h-1 rounded-full bg-[#00f2ff] animate-pulse delay-75"></div>
                  <div className="w-1 h-1 rounded-full bg-[#b026ff] animate-pulse delay-150"></div>
              </div>
          </div>
        </div>
      </main>

      <GameModal game={selectedGame} onClose={() => setSelectedGame(null)} />
    </div>
  );
};

export default App;
