
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
  const [isGenerating, setIsGenerating] = useState(false);
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

  useEffect(() => {
    const initData = async () => {
      const saved = localStorage.getItem('wh_quiz_data');
      let currentItems: QuizItem[] = saved ? JSON.parse(saved) : [];

      if (currentItems.length === 0) {
        try {
          const response = await fetch(remoteUrl);
          if (response.ok) {
            const remoteData = await response.json();
            if (Array.isArray(remoteData)) {
              currentItems = remoteData.map(i => ({...i, id: i.id || generateId()}));
            }
          }
        } catch (e) {
          currentItems = PRESET_QUIZ_DATA;
        }
      }

      setDbItems(currentItems);
      setIsInitializing(false);
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

  const handleFetchRemoteJson = async (url: string = remoteUrl) => {
    if (!url.trim()) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (Array.isArray(data)) {
        const unique = data.filter(n => !isDuplicate(n.question, dbItems)).map(i => ({...i, id: i.id || generateId()}));
        setDbItems(prev => [...prev, ...unique]);
        alert(`${unique.length}問を新しく同期しました。`);
      }
    } catch (e) {
      alert('同期に失敗しました。URLが正しいこと（GitHubの場合はRaw URLであること）を確認してください。');
    }
  };

  const processCsvText = (text: string) => {
    const parsed = parseCSV(text);
    if (parsed.length === 0) {
      alert("CSV形式が正しくありません。ヘッダー（level,question...）を確認してください。");
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
      if (text) {
        processCsvText(text);
      }
      // Reset input
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
      <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
    </div>
  );

  const renderHome = () => (
    <div className="max-w-4xl mx-auto space-y-12 py-10 px-4 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black text-slate-800 tracking-tight">世界遺産検定 <span className="text-blue-600">Master</span></h1>
        <p className="text-slate-400 font-medium">問題管理・学習プラットフォーム</p>
      </div>

      <div className="flex justify-center">
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex gap-1">
          {[10, 20, 30, 50].map(c => (
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
                  <p className="text-xs font-bold text-blue-500 mt-1 uppercase tracking-widest">Questions</p>
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
      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-black mb-2 flex items-center gap-2">📥 300問一括インポート</h2>
        <p className="text-xs text-slate-500 mb-6">
          CSVファイルを選択するか、Excel等からコピーしたデータを貼り付けてください。
        </p>
        
        <div className="space-y-6">
          <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3">
            <span className="text-3xl">📄</span>
            <p className="text-sm font-bold text-slate-600">CSVファイルを直接読み込む</p>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
            />
            <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
              ファイルを選択
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-slate-400 font-bold tracking-widest">OR Paste Text</span></div>
          </div>

          <div>
            <textarea 
              className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-[10px] mb-3 outline-none focus:border-blue-400"
              placeholder="3級,問題文,選択肢1,選択肢2,選択肢3,選択肢4,0,解説文,詳細文,http://...,TRUE"
              value={bulkInput}
              onChange={e => setBulkInput(e.target.value)}
            />
            <Button variant="secondary" className="w-full" onClick={handleBulkImport} disabled={!bulkInput.trim()}>
              テキストから追加
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-black mb-6">🌐 GitHub同期</h2>
        <div className="flex gap-3">
          <input type="text" placeholder="GitHub Raw URL" value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-xs font-mono" />
          <Button variant="primary" onClick={() => handleFetchRemoteJson()}>同期</Button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black">現在のライブラリ ({dbItems.length})</h2>
          <input type="text" placeholder="検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400" />
        </div>
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 mb-8">
          {filteredItems.slice(0, 100).map(item => (
            <div key={item.id} className="py-2 flex justify-between items-center group text-xs">
              <span className="flex-1 line-clamp-1">{item.question}</span>
              <button onClick={() => setDbItems(prev => prev.filter(i => i.id !== item.id))} className="text-red-400 px-2">削除</button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 border-t pt-6">
          <Button variant="success" onClick={() => downloadJson(dbItems, 'questions.json')}>📥 JSONを保存</Button>
          <Button variant="danger" onClick={() => confirm('全削除しますか？') && setDbItems([])}>全消去</Button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-4">※追加した問題をGitHubに反映するには、ここでJSONを保存してGitHubへアップロードしてください。</p>
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
        </div>
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 mb-8 relative">
          {q.is_japan && <div className="absolute top-0 right-0 bg-red-50 text-red-500 px-6 py-2 rounded-bl-3xl text-[10px] font-black">JAPAN</div>}
          <h2 className="text-2xl font-bold leading-relaxed">{q.question}</h2>
        </div>
        <div className="grid gap-4">
          {opts.map((opt, i) => (
            <button key={i} onClick={() => handleAnswer(i)} disabled={showResult} className={`p-6 text-left rounded-3xl border-2 font-bold transition-all ${showResult ? (i === q.correct_idx ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : (i === selectedOption ? 'bg-red-50 border-red-500 text-red-800' : 'opacity-40')) : 'bg-white border-slate-200 hover:border-blue-400'}`}>
              {opt}
            </button>
          ))}
        </div>
        {showResult && (
          <div className="mt-8 animate-fade-in-up">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-lg mb-6">
              <p className="text-slate-600 mb-4">{q.explanation}</p>
              <Button className="w-full" onClick={nextQuestion}>{currentQIndex === sessionItems.length - 1 ? '結果を見る' : '次へ'}</Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResult = () => (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center animate-fade-in">
      <h2 className="text-6xl font-black mb-4">{score} <span className="text-2xl text-slate-400">/ {sessionItems.length}</span></h2>
      <div className="grid grid-cols-2 gap-4 mt-12">
        <Button variant="primary" onClick={() => startLibraryStudy(sessionItems[0].level as QuizLevel)}>もう一度</Button>
        <Button variant="secondary" onClick={() => setView('home')}>ホーム</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t h-16 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:border-b">
        <button onClick={() => setView('home')} className={`font-bold text-xs ${view === 'home' ? 'text-blue-600' : 'text-slate-400'}`}>🏠 ホーム</button>
        <button onClick={() => setView('manage')} className={`font-bold text-xs ${view === 'manage' ? 'text-blue-600' : 'text-slate-400'}`}>📂 データ</button>
        <button onClick={() => setView('settings')} className={`font-bold text-xs ${view === 'settings' ? 'text-blue-600' : 'text-slate-400'}`}>⚙️ 設定</button>
      </nav>
      <main className="pt-6 pb-24 md:pt-24">{view === 'home' && renderHome()}{view === 'play' && renderPlay()}{view === 'manage' && renderManage()}{view === 'result' && renderResult()}{view === 'settings' && <div className="max-w-xl mx-auto py-10 px-4"><div className="bg-white p-8 rounded-[2rem] border shadow-sm"><h2>設定</h2><Button onClick={() => setView('home')}>完了</Button></div></div>}</main>
    </div>
  );
}
