
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { QuizItem, QuizLevel, GeneratorConfig } from './types';
import { generateQuizBatch } from './geminiService';
import { parseCSV, toCSV, downloadCSV, downloadJson, isDuplicate, shuffleArray, generateId } from './utils';
import { PRESET_QUIZ_DATA } from './presets';

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost' }> = ({ 
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
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

export default function App() {
  const [dbItems, setDbItems] = useState<QuizItem[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_user_api_key') || '');
  const [view, setView] = useState<'home' | 'play' | 'manage' | 'settings' | 'result'>('home');
  const [studyCount, setStudyCount] = useState(10);
  const [sessionItems, setSessionItems] = useState<QuizItem[]>([]);
  
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizResults, setQuizResults] = useState<{item: QuizItem, selected: number, isCorrect: boolean}[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [remoteUrl, setRemoteUrl] = useState(() => localStorage.getItem('wh_remote_url') || './questions.json');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初期化時に保存データを読み込み。データが空ならリモートから取得
  useEffect(() => {
    const initData = async () => {
      const saved = localStorage.getItem('wh_quiz_data');
      let currentItems: QuizItem[] = saved ? JSON.parse(saved) : [];

      if (currentItems.length === 0) {
        // 初回起動時や全削除後はリモートから読み込み
        await handleFetchRemoteJson(remoteUrl, true);
      } else {
        setDbItems(currentItems);
        setIsInitializing(false);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      localStorage.setItem('wh_quiz_data', JSON.stringify(dbItems));
      localStorage.setItem('wh_remote_url', remoteUrl);
    }
  }, [dbItems, remoteUrl, isInitializing]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return dbItems;
    const q = searchQuery.toLowerCase();
    return dbItems.filter(item => 
      item.question.toLowerCase().includes(q) || 
      item.explanation.toLowerCase().includes(q)
    );
  }, [dbItems, searchQuery]);

  const handleFetchRemoteJson = async (url: string = remoteUrl, isInitial: boolean = false) => {
    if (!url.trim()) return;
    setIsSyncing(true);
    try {
      // キャッシュを避けるためにタイムスタンプを付与
      const cacheBuster = `?t=${new Date().getTime()}`;
      const res = await fetch(url + (url.includes('?') ? '&' : '') + cacheBuster);
      if (!res.ok) throw new Error();
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const formatted = data.map(i => ({...i, id: i.id || generateId()}));
        
        if (isInitial) {
          setDbItems(formatted);
        } else {
          // 重複していないものだけ追加するか、あるいは完全に置き換えるか選択可能にする
          if (confirm(`最新のデータから${formatted.length}問見つかりました。現在のリストに統合しますか？\n（「キャンセル」で現在のリストを破棄して最新版に完全入れ替えします）`)) {
            const unique = formatted.filter(n => !isDuplicate(n.question, dbItems));
            setDbItems(prev => [...prev, ...unique]);
            alert(`${unique.length}問の新規問題を追加しました。`);
          } else {
            setDbItems(formatted);
            alert(`最新の${formatted.length}問に更新しました。`);
          }
        }
      }
    } catch (e) {
      console.error(e);
      if (isInitial) setDbItems(PRESET_QUIZ_DATA);
      else alert('データの同期に失敗しました。URLを確認してください。');
    } finally {
      setIsSyncing(false);
      setIsInitializing(false);
    }
  };

  const processCsvText = (text: string) => {
    const parsed = parseCSV(text);
    if (parsed.length === 0) {
      alert("CSV形式が正しくありません。");
      return;
    }
    const unique = parsed.filter(n => !isDuplicate(n.question, dbItems));
    setDbItems(prev => [...prev, ...unique]);
    alert(`${unique.length}問を追加しました。`);
  };

  const handleBulkImport = () => {
    if (!bulkInput.trim()) return;
    processCsvText(bulkInput);
    setBulkInput('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) processCsvText(text);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const startLibraryStudy = (level: QuizLevel) => {
    const levelItems = dbItems.filter(i => i.level === level);
    if (levelItems.length === 0) {
      alert("このレベルの問題がありません。");
      return;
    }
    const shuffled = shuffleArray(levelItems);
    setSessionItems(shuffled.slice(0, studyCount));
    setCurrentQIndex(0);
    setScore(0);
    setQuizResults([]);
    setSelectedOption(null);
    setShowResult(false);
    setView('play');
  };

  const handleAnswer = (idx: number) => {
    if (showResult) return;
    setSelectedOption(idx);
    setShowResult(true);
    const item = sessionItems[currentQIndex];
    const isCorrect = idx === item.correct_idx;
    if (isCorrect) setScore(s => s + 1);
    setQuizResults(prev => [...prev, { item, selected: idx, isCorrect }]);
  };

  const nextQuestion = () => {
    if (currentQIndex < sessionItems.length - 1) {
      setCurrentQIndex(c => c + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      setView('result');
    }
  };

  if (isInitializing) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-xs font-bold text-slate-400">Loading library...</p>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="max-w-4xl mx-auto space-y-12 py-10 px-4 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black text-slate-800 tracking-tight">世界遺産検定 <span className="text-blue-600">Master</span></h1>
        <p className="text-slate-400 font-medium">合計 {dbItems.length} 問のライブラリ</p>
      </div>

      <div className="flex justify-center">
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex gap-1">
          {[10, 20, 30, 50, 100].map(c => (
            <button key={c} onClick={() => setStudyCount(c)} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${studyCount === c ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>{c}問</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.values(QuizLevel).map((level) => {
          const count = dbItems.filter(i => i.level === level).length;
          return (
            <div key={level} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 hover:shadow-xl transition-all">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-3xl font-black text-slate-800">{level}</h3>
                  <p className="text-xs font-bold text-blue-500 mt-1 uppercase tracking-widest">Available Items</p>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-black text-slate-700">{count}</span>
                  <span className="text-sm font-bold text-slate-400 ml-1">問</span>
                </div>
              </div>
              <Button className="w-full py-4 text-lg rounded-2xl" onClick={() => startLibraryStudy(level as QuizLevel)} disabled={count === 0}>学習を開始</Button>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-4 pt-10 border-t border-slate-200">
        <Button variant="outline" onClick={() => setView('manage')}>📂 データ管理</Button>
        <Button variant="ghost" onClick={() => setView('settings')}>⚙️ 設定</Button>
      </div>
    </div>
  );

  const renderManage = () => (
    <div className="max-w-4xl mx-auto space-y-8 py-10 px-4 animate-fade-in-up">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        {isSyncing && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10 font-bold">同期中...</div>}
        <h2 className="text-2xl font-black mb-6">🌐 GitHub / 外部データ同期</h2>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          GitHubにアップロードした JSON が反映されない場合は、下の「最新状態に更新」ボタンを押してください。<br/>
          ブラウザのキャッシュを無視して、最新のファイルを強制的に取得します。
        </p>
        <div className="flex flex-col gap-3">
          <input type="text" placeholder="questions.json のURL" value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-xs font-mono" />
          <Button variant="primary" className="w-full py-4" onClick={() => handleFetchRemoteJson(remoteUrl)} disabled={isSyncing}>
            {isSyncing ? '取得中...' : '最新状態に更新 (強制同期)'}
          </Button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-black mb-2">📥 データの直接追加</h2>
        <p className="text-xs text-slate-500 mb-6">CSVファイルやテキストから新しい問題を即座に追加できます。</p>
        <div className="space-y-4">
          <Button variant="outline" className="w-full py-4" onClick={() => fileInputRef.current?.click()}>CSVファイルを選択して読み込む</Button>
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <textarea className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-[10px] outline-none focus:border-blue-400" placeholder="レベル,問題文,選択肢1... (CSV形式テキストを貼り付け)" value={bulkInput} onChange={e => setBulkInput(e.target.value)} />
          <Button variant="secondary" className="w-full" onClick={handleBulkImport} disabled={!bulkInput.trim()}>テキストから読み込む</Button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black">全データ ({dbItems.length} 問)</h2>
          <input type="text" placeholder="検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400" />
        </div>
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 mb-8 text-xs">
          {filteredItems.length === 0 ? <p className="py-10 text-center text-slate-300">データがありません</p> : filteredItems.slice(0, 100).map(item => (
            <div key={item.id} className="py-2 flex justify-between items-center group">
              <span className="flex-1 line-clamp-1">{item.question}</span>
              <button onClick={() => setDbItems(prev => prev.filter(i => i.id !== item.id))} className="text-red-400 px-2 opacity-0 group-hover:opacity-100">削除</button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 border-t pt-6">
          <Button variant="success" onClick={() => downloadJson(dbItems, 'questions.json')}>📥 JSONを保存 (バックアップ)</Button>
          <Button variant="danger" onClick={() => confirm('全てのデータを消去しますか？') && setDbItems([])}>全データ消去</Button>
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
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="bg-slate-800 text-white px-4 py-1 rounded-full text-[10px] font-black">{q.level}</span>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-4xl font-black">{currentQIndex + 1}</span>
              <span className="text-slate-300">/ {sessionItems.length}</span>
            </div>
          </div>
          <p className="text-sm font-bold text-emerald-600">正解: {score}</p>
        </div>
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 mb-8 relative">
          {q.is_japan && <div className="absolute top-0 right-0 bg-red-50 text-red-500 px-6 py-2 rounded-bl-3xl text-[10px] font-black tracking-widest">JAPAN</div>}
          <h2 className="text-2xl font-bold leading-relaxed">{q.question}</h2>
        </div>
        <div className="grid gap-4">
          {opts.map((opt, i) => (
            <button key={i} onClick={() => handleAnswer(i)} disabled={showResult} className={`p-6 text-left rounded-3xl border-2 font-bold transition-all ${showResult ? (i === q.correct_idx ? 'bg-emerald-50 border-emerald-500 text-emerald-800 scale-[1.02]' : (i === selectedOption ? 'bg-red-50 border-red-500 text-red-800' : 'opacity-40 border-slate-100')) : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-lg active:scale-95'}`}>
              {opt}
            </button>
          ))}
        </div>
        {showResult && (
          <div className="mt-8 animate-fade-in-up">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-lg mb-6 border border-slate-100">
              <p className="text-slate-600 mb-4 font-medium leading-relaxed">{q.explanation}</p>
              <div className="bg-slate-50 p-4 rounded-2xl text-xs text-slate-500 leading-relaxed mb-4">{q.advanced_explanation}</div>
              <Button className="w-full py-4 text-lg" onClick={nextQuestion}>{currentQIndex === sessionItems.length - 1 ? '結果発表' : '次へ進む'}</Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResult = () => (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center animate-fade-in">
      <div className="mb-12">
        <h2 className="text-7xl font-black text-slate-800 mb-4">{score} <span className="text-2xl text-slate-400">/ {sessionItems.length}</span></h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest">Result Summary</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Button variant="primary" className="py-4" onClick={() => startLibraryStudy(sessionItems[0].level as QuizLevel)}>もう一度解く</Button>
        <Button variant="secondary" className="py-4" onClick={() => setView('home')}>ホームへ</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t h-16 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:border-b">
        <button onClick={() => setView('home')} className={`font-bold text-xs flex flex-col items-center gap-1 ${view === 'home' ? 'text-blue-600' : 'text-slate-400'}`}><span>🏠</span><span>ホーム</span></button>
        <button onClick={() => setView('manage')} className={`font-bold text-xs flex flex-col items-center gap-1 ${view === 'manage' ? 'text-blue-600' : 'text-slate-400'}`}><span>📂</span><span>データ</span></button>
        <button onClick={() => setView('settings')} className={`font-bold text-xs flex flex-col items-center gap-1 ${view === 'settings' ? 'text-blue-600' : 'text-slate-400'}`}><span>⚙️</span><span>設定</span></button>
      </nav>
      <main className="pt-6 pb-24 md:pt-24">{view === 'home' && renderHome()}{view === 'play' && renderPlay()}{view === 'manage' && renderManage()}{view === 'result' && renderResult()}{view === 'settings' && <div className="max-w-xl mx-auto py-10 px-4"><div className="bg-white p-8 rounded-[2rem] border shadow-sm"><h2 className="text-xl font-black mb-6">設定</h2><label className="text-xs font-bold text-slate-400 mb-2 block">Gemini APIキー</label><input type="password" value={apiKey} onChange={e => {setApiKey(e.target.value); localStorage.setItem('gemini_user_api_key', e.target.value);}} className="w-full p-3 bg-slate-50 border rounded-xl mb-6 outline-none focus:border-blue-400" /><Button className="w-full" onClick={() => setView('home')}>完了</Button></div></div>}</main>
    </div>
  );
}
