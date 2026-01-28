
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { QuizItem, QuizLevel, GeneratorConfig, GithubSyncConfig } from './types';
import { generateQuizBatch } from './geminiService';
import { parseCSV, downloadJson, isDuplicate, shuffleArray, generateId } from './utils';
import { PRESET_QUIZ_DATA } from './presets';

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost' | 'github' }> = ({ 
  children, variant = 'primary', className = '', ...props 
}) => {
  const base = "px-4 py-3 rounded-xl font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 text-sm";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200",
    danger: "bg-red-500 text-white hover:bg-red-600",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    outline: "bg-white text-slate-600 border-2 border-slate-200 hover:border-blue-400",
    ghost: "text-slate-500 hover:bg-slate-100 shadow-none",
    github: "bg-slate-900 text-white hover:bg-black",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

export default function App() {
  const [dbItems, setDbItems] = useState<QuizItem[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_user_api_key') || '');
  const [view, setView] = useState<'home' | 'play' | 'manage' | 'settings' | 'result'>('home');
  const [studyCount, setStudyCount] = useState(10);
  const [sessionItems, setSessionItems] = useState<QuizItem[]>([]);
  
  // Quiz Session State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  // Management State
  const [bulkInput, setBulkInput] = useState('');
  const [genLevel, setGenLevel] = useState<QuizLevel>(QuizLevel.LEVEL_3);
  const [genCount, setGenCount] = useState(5);
  const [genTopic, setGenTopic] = useState('');
  
  // GitHub Config
  const [ghConfig, setGhConfig] = useState<GithubSyncConfig>(() => {
    const saved = localStorage.getItem('gh_sync_config');
    return saved ? JSON.parse(saved) : { token: '', owner: '', repo: '', path: 'questions.json', branch: 'main' };
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial Load Logic
  useEffect(() => {
    const initData = async () => {
      const saved = localStorage.getItem('wh_quiz_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setDbItems(parsed);
          setIsInitializing(false);
          return;
        }
      }
      
      // LocalStorageが空か初期状態なら、まず ./questions.json の取得を試みる
      try {
        const res = await fetch('./questions.json?t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          setDbItems(data);
        } else {
          setDbItems(PRESET_QUIZ_DATA);
        }
      } catch (e) {
        setDbItems(PRESET_QUIZ_DATA);
      } finally {
        setIsInitializing(false);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      localStorage.setItem('wh_quiz_data', JSON.stringify(dbItems));
      localStorage.setItem('gh_sync_config', JSON.stringify(ghConfig));
    }
  }, [dbItems, ghConfig, isInitializing]);

  // --- Functions ---

  const handleImport = (items: QuizItem[]) => {
    if (!items || items.length === 0) return;
    const unique = items.filter(n => !isDuplicate(n.question, dbItems));
    if (unique.length === 0) {
      alert("すべての問題が重複しています。");
      return;
    }
    setDbItems(prev => [...prev, ...unique]);
    alert(`${unique.length}問を追加しました。`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleImport(parseCSV(text));
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleGenerateAI = async () => {
    if (!apiKey) { alert("Gemini APIキーを設定してください。"); return; }
    setIsBusy(true);
    try {
      const newItems = await generateQuizBatch({ level: genLevel, count: genCount, focusTopic: genTopic }, apiKey);
      handleImport(newItems);
    } catch (e) {
      alert("AI生成に失敗しました。");
    } finally {
      setIsBusy(false);
    }
  };

  const syncFromGithub = async () => {
    if (!ghConfig.owner || !ghConfig.repo) { alert("GitHubリポジトリ設定が不十分です。"); return; }
    setIsBusy(true);
    try {
      const cacheBuster = `?t=${Date.now()}`;
      const url = `https://raw.githubusercontent.com/${ghConfig.owner}/${ghConfig.repo}/${ghConfig.branch}/${ghConfig.path}${cacheBuster}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      if (Array.isArray(data)) {
        if (confirm(`GitHubから ${data.length} 問取得しました。現在の ${dbItems.length} 問と統合しますか？\n(重複は除外されます)`)) {
          handleImport(data);
        }
      }
    } catch (e) {
      alert("GitHubからの取得に失敗しました。");
    } finally {
      setIsBusy(false);
    }
  };

  const pushToGithub = async () => {
    const { token, owner, repo, path, branch } = ghConfig;
    if (!token || !owner || !repo) { alert("GitHubトークン等の設定が必要です。"); return; }
    
    setIsBusy(true);
    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const headers = { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' };
      
      const getRes = await fetch(apiUrl + `?ref=${branch}`, { headers });
      let sha = "";
      if (getRes.ok) {
        const remoteFile = await getRes.json();
        sha = remoteFile.sha;
        const remoteData = JSON.parse(atob(remoteFile.content));
        
        // --- 厳格ガード: 問題数が減る場合は上書きを阻止 ---
        if (dbItems.length < remoteData.length) {
          throw new Error(`リモートの問題数 (${remoteData.length}) がローカル (${dbItems.length}) より多いため、保存を中断しました。まずはGitHubから同期(取得)してください。`);
        }
      }

      const body = {
        message: `Sync questions (Count: ${dbItems.length})`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(dbItems, null, 2)))),
        branch,
        sha: sha || undefined
      };

      const putRes = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (!putRes.ok) throw new Error("Push failed");
      alert(`GitHubへ ${dbItems.length} 問を上書き保存しました。`);

    } catch (e: any) {
      alert(`同期エラー: ${e.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  if (isInitializing) return <div className="min-h-screen flex items-center justify-center font-black italic text-blue-600 animate-pulse text-2xl">LOADING...</div>;

  const renderHome = () => (
    <div className="max-w-4xl mx-auto space-y-12 py-10 px-4 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-black text-slate-800 tracking-tighter italic">WHC Master</h1>
        <p className="text-slate-500 font-bold bg-white inline-block px-8 py-2 rounded-full border shadow-sm">
          ライブラリ搭載数: <span className="text-blue-600 text-2xl">{dbItems.length}</span> 問
        </p>
      </div>

      <div className="flex justify-center items-center gap-4">
        <span className="text-xs font-black text-slate-400">SESSION COUNT:</span>
        {[10, 20, 30, 50, 100].map(c => (
          <button key={c} onClick={() => setStudyCount(c)} className={`w-12 h-12 rounded-full text-xs font-black transition-all ${studyCount === c ? 'bg-blue-600 text-white shadow-lg scale-110' : 'bg-white text-slate-400 border hover:bg-slate-50'}`}>{c}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.values(QuizLevel).map((level) => {
          const count = dbItems.filter(i => i.level === level).length;
          return (
            <div key={level} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200 hover:shadow-xl transition-all group overflow-hidden relative">
              <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-4xl font-black text-slate-800">{level}</h3>
                <div className="text-right">
                  <span className="text-4xl font-black text-blue-600">{count}</span>
                  <span className="text-xs font-bold text-slate-400 ml-1">ITEMS</span>
                </div>
              </div>
              <Button className="w-full py-4 text-xl rounded-2xl relative z-10" onClick={() => {
                const levelItems = dbItems.filter(i => i.level === level);
                const shuffled = shuffleArray(levelItems);
                setSessionItems(shuffled.slice(0, studyCount));
                setCurrentQIndex(0); setScore(0); setSelectedOption(null); setShowResult(false); setView('play');
              }} disabled={count === 0}>TEST START</Button>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-4 pt-10 border-t">
        <Button variant="outline" onClick={() => setView('manage')}>📂 データハブ</Button>
        <Button variant="ghost" onClick={() => setView('settings')}>⚙️ 設定</Button>
      </div>
    </div>
  );

  const renderManage = () => (
    <div className="max-w-4xl mx-auto space-y-8 py-10 px-4 animate-fade-in-up pb-32">
      {isBusy && <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[100] font-black text-blue-600 italic text-3xl animate-pulse">SYNCING...</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ①② CSV/Text Import */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
          <h2 className="text-xl font-black flex items-center gap-2">📥 データの追加 <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-400">①②</span></h2>
          <div className="space-y-3">
            <Button variant="outline" className="w-full h-16" onClick={() => fileInputRef.current?.click()}>CSVファイルを選択</Button>
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <div className="relative">
              <textarea className="w-full h-32 p-4 bg-slate-50 border rounded-2xl font-mono text-[10px] outline-none focus:ring-2 focus:ring-blue-400" placeholder="CSV形式テキストを貼り付け..." value={bulkInput} onChange={e => setBulkInput(e.target.value)} />
              <Button variant="secondary" className="absolute bottom-2 right-2" onClick={() => { handleImport(parseCSV(bulkInput)); setBulkInput(''); }} disabled={!bulkInput.trim()}>追加</Button>
            </div>
          </div>
        </div>

        {/* ③ AI Generate */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
          <h2 className="text-xl font-black flex items-center gap-2">🤖 AI生成 <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-400">③</span></h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <select value={genLevel} onChange={e => setGenLevel(e.target.value as QuizLevel)} className="p-4 bg-slate-50 border rounded-xl font-bold">
                {Object.values(QuizLevel).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="p-4 bg-slate-50 border rounded-xl font-bold">
                {[5, 10, 20].map(c => <option key={c} value={c}>{c}問</option>)}
              </select>
            </div>
            <input type="text" placeholder="生成テーマ (例: 15世紀ルネサンス)" value={genTopic} onChange={e => setGenTopic(e.target.value)} className="w-full p-4 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-bold" />
            <Button variant="primary" className="w-full py-4 h-16" onClick={handleGenerateAI} disabled={!apiKey}>AIで問題を生成・統合</Button>
          </div>
        </div>
      </div>

      {/* ④ GitHub Sync */}
      <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl space-y-6 border-b-8 border-slate-950">
        <div className="flex justify-between items-start">
          <h2 className="text-2xl font-black flex items-center gap-2">🌐 GitHub マスター同期 <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-white/40">④</span></h2>
          <span className="text-[10px] font-mono opacity-40">Branch: {ghConfig.branch}</span>
        </div>
        <p className="text-xs text-white/50 leading-relaxed italic">
          クラウド(GitHub)のリポジトリと同期します。保存時、クラウド側の問題数が多い場合はエラーとなり、データ喪失を防ぎます。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="github" className="border border-white/20 py-5" onClick={syncFromGithub}>GitHubからデータを取得</Button>
          <Button variant="success" className="py-5 shadow-xl shadow-emerald-950/40" onClick={pushToGithub}>
            GitHubへ上書き保存 ({dbItems.length}問)
          </Button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <h2 className="text-xl font-black mb-6">全データ閲覧 ({dbItems.length})</h2>
        <div className="max-h-60 overflow-y-auto divide-y text-[10px] font-bold">
          {dbItems.length === 0 ? <p className="text-center py-10 opacity-30">データが空です</p> : 
           dbItems.slice().reverse().map(item => (
            <div key={item.id} className="py-3 flex justify-between items-center group px-2">
              <span className="flex-1 truncate opacity-60 group-hover:opacity-100">{item.question}</span>
              <span className="bg-slate-100 px-2 py-1 rounded ml-4 min-w-[40px] text-center">{item.level}</span>
              <button onClick={() => setDbItems(prev => prev.filter(i => i.id !== item.id))} className="text-red-400 opacity-0 group-hover:opacity-100 px-4">DEL</button>
            </div>
          ))}
        </div>
      </div>

      <Button variant="secondary" className="w-full py-4" onClick={() => setView('home')}>ホームに戻る</Button>
    </div>
  );

  const renderPlay = () => {
    const q = sessionItems[currentQIndex];
    if (!q) return null;
    const opts = [q.option1, q.option2, q.option3, q.option4];
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 animate-fade-in">
        <div className="flex justify-between items-center mb-8">
          <span className="bg-slate-800 text-white px-4 py-1 rounded-full text-[10px] font-black">{q.level}</span>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-black italic">{currentQIndex + 1} / {sessionItems.length}</span>
          </div>
        </div>
        <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border-b-8 border-slate-200 mb-8 relative">
          {q.is_japan && <div className="absolute top-0 right-0 bg-red-600 text-white px-6 py-2 rounded-bl-3xl text-[10px] font-black italic">JAPAN</div>}
          <h2 className="text-2xl font-bold leading-relaxed">{q.question}</h2>
        </div>
        <div className="grid gap-3">
          {opts.map((opt, i) => (
            <button key={i} onClick={() => !showResult && (setSelectedOption(i), setShowResult(true), i === q.correct_idx && setScore(s => s+1))} disabled={showResult} className={`p-6 text-left rounded-2xl border-2 font-bold transition-all ${showResult ? (i === q.correct_idx ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : (i === selectedOption ? 'bg-red-50 border-red-500 text-red-800' : 'opacity-40 border-slate-100')) : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-lg active:scale-95'}`}>
              {opt}
            </button>
          ))}
        </div>
        {showResult && (
          <div className="mt-8 animate-fade-in-up bg-white p-8 rounded-[2.5rem] shadow-lg border-t-8 border-blue-400">
            <p className="text-slate-700 mb-4 font-bold leading-relaxed">{q.explanation}</p>
            <div className="bg-slate-50 p-6 rounded-2xl text-[11px] text-slate-500 italic mb-8 border-l-4 border-blue-200">{q.advanced_explanation}</div>
            <Button className="w-full py-5 text-xl" onClick={() => {
              if (currentQIndex < sessionItems.length - 1) { setCurrentQIndex(c => c+1); setSelectedOption(null); setShowResult(false); } 
              else { setView('result'); }
            }}>{currentQIndex === sessionItems.length - 1 ? 'RESULT' : 'NEXT QUESTION'}</Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t h-20 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:border-b shadow-2xl">
        <button onClick={() => setView('home')} className={`w-1/4 h-full font-black text-[10px] flex flex-col items-center justify-center gap-1 ${view === 'home' ? 'text-blue-600' : 'text-slate-300'}`}>🏠<span>HOME</span></button>
        <button onClick={() => setView('manage')} className={`w-1/4 h-full font-black text-[10px] flex flex-col items-center justify-center gap-1 ${view === 'manage' ? 'text-blue-600' : 'text-slate-300'}`}>📂<span>DATA</span></button>
        <button onClick={() => setView('settings')} className={`w-1/4 h-full font-black text-[10px] flex flex-col items-center justify-center gap-1 ${view === 'settings' ? 'text-blue-600' : 'text-slate-300'}`}>⚙️<span>SETUP</span></button>
      </nav>
      <main className="pt-6 md:pt-24">
        {view === 'home' && renderHome()}
        {view === 'manage' && renderManage()}
        {view === 'play' && renderPlay()}
        {view === 'settings' && (
          <div className="max-w-xl mx-auto py-10 px-4"><div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-8">
            <h2 className="text-2xl font-black italic">SYSTEM CONFIG</h2>
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-400 block uppercase">Gemini API Key</label>
              <input type="password" value={apiKey} onChange={e => {setApiKey(e.target.value); localStorage.setItem('gemini_user_api_key', e.target.value);}} className="w-full p-4 bg-slate-50 border rounded-xl font-mono text-sm" placeholder="AI生成に必要" />
            </div>
            <div className="space-y-4 pt-6 border-t">
              <label className="text-xs font-black text-slate-400 block uppercase">GitHub Connection (PAT)</label>
              <input type="password" placeholder="PAT (Personal Access Token)" value={ghConfig.token} onChange={e => setGhConfig({...ghConfig, token: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-xl font-mono text-sm mb-2" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Owner" value={ghConfig.owner} onChange={e => setGhConfig({...ghConfig, owner: e.target.value})} className="p-4 bg-slate-50 border rounded-xl text-xs font-bold" />
                <input type="text" placeholder="Repo" value={ghConfig.repo} onChange={e => setGhConfig({...ghConfig, repo: e.target.value})} className="p-4 bg-slate-50 border rounded-xl text-xs font-bold" />
              </div>
            </div>
            <Button className="w-full py-4" onClick={() => setView('home')}>SAVE & BACK</Button>
          </div></div>
        )}
        {view === 'result' && (
          <div className="max-w-xl mx-auto py-20 px-4 text-center animate-fade-in space-y-12">
            <h2 className="text-9xl font-black text-slate-800 italic">{Math.round((score/sessionItems.length)*100)}<span className="text-4xl text-slate-300 ml-2">%</span></h2>
            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6">
              <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Session Complete</p>
              <div className="flex justify-center gap-4">
                <Button className="flex-1 py-4" onClick={() => setView('home')}>HOME</Button>
                <Button variant="secondary" className="flex-1 py-4" onClick={() => { setView('play'); setCurrentQIndex(0); setScore(0); setSelectedOption(null); setShowResult(false); }}>RETRY</Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
