import React, { useState, useRef, useEffect } from 'react';
import { QuizItem, QuizLevel, GeneratorConfig } from './types';
import { generateQuizBatch } from './geminiService';
import { parseCSV, toCSV, downloadCSV, isDuplicate, shuffleArray } from './utils';
import { PRESET_QUIZ_DATA } from './presets';

// --- Constants ---
const LEVEL_TARGETS: Record<string, number> = {
  [QuizLevel.LEVEL_3]: 300,
  [QuizLevel.LEVEL_2]: 600,
  [QuizLevel.LEVEL_PRE_1]: 1000,
  [QuizLevel.LEVEL_1]: 1000,
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost' }> = ({ 
  children, variant = 'primary', className = '', ...props 
}) => {
  const base = "px-4 py-3 rounded-xl font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-sm flex items-center justify-center gap-2";
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
  const [dbItems, setDbItems] = useState<QuizItem[]>(() => {
    const saved = localStorage.getItem('wh_quiz_data');
    return saved ? JSON.parse(saved) : PRESET_QUIZ_DATA;
  });

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_user_api_key') || '');
  const [tempKeyInput, setTempKeyInput] = useState('');
  const [sessionItems, setSessionItems] = useState<QuizItem[]>([]);
  const [view, setView] = useState<'home' | 'play' | 'manage' | 'settings'>('home');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingLevel, setLoadingLevel] = useState<QuizLevel | null>(null);
  const [studyCount, setStudyCount] = useState(10);
  const stopAutoRef = useRef(false);
  const [autoProgress, setAutoProgress] = useState<{ level: QuizLevel, current: number, target: number, status: string } | null>(null);

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    localStorage.setItem('wh_quiz_data', JSON.stringify(dbItems));
  }, [dbItems]);

  const handleSaveApiKey = () => {
    setApiKey(tempKeyInput.trim());
    localStorage.setItem('gemini_user_api_key', tempKeyInput.trim());
    alert("APIキーを保存しました");
    setView('home');
  };

  const handleRestorePresets = () => {
    if (confirm('ライブラリをプリセットデータ（初期状態）に戻しますか？\n現在保存されている追加問題は消去されます。')) {
      setDbItems(PRESET_QUIZ_DATA);
      alert('プリセットデータを読み込みました。');
    }
  };

  const handleAutoGenerate = async (level: QuizLevel) => {
    if (isGenerating || !apiKey) {
      if (!apiKey) {
        alert("AIによる生成には設定画面からGemini APIキーの入力が必要です。");
        setView('settings');
      }
      return;
    }
    const target = LEVEL_TARGETS[level];
    let localDb = [...dbItems];
    let currentCount = localDb.filter(i => i.level === level).length;

    if (!window.confirm(`AIで新しい問題を生成し、ライブラリに追加します。\n1日のリクエスト制限(20回)に注意してください。`)) return;

    setIsGenerating(true);
    setLoadingLevel(level);
    stopAutoRef.current = false;
    setAutoProgress({ level, current: currentCount, target, status: '準備中...' });

    try {
      while (currentCount < target && !stopAutoRef.current) {
        setAutoProgress(prev => prev ? { ...prev, status: 'AIが執筆中 (5問)...' } : null);
        try {
          const newItems = await generateQuizBatch({ level, count: 5 }, apiKey);
          const uniqueItems = newItems.filter(newItem => !isDuplicate(newItem.question, localDb));
          localDb = [...localDb, ...uniqueItems];
          currentCount = localDb.filter(i => i.level === level).length;
          setDbItems(localDb);

          if (currentCount >= target || stopAutoRef.current) break;

          for(let i=12; i>0; i--) {
            if (stopAutoRef.current) break;
            setAutoProgress(prev => prev ? { ...prev, current: currentCount, status: `API制限回避のため待機中 (${i}秒)...` } : null);
            await sleep(1000);
          }
        } catch (err: any) {
          if (err.message?.includes('429')) {
            alert("1日の制限(RPD 20回)に達した可能性があります。本日の生成を終了します。");
            break;
          }
          await sleep(5000);
        }
      }
    } finally {
      setIsGenerating(false);
      setLoadingLevel(null);
      setAutoProgress(null);
    }
  };

  const startLibraryStudy = (level: QuizLevel) => {
    const levelItems = dbItems.filter(i => i.level === level);
    if (levelItems.length === 0) {
      alert("ライブラリに問題がありません。まずはAIで生成するかCSVを取り込んでください。");
      return;
    }
    const shuffled = shuffleArray(levelItems);
    setSessionItems(shuffled.slice(0, studyCount));
    setCurrentQIndex(0);
    setScore(0);
    setSelectedOption(null);
    setShowResult(false);
    setView('play');
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const parsed = parseCSV(text);
        if (confirm(`${parsed.length}問をライブラリに追加しますか？`)) {
           const unique = parsed.filter(n => !isDuplicate(n.question, dbItems));
           setDbItems(prev => [...prev, ...unique]);
        }
      };
      reader.readAsText(file);
    }
  };

  const renderHome = () => (
    <div className="flex flex-col items-center space-y-10 animate-fade-in px-4 pb-20">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight">世界遺産検定 <span className="text-blue-600">AI</span></h1>
        <p className="text-slate-500 max-w-md mx-auto">AIで問題ライブラリを構築し、いつでも学習できるパーソナル問題集アプリです。</p>
      </div>

      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex gap-1">
        {[10, 20, 30, 50].map(c => (
          <button 
            key={c} 
            onClick={() => setStudyCount(c)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${studyCount === c ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            {c}問
          </button>
        ))}
        <div className="px-3 flex items-center text-xs font-bold text-slate-400 border-l ml-1">学習セット数</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {Object.values(QuizLevel).map((level) => {
          const count = dbItems.filter(i => i.level === level).length;
          const target = LEVEL_TARGETS[level];
          const isLoading = isGenerating && loadingLevel === level;
          
          return (
            <div key={level} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 transition-all hover:shadow-md relative overflow-hidden">
              {isLoading && (
                <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                  <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
                  <p className="text-sm font-bold text-blue-600 mb-1">{autoProgress?.status}</p>
                  <p className="text-2xl font-black text-slate-800">{autoProgress?.current} / {target}</p>
                  <button onClick={() => stopAutoRef.current = true} className="mt-6 text-xs text-red-500 font-bold hover:underline">生成を中断する</button>
                </div>
              )}
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-800">{level}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Library Status</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-slate-700">{count}</span>
                  <span className="text-xs font-bold text-slate-400 ml-1">/ {target}問</span>
                </div>
              </div>

              <div className="w-full bg-slate-100 h-3 rounded-full mb-8 overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min(100, (count / target) * 100)}%` }} />
              </div>

              <div className="space-y-3">
                <Button className="w-full py-4 text-lg shadow-blue-100" onClick={() => startLibraryStudy(level as QuizLevel)} disabled={count === 0}>
                  📚 学習を開始する
                </Button>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => handleAutoGenerate(level as QuizLevel)} 
                    disabled={isGenerating}
                    className="flex items-center justify-center gap-2 text-sm font-bold text-blue-600 hover:bg-blue-50 py-3 rounded-xl transition-colors border border-transparent hover:border-blue-100"
                  >
                    <span>✨ AIで新しい問題を増やす</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4">
        <Button variant="ghost" onClick={() => setView('manage')}>📂 データ管理・取り込み</Button>
      </div>
    </div>
  );

  const renderManage = () => (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-200 animate-fade-in-up">
      <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
        <span className="bg-emerald-100 p-2 rounded-xl text-xl">📂</span>
        データライブラリ管理
      </h2>
      
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-4">
          {Object.values(QuizLevel).map(lvl => (
            <div key={lvl} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-xs font-bold text-slate-400 block mb-1 uppercase tracking-tighter">{lvl}</span>
              <span className="text-2xl font-black text-slate-700">{dbItems.filter(i => i.level === lvl).length}問</span>
            </div>
          ))}
        </div>

        <div className="border-t pt-8 space-y-6">
          <section>
            <h3 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">プリセット管理</h3>
            <Button variant="outline" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50" onClick={handleRestorePresets}>
              📦 パッケージ内データを同期する
            </Button>
            <p className="text-[10px] text-slate-400 mt-2 text-center">※アプリに組み込まれた基本データをライブラリに反映します</p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">外部データ取り込み</h3>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors group">
              <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
              <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">📥</span>
              <span className="text-sm font-bold text-slate-600">CSVファイルをインポート</span>
            </label>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" className="w-full" onClick={() => downloadCSV(toCSV(dbItems), `world_heritage_library_${new Date().toISOString().slice(0,10)}.csv`)}>
              📤 ライブラリを保存(CSV)
            </Button>
            <Button variant="danger" className="w-full" onClick={() => confirm('全てのライブラリデータを削除しますか？') && setDbItems([])}>
              🗑 ライブラリ全削除
            </Button>
          </section>
        </div>

        <Button variant="secondary" className="w-full" onClick={() => setView('home')}>ホームに戻る</Button>
      </div>
    </div>
  );

  const renderPlay = () => {
    const question = sessionItems[currentQIndex];
    if (!question) return null;
    const options = [question.option1, question.option2, question.option3, question.option4];
    
    return (
      <div className="max-w-2xl mx-auto animate-fade-in pb-20">
        <div className="flex justify-between items-center mb-6">
          <span className="bg-slate-800 text-white px-4 py-1.5 rounded-full text-xs font-bold">{question.level}</span>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Progress</p>
            <p className="text-2xl font-black text-slate-800 font-mono">{currentQIndex + 1} / {sessionItems.length}</p>
          </div>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-xl shadow-slate-200/50 mb-8 relative border border-slate-100">
          {question.is_japan && (
            <div className="absolute top-0 right-0 bg-red-50 text-red-600 px-5 py-2 rounded-bl-2xl text-[10px] font-black uppercase tracking-[0.2em]">
              🇯🇵 Japan Heritage
            </div>
          )}
          <h2 className="text-xl md:text-2xl font-bold leading-relaxed text-slate-800">{question.question}</h2>
        </div>

        <div className="grid gap-3 mb-8">
          {options.map((opt, i) => (
            <button 
              key={i} 
              onClick={() => { if(!showResult) { setSelectedOption(i); setShowResult(true); if(i === question.correct_idx) setScore(s => s+1); } }} 
              className={`p-5 text-left rounded-2xl border-2 transition-all font-bold flex items-center gap-4 ${
                showResult 
                  ? (i === question.correct_idx ? 'bg-emerald-50 border-emerald-500 text-emerald-900 scale-[1.02]' : (i === selectedOption ? 'bg-red-50 border-red-500 text-red-900' : 'opacity-40 border-slate-100')) 
                  : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50 shadow-sm active:scale-95'
              }`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${showResult && i === question.correct_idx ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
              <span className="flex-1">{opt}</span>
            </button>
          ))}
        </div>

        {showResult && (
          <div className="bg-white p-8 rounded-3xl border-l-8 border-blue-600 shadow-xl mb-8 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
               <span className="text-3xl">{selectedOption === question.correct_idx ? '✅' : '❌'}</span>
               <h3 className={`text-xl font-black ${selectedOption === question.correct_idx ? 'text-emerald-600' : 'text-red-600'}`}>
                 {selectedOption === question.correct_idx ? '正解です！' : '正解は ' + (question.correct_idx + 1)}
               </h3>
            </div>
            <div className="space-y-4">
              <p className="text-slate-700 leading-relaxed font-medium">{question.explanation}</p>
              <div className="bg-blue-50 p-4 rounded-xl">
                 <p className="text-xs font-black text-blue-600 mb-1 uppercase tracking-wider">Trivia</p>
                 <p className="text-sm text-blue-800">{question.advanced_explanation}</p>
              </div>
              <div className="flex justify-end pt-2">
                <a href={question.wiki_link} target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-1">
                  詳しく見る (Wikipedia) ↗
                </a>
              </div>
            </div>
            <Button className="mt-8 w-full py-4 text-xl" onClick={() => { 
              if(currentQIndex < sessionItems.length - 1) { 
                setCurrentQIndex(c => c+1); setShowResult(false); setSelectedOption(null); 
              } else { 
                alert(`学習完了！\n今回のスコア: ${score} / ${sessionItems.length}`); 
                setView('home'); 
              } 
            }}>
              {currentQIndex < sessionItems.length - 1 ? '次の問題へ 👉' : 'ホームに戻る 🏆'}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 font-sans">
      <div className="max-w-5xl mx-auto px-4">
        <header className="mb-14 flex justify-between items-center">
          <button onClick={() => setView('home')} className="flex items-center gap-3 group">
            <span className="text-3xl bg-white w-12 h-12 flex items-center justify-center rounded-2xl shadow-sm border border-slate-100 group-hover:rotate-12 transition-transform">🏛</span>
            <span className="text-xl font-black text-slate-800 tracking-tighter">WH Master</span>
          </button>
          <div className="flex gap-2">
            <button onClick={() => setView('settings')} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors">⚙️</button>
          </div>
        </header>

        <main>
          {view === 'home' && renderHome()}
          {view === 'play' && renderPlay()}
          {view === 'manage' && renderManage()}
          {view === 'settings' && (
            <div className="max-w-md mx-auto bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h2 className="text-2xl font-black mb-6 text-slate-800">APIキー設定</h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">AIによる問題作成にはGemini APIキーが必要です。入力されたキーはブラウザのローカルストレージにのみ保存されます。</p>
              <input type="text" value={tempKeyInput} onChange={e => setTempKeyInput(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl mb-6 font-mono text-sm focus:border-blue-500 outline-none transition-colors" placeholder="AIza..." />
              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleSaveApiKey}>保存して戻る</Button>
                <Button variant="secondary" onClick={() => setView('home')}>キャンセル</Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}