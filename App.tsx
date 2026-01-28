
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { QuizItem, QuizLevel, GeneratorConfig } from './types';
import { generateQuizBatch } from './geminiService';
import { parseCSV, toCSV, downloadCSV, isDuplicate, shuffleArray, generateId } from './utils';
import { PRESET_QUIZ_DATA } from './presets';

const LEVEL_TARGETS: Record<string, number> = {
  [QuizLevel.LEVEL_3]: 300,
  [QuizLevel.LEVEL_2]: 600,
  [QuizLevel.LEVEL_PRE_1]: 1000,
  [QuizLevel.LEVEL_1]: 1000,
};

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
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_user_api_key') || '');
  const [view, setView] = useState<'home' | 'play' | 'manage' | 'settings' | 'result'>('home');
  const [studyCount, setStudyCount] = useState(10);
  const [sessionItems, setSessionItems] = useState<QuizItem[]>([]);
  
  // States for Quiz Play
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizResults, setQuizResults] = useState<{item: QuizItem, selected: number, isCorrect: boolean}[]>([]);

  // States for Data Management
  const [bulkInput, setBulkInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('./questions.json'); // デフォルトで自身のJSONを指す

  // 1. 初期ロード (LocalStorage -> questions.json -> Presets)
  useEffect(() => {
    const initData = async () => {
      // a. ローカルストレージをチェック
      const saved = localStorage.getItem('wh_quiz_data');
      let currentItems: QuizItem[] = saved ? JSON.parse(saved) : [];

      // b. ストレージが空、あるいは更新チェックとして 'questions.json' を試行
      try {
        const response = await fetch('./questions.json');
        if (response.ok) {
          const remoteData = await response.json();
          if (Array.isArray(remoteData)) {
            // 重複していないものだけ追加
            const newItems = remoteData.filter(n => !currentItems.some(c => c.question === n.question));
            currentItems = [...currentItems, ...newItems.map(i => ({...i, id: i.id || generateId()}))];
            console.log(`Loaded ${newItems.length} new items from questions.json`);
          }
        }
      } catch (e) {
        console.log("No local questions.json found or fetch failed, using presets.");
      }

      // c. まだ空ならプリセットを流し込む
      if (currentItems.length === 0) {
        currentItems = PRESET_QUIZ_DATA;
      }

      setDbItems(currentItems);
      setIsInitializing(false);
    };
    initData();
  }, []);

  // 2. 保存
  useEffect(() => {
    if (!isInitializing) {
      localStorage.setItem('wh_quiz_data', JSON.stringify(dbItems));
    }
  }, [dbItems, isInitializing]);

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
      const data = await res.json();
      if (Array.isArray(data)) {
        const unique = data.filter(n => !isDuplicate(n.question, dbItems)).map(i => ({...i, id: i.id || generateId()}));
        setDbItems(prev => [...prev, ...unique]);
        alert(`${unique.length}問を新しくインポートしました。`);
      }
    } catch (e) {
      alert('データの同期に失敗しました。パスや形式を確認してください。');
    }
  };

  const handleBulkImport = () => {
    if (!bulkInput.trim()) return;
    const parsed = parseCSV(bulkInput);
    if (parsed.length === 0) {
      alert("CSV形式が正しくありません。");
      return;
    }
    const unique = parsed.filter(n => !isDuplicate(n.question, dbItems));
    setDbItems(prev => [...prev, ...unique]);
    setBulkInput('');
    alert(`${unique.length}問を追加しました。`);
  };

  const startLibraryStudy = (level: QuizLevel) => {
    const levelItems = dbItems.filter(i => i.level === level);
    if (levelItems.length === 0) {
      alert("このレベルの問題がありません。管理画面から同期してください。");
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
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold">ライブラリを最適化中...</p>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="max-w-4xl mx-auto space-y-12 py-10 px-4 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black text-slate-800 tracking-tight">世界遺産検定 <span className="text-blue-600">Master</span></h1>
        <p className="text-slate-400 font-medium">外部JSON同期システム搭載・学習ライブラリ</p>
      </div>

      <div className="flex justify-center">
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex gap-1">
          {[10, 20, 30, 50].map(c => (
            <button 
              key={c} 
              onClick={() => setStudyCount(c)}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${studyCount === c ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {c}問
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.values(QuizLevel).map((level) => {
          const count = dbItems.filter(i => i.level === level).length;
          return (
            <div key={level} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 hover:shadow-xl transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-3xl font-black text-slate-800">{level}</h3>
                  <p className="text-xs font-bold text-blue-500 mt-1 uppercase tracking-widest">Library Volume</p>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-black text-slate-700">{count}</span>
                  <span className="text-sm font-bold text-slate-400 ml-1">問</span>
                </div>
              </div>
              <Button className="w-full py-5 text-xl rounded-2xl" onClick={() => startLibraryStudy(level as QuizLevel)} disabled={count === 0}>
                学習を開始する
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-6 pt-10 border-t border-slate-200">
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setView('manage')}>📂 データ同期</Button>
          <Button variant="ghost" onClick={() => setView('settings')}>⚙️ 設定</Button>
        </div>
        <p className="text-xs text-slate-400">Current Library: {dbItems.length} questions loaded</p>
      </div>
    </div>
  );

  const renderManage = () => (
    <div className="max-w-4xl mx-auto space-y-8 py-10 px-4 animate-fade-in-up">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-3">🌐 JSONライブラリ同期</h2>
        <div className="space-y-4">
          <div className="flex gap-3">
            <input 
              type="text" 
              placeholder="外部URLまたはパス (./questions.json)" 
              value={remoteUrl}
              onChange={e => setRemoteUrl(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-all"
            />
            <Button variant="primary" onClick={() => handleFetchRemoteJson()}>同期</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
             <Button variant="secondary" onClick={() => handleFetchRemoteJson('./questions.json')}>標準JSONをロード</Button>
             <Button variant="outline" onClick={() => setRemoteUrl('https://raw.githubusercontent.com/username/repo/main/questions.json')}>GitHubから同期例</Button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
          ※ `questions.json` をアプリと同じフォルダに置くと、起動時に自動読み込みされます。<br/>
          ※ 外部URLを指定して、常に最新の問題集を配信することも可能です。
        </p>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black">登録済み問題一覧 ({dbItems.length})</h2>
          <input 
            type="text" 
            placeholder="検索..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
          />
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {filteredItems.slice(0, 100).map(item => (
            <div key={item.id} className="py-3 flex justify-between items-center group">
              <div className="flex-1 pr-4">
                <span className="text-[10px] font-bold text-blue-500 mr-2">{item.level}</span>
                <span className="text-sm text-slate-700 line-clamp-1">{item.question}</span>
              </div>
              <button onClick={() => setDbItems(prev => prev.filter(i => i.id !== item.id))} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2">削除</button>
            </div>
          ))}
          {filteredItems.length === 0 && <p className="py-10 text-center text-slate-400 italic">該当する問題がありません。</p>}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-100">
          <Button variant="outline" onClick={() => downloadCSV(toCSV(dbItems), 'wh_export.csv')}>CSVで保存</Button>
          <Button variant="danger" onClick={() => confirm('全削除しますか？') && setDbItems([])}>全削除</Button>
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
            <span className="bg-slate-800 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{q.level}</span>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-4xl font-black text-slate-800">{currentQIndex + 1}</span>
              <span className="text-slate-300 font-bold">/ {sessionItems.length}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Correct Answers</span>
            <p className="text-2xl font-black text-emerald-500">{score}</p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 mb-8 relative overflow-hidden">
          {q.is_japan && (
            <div className="absolute top-0 right-0 bg-red-50 text-red-500 px-6 py-2 rounded-bl-3xl text-[10px] font-black tracking-widest">JAPAN HERITAGE</div>
          )}
          <h2 className="text-2xl font-bold text-slate-800 leading-relaxed">{q.question}</h2>
        </div>

        <div className="grid gap-4">
          {opts.map((opt, i) => (
            <button 
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={showResult}
              className={`p-6 text-left rounded-3xl border-2 font-bold transition-all flex items-center gap-4 ${
                showResult 
                ? (i === q.correct_idx ? 'bg-emerald-50 border-emerald-500 text-emerald-800 scale-[1.02]' : (i === selectedOption ? 'bg-red-50 border-red-500 text-red-800' : 'opacity-40 border-slate-100'))
                : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-lg active:scale-95'
              }`}
            >
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${showResult && i === q.correct_idx ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>
              <span className="flex-1">{opt}</span>
            </button>
          ))}
        </div>

        {showResult && (
          <div className="mt-8 animate-fade-in-up">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-lg mb-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{selectedOption === q.correct_idx ? '✨' : '🧐'}</span>
                <h3 className={`text-xl font-black ${selectedOption === q.correct_idx ? 'text-emerald-600' : 'text-red-500'}`}>
                  {selectedOption === q.correct_idx ? '正解です！' : '正解は ' + (q.correct_idx + 1) + ' 番でした'}
                </h3>
              </div>
              <p className="text-slate-600 leading-relaxed mb-6">{q.explanation}</p>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Advanced Knowledge</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{q.advanced_explanation}</p>
                {q.wiki_link && (
                  <a href={q.wiki_link} target="_blank" rel="noreferrer" className="inline-block mt-4 text-xs text-blue-500 font-bold hover:underline">Wikipediaで詳しく見る ↗</a>
                )}
              </div>
            </div>
            <Button className="w-full py-5 text-xl" onClick={nextQuestion}>
              {currentQIndex === sessionItems.length - 1 ? '結果を見る' : '次の問題へ'}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderResult = () => (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center animate-fade-in">
      <div className="mb-12">
        <p className="text-xs font-black text-blue-500 uppercase tracking-[0.3em] mb-4">Training Complete</p>
        <h2 className="text-6xl font-black text-slate-800 mb-4">{score} <span className="text-2xl text-slate-400">/ {sessionItems.length}</span></h2>
        <p className="text-slate-400 font-bold">正答率 {Math.round((score/sessionItems.length)*100)}%</p>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 bg-slate-50 border-b border-slate-200 text-left font-bold text-slate-500 text-xs">今回の復習</div>
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {quizResults.map((r, i) => (
            <div key={i} className="p-5 text-left flex gap-4 items-start">
              <span className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${r.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                {r.isCorrect ? '✓' : '×'}
              </span>
              <div>
                <p className="text-sm font-bold text-slate-700 mb-1">{r.item.question}</p>
                <p className="text-[10px] text-slate-400">正解: {r.item[`option${r.item.correct_idx + 1}` as keyof QuizItem]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Button variant="primary" className="py-4" onClick={() => startLibraryStudy(sessionItems[0].level as QuizLevel)}>もう一度挑戦</Button>
        <Button variant="secondary" className="py-4" onClick={() => setView('home')}>ホームへ</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 safe-area-pt safe-area-pb">
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 z-50 md:top-0 md:bottom-auto md:border-t-0 md:border-b">
        <div className="max-w-4xl mx-auto px-6 h-16 flex justify-around md:justify-end md:gap-8 items-center">
          <button onClick={() => setView('home')} className={`flex flex-col md:flex-row items-center gap-1 font-bold text-xs ${view === 'home' ? 'text-blue-600' : 'text-slate-400'}`}>
            <span>🏠</span>
            <span>ホーム</span>
          </button>
          <button onClick={() => setView('manage')} className={`flex flex-col md:flex-row items-center gap-1 font-bold text-xs ${view === 'manage' ? 'text-blue-600' : 'text-slate-400'}`}>
            <span>📂</span>
            <span>データ</span>
          </button>
          <button onClick={() => setView('settings')} className={`flex flex-col md:flex-row items-center gap-1 font-bold text-xs ${view === 'settings' ? 'text-blue-600' : 'text-slate-400'}`}>
            <span>⚙️</span>
            <span>設定</span>
          </button>
        </div>
      </nav>

      <main className="pt-6 pb-24 md:pt-24 md:pb-12">
        {view === 'home' && renderHome()}
        {view === 'play' && renderPlay()}
        {view === 'manage' && renderManage()}
        {view === 'result' && renderResult()}
        {view === 'settings' && (
          <div className="max-w-xl mx-auto py-10 px-4 animate-fade-in-up">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
              <h2 className="text-2xl font-black mb-6">アプリ設定</h2>
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-500">Gemini AI API Key (生成用)</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={e => {
                    const v = e.target.value;
                    setApiKey(v);
                    localStorage.setItem('gemini_user_api_key', v);
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <Button variant="secondary" className="w-full mt-8" onClick={() => setView('home')}>完了</Button>
          </div>
        )}
      </main>
    </div>
  );
}
