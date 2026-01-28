
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

  useEffect(() => {
    const saved = localStorage.getItem('wh_quiz_data');
    if (saved) {
      setDbItems(JSON.parse(saved));
    } else {
      setDbItems(PRESET_QUIZ_DATA);
    }
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      localStorage.setItem('wh_quiz_data', JSON.stringify(dbItems));
      localStorage.setItem('gh_sync_config', JSON.stringify(ghConfig));
    }
  }, [dbItems, ghConfig, isInitializing]);

  // --- Functions ---

  const handleImport = (items: QuizItem[]) => {
    const unique = items.filter(n => !isDuplicate(n.question, dbItems));
    if (unique.length === 0) {
      alert("新しい問題は見つかりませんでした（すべて重複しています）。");
      return;
    }
    setDbItems(prev => [...prev, ...unique]);
    alert(`${unique.length}問を新しく追加しました。`);
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
    if (!apiKey) { alert("APIキーを設定してください。"); return; }
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
    if (!ghConfig.owner || !ghConfig.repo) { alert("GitHubリポジトリ情報を設定してください。"); return; }
    setIsBusy(true);
    try {
      const cacheBuster = `?t=${Date.now()}`;
      const url = `https://raw.githubusercontent.com/${ghConfig.owner}/${ghConfig.repo}/${ghConfig.branch}/${ghConfig.path}${cacheBuster}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      if (Array.isArray(data)) {
        if (confirm(`GitHubから ${data.length} 問取得しました。現在のリスト (${dbItems.length}問) をこれに置き換えますか？`)) {
          setDbItems(data);
          alert("同期完了しました。");
        }
      }
    } catch (e) {
      alert("GitHubからの取得に失敗しました。リポジトリ設定やファイルパスを確認してください。");
    } finally {
      setIsBusy(false);
    }
  };

  const pushToGithub = async () => {
    const { token, owner, repo, path, branch } = ghConfig;
    if (!token || !owner || !repo) { alert("GitHub設定（トークン等）が不足しています。"); return; }
    
    setIsBusy(true);
    try {
      // 1. Get current remote file (to check size and get SHA)
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const headers = { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' };
      
      const getRes = await fetch(apiUrl + `?ref=${branch}`, { headers });
      let sha = "";
      if (getRes.ok) {
        const remoteFile = await getRes.json();
        sha = remoteFile.sha;
        const remoteData = JSON.parse(atob(remoteFile.content));
        
        // --- ルール: 問題数が減る場合は上書きさせない ---
        if (dbItems.length < remoteData.length) {
          throw new Error(`リモートの問題数 (${remoteData.length}) がローカル (${dbItems.length}) より多いため、上書きできません。まず同期(取得)してください。`);
        }
      }

      // 2. Commit (Push)
      const body = {
        message: `Update questions.json (count: ${dbItems.length})`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(dbItems, null, 2)))),
        branch,
        sha: sha || undefined
      };

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      });

      if (!putRes.ok) throw new Error("Push failed");
      alert(`GitHubの ${path} を更新しました！ (全 ${dbItems.length} 問)`);

    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  // --- Views ---

  const renderHome = () => (
    <div className="max-w-4xl mx-auto space-y-12 py-10 px-4 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black text-slate-800 tracking-tight italic">WHC Master</h1>
        <p className="text-slate-500 font-bold bg-white inline-block px-6 py-2 rounded-full border border-slate-200 shadow-sm">
          現在 <span className="text-blue-600 text-xl">{dbItems.length}</span> 問 搭載中
        </p>
      </div>

      <div className="flex justify-center gap-2">
        {[10, 20, 30, 50, 100].map(c => (
          <button key={c} onClick={() => setStudyCount(c)} className={`w-12 h-12 rounded-full text-xs font-black transition-all ${studyCount === c ? 'bg-blue-600 text-white shadow-lg scale-110' : 'bg-white text-slate-400 border hover:bg-slate-50'}`}>{c}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.values(QuizLevel).map((level) => {
          const count = dbItems.filter(i => i.level === level).length;
          return (
            <div key={level} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 hover:shadow-xl transition-all group">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-3xl font-black text-slate-800">{level}</h3>
                <div className="text-right">
                  <span className="text-3xl font-black text-blue-600">{count}</span>
                  <span className="text-xs font-bold text-slate-400 ml-1">ITEMS</span>
                </div>
              </div>
              <Button className="w-full py-4 text-lg rounded-2xl" onClick={() => {
                const levelItems = dbItems.filter(i => i.level === level);
                const shuffled = shuffleArray(levelItems);
                setSessionItems(shuffled.slice(0, studyCount));
                setCurrentQIndex(0); setScore(0); setSelectedOption(null); setShowResult(false); setView('play');
              }} disabled={count === 0}>Start Training</Button>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-4 pt-10 border-t">
        <Button variant="outline" onClick={() => setView('manage')}>📂 データハブ (管理・同期)</Button>
        <Button variant="ghost" onClick={() => setView('settings')}>⚙️ 設定</Button>
      </div>
    </div>
  );

  const renderManage = () => (
    <div className="max-w-4xl mx-auto space-y-8 py-10 px-4 animate-fade-in-up">
      {isBusy && <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[100] font-black text-blue-600 italic text-2xl animate-pulse">PROCESSING...</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1 & 2: Import */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
          <h2 className="text-xl font-black flex items-center gap-2">📥 外部データの取り込み <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-400">①②</span></h2>
          <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>CSVファイルを選択</Button>
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <div className="relative">
              <textarea className="w-full h-32 p-4 bg-slate-50 border rounded-2xl font-mono text-[10px] outline-none focus:ring-2 focus:ring-blue-400" placeholder="CSV形式のテキストを貼り付け..." value={bulkInput} onChange={e => setBulkInput(e.target.value)} />
              <Button variant="secondary" className="absolute bottom-2 right-2 scale-75" onClick={() => { handleImport(parseCSV(bulkInput)); setBulkInput(''); }} disabled={!bulkInput.trim()}>追加</Button>
            </div>
          </div>
        </div>

        {/* Section 3: AI Generate */}
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
          <h2 className="text-xl font-black flex items-center gap-2">🤖 AIで問題を増やす <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-400">③</span></h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <select value={genLevel} onChange={e => setGenLevel(e.target.value as QuizLevel)} className="p-3 bg-slate-50 border rounded-xl font-bold">
                {Object.values(QuizLevel).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="p-3 bg-slate-50 border rounded-xl font-bold">
                {[5, 10, 20].map(c => <option key={c} value={c}>{c}問生成</option>)}
              </select>
            </div>
            <input type="text" placeholder="テーマ (例: 日本の自然遺産, 建築)" value={genTopic} onChange={e => setGenTopic(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-bold" />
            <Button variant="primary" className="w-full py-4" onClick={handleGenerateAI} disabled={!apiKey}>生成して保存</Button>
          </div>
        </div>
      </div>

      {/* Section 4: GitHub Sync */}
      <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl space-y-6">
        <h2 className="text-xl font-black flex items-center gap-2">🌐 GitHub 連携 <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-white/40">④</span></h2>
        <p className="text-xs text-white/60 leading-relaxed">設定済みのリポジトリへ直接保存します。<strong>ローカルの問題数がリモートより多い場合のみ</strong>上書き可能です。</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="github" className="border border-white/20 py-4" onClick={syncFromGithub}>GitHubから取得 (同期)</Button>
          <Button variant="success" className="py-4 shadow-lg shadow-emerald-900/20" onClick={pushToGithub}>GitHubへ上書き保存</Button>
        </div>
        <div className="pt-4 border-t border-white/10 flex justify-between items-center">
          <p className="text-[10px] font-mono text-white/40">Repo: {ghConfig.owner}/{ghConfig.repo}</p>
          <Button variant="ghost" className="text-white/40 hover:text-white" onClick={() => setView('settings')}>設定を変更</Button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black">データ閲覧 ({dbItems.length})</h2>
          <Button variant="danger" className="scale-75" onClick={() => confirm('全て削除しますか？') && setDbItems([])}>全消去</Button>
        </div>
        <div className="max-h-60 overflow-y-auto divide-y text-xs font-medium">
          {dbItems.slice().reverse().slice(0, 50).map(item => (
            <div key={item.id} className="py-3 flex justify-between items-center group">
              <span className="flex-1 truncate pr-4 italic text-slate-500">{item.question}</span>
              <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded mr-4">{item.level}</span>
              <button onClick={() => setDbItems(prev => prev.filter(i => i.id !== item.id))} className="text-red-400 opacity-0 group-hover:opacity-100">削除</button>
            </div>
          ))}
        </div>
      </div>

      <Button variant="secondary" className="w-full py-4" onClick={() => setView('home')}>ホームへ戻る</Button>
    </div>
  );

  const renderPlay = () => {
    const q = sessionItems[currentQIndex];
    if (!q) return null;
    const opts = [q.option1, q.option2, q.option3, q.option4];
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 animate-fade-in">
        <div className="flex justify-between items-center mb-8">
          <span className="bg-slate-800 text-white px-4 py-1 rounded-full text-[10px] font-black tracking-tighter">{q.level}</span>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-black text-slate-800">{currentQIndex + 1}<span className="text-slate-300 text-sm font-bold ml-1">/ {sessionItems.length}</span></div>
            <div className="h-2 w-24 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${((currentQIndex + 1) / sessionItems.length) * 100}%` }}></div></div>
          </div>
        </div>
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border-b-8 border-slate-200 mb-8 relative overflow-hidden">
          {q.is_japan && <div className="absolute top-0 right-0 bg-red-600 text-white px-6 py-2 rounded-bl-3xl text-[10px] font-black tracking-widest">JAPAN</div>}
          <h2 className="text-2xl font-bold leading-relaxed text-slate-800">{q.question}</h2>
        </div>
        <div className="grid gap-3">
          {opts.map((opt, i) => (
            <button key={i} onClick={() => !showResult && (setSelectedOption(i), setShowResult(true), i === q.correct_idx && setScore(s => s+1))} disabled={showResult} className={`p-6 text-left rounded-2xl border-2 font-bold transition-all ${showResult ? (i === q.correct_idx ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : (i === selectedOption ? 'bg-red-50 border-red-500 text-red-800' : 'opacity-40 border-slate-100')) : 'bg-white border-slate-200 hover:border-blue-400 hover:-translate-y-1'}`}>
              {opt}
            </button>
          ))}
        </div>
        {showResult && (
          <div className="mt-8 animate-fade-in-up bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100">
            <p className="text-slate-600 mb-6 font-bold leading-relaxed">{q.explanation}</p>
            <div className="bg-slate-50 p-6 rounded-2xl text-xs text-slate-500 leading-relaxed mb-6 italic border-l-4 border-blue-400">{q.advanced_explanation}</div>
            <Button className="w-full py-4 text-lg" onClick={() => {
              if (currentQIndex < sessionItems.length - 1) { setCurrentQIndex(c => c+1); setSelectedOption(null); setShowResult(false); } 
              else { setView('result'); }
            }}>{currentQIndex === sessionItems.length - 1 ? '結果を見る' : '次の問題へ'}</Button>
          </div>
        )}
      </div>
    );
  };

  const renderSettings = () => (
    <div className="max-w-xl mx-auto py-10 px-4 space-y-6">
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-8">
        <h2 className="text-2xl font-black">⚙️ 設定</h2>
        
        <div className="space-y-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Gemini API Key</label>
          <input type="password" value={apiKey} onChange={e => {setApiKey(e.target.value); localStorage.setItem('gemini_user_api_key', e.target.value);}} className="w-full p-4 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-mono text-sm" placeholder="AI生成に必要です" />
        </div>

        <div className="space-y-4 pt-6 border-t">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">GitHub Sync Settings</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input type="password" placeholder="GitHub Personal Access Token" value={ghConfig.token} onChange={e => setGhConfig({...ghConfig, token: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-slate-900 font-mono text-sm" />
            </div>
            <input type="text" placeholder="Owner (User)" value={ghConfig.owner} onChange={e => setGhConfig({...ghConfig, owner: e.target.value})} className="p-4 bg-slate-50 border rounded-xl outline-none text-sm font-bold" />
            <input type="text" placeholder="Repo Name" value={ghConfig.repo} onChange={e => setGhConfig({...ghConfig, repo: e.target.value})} className="p-4 bg-slate-50 border rounded-xl outline-none text-sm font-bold" />
            <input type="text" placeholder="Path (json)" value={ghConfig.path} onChange={e => setGhConfig({...ghConfig, path: e.target.value})} className="p-4 bg-slate-50 border rounded-xl outline-none text-sm font-bold" />
            <input type="text" placeholder="Branch" value={ghConfig.branch} onChange={e => setGhConfig({...ghConfig, branch: e.target.value})} className="p-4 bg-slate-50 border rounded-xl outline-none text-sm font-bold" />
          </div>
        </div>

        <Button className="w-full py-4" onClick={() => setView('home')}>設定を完了</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t h-20 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:border-b shadow-2xl md:shadow-none">
        <button onClick={() => setView('home')} className={`w-1/4 h-full font-black text-[10px] flex flex-col items-center justify-center gap-1 uppercase tracking-tighter transition-all ${view === 'home' ? 'text-blue-600 scale-110' : 'text-slate-300 hover:text-slate-500'}`}>🏠<span>HOME</span></button>
        <button onClick={() => setView('manage')} className={`w-1/4 h-full font-black text-[10px] flex flex-col items-center justify-center gap-1 uppercase tracking-tighter transition-all ${view === 'manage' ? 'text-blue-600 scale-110' : 'text-slate-300 hover:text-slate-500'}`}>📂<span>DATA</span></button>
        <button onClick={() => setView('settings')} className={`w-1/4 h-full font-black text-[10px] flex flex-col items-center justify-center gap-1 uppercase tracking-tighter transition-all ${view === 'settings' ? 'text-blue-600 scale-110' : 'text-slate-300 hover:text-slate-500'}`}>⚙️<span>SETUP</span></button>
      </nav>
      <main className="pt-6 md:pt-24">
        {view === 'home' && renderHome()}
        {view === 'play' && renderPlay()}
        {view === 'manage' && renderManage()}
        {view === 'settings' && renderSettings()}
        {view === 'result' && (
          <div className="max-w-2xl mx-auto py-20 px-4 text-center animate-fade-in space-y-12">
            <div className="space-y-4">
              <h2 className="text-8xl font-black text-slate-800">{Math.round((score/sessionItems.length)*100)}<span className="text-3xl text-slate-300 ml-2">%</span></h2>
              <p className="text-slate-400 font-black tracking-[0.5em] uppercase">Training Complete</p>
            </div>
            <div className="bg-white p-8 rounded-[3rem] border shadow-sm">
              <p className="text-slate-500 font-bold mb-4">{sessionItems.length}問中 {score}問正解</p>
              <div className="grid grid-cols-2 gap-4">
                <Button className="py-4" onClick={() => setView('home')}>ホームへ戻る</Button>
                <Button variant="secondary" className="py-4" onClick={() => { setCurrentQIndex(0); setScore(0); setSelectedOption(null); setShowResult(false); setView('play'); }}>もう一度解く</Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
