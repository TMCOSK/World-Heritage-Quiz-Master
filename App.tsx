import React, { useState, useRef, useEffect } from 'react';
import { QuizItem, QuizLevel, GeneratorConfig } from './types';
import { generateQuizBatch } from './geminiService';
import { parseCSV, toCSV, downloadCSV, CSV_HEADER, isDuplicate, shuffleArray } from './utils';

// --- Constants ---
const SESSION_QUESTION_COUNT = 10; // Number of questions per quick play session
const MAX_QUESTIONS_PER_LEVEL = 500; // Safety cap to prevent localStorage overflow (approx 2000 total)

// --- Components ---

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost' }> = ({ 
  children, variant = 'primary', className = '', ...props 
}) => {
  const base = "px-4 py-3 rounded-xl font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm touch-manipulation flex items-center justify-center";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-red-200",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200",
    outline: "bg-white text-slate-600 border-2 border-slate-200 hover:border-blue-400 hover:text-blue-600",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100 shadow-none",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

// --- Main App ---

export default function App() {
  // Database: All accumulated questions
  const [dbItems, setDbItems] = useState<QuizItem[]>(() => {
    try {
      const saved = localStorage.getItem('wh_quiz_data');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load data from localStorage", e);
      return [];
    }
  });

  // API Key Management
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('gemini_user_api_key') || '';
  });
  const [tempKeyInput, setTempKeyInput] = useState('');

  // Session: Current 10 questions being played
  const [sessionItems, setSessionItems] = useState<QuizItem[]>([]);
  const [sessionType, setSessionType] = useState<'new' | 'review'>('new');
  
  const [view, setView] = useState<'home' | 'play' | 'manage' | 'settings'>('home');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingLevel, setLoadingLevel] = useState<QuizLevel | null>(null);

  // Play State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);

  // Auto-save DB to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wh_quiz_data', JSON.stringify(dbItems));
    } catch (e) {
      console.error("Failed to save data to localStorage. Storage might be full.", e);
      alert("ブラウザの保存容量がいっぱいです。古いデータを削除してください。");
    }
  }, [dbItems]);

  // Init temp key input when entering settings
  useEffect(() => {
    if (view === 'settings') {
      setTempKeyInput(apiKey);
    }
  }, [view, apiKey]);

  // --- Logic ---

  const handleSaveApiKey = () => {
    const cleanedKey = tempKeyInput.trim();
    if (!cleanedKey) {
      alert("APIキーを入力してください。");
      return;
    }
    setApiKey(cleanedKey);
    localStorage.setItem('gemini_user_api_key', cleanedKey);
    alert("APIキーを保存しました！");
    setView('home');
  };

  // Mode A: Generate New Questions & Play
  const handleGenerateLevel = async (level: QuizLevel) => {
    if (isGenerating) return;

    if (!apiKey) {
      if (window.confirm("問題を作成するにはGemini APIキーが必要です。\n設定画面でキーを入力しますか？")) {
        setView('settings');
      }
      return;
    }

    setIsGenerating(true);
    setLoadingLevel(level);
    setIsConfirmingExit(false);

    try {
      // 1. Generate new questions
      const config: GeneratorConfig = { level, count: SESSION_QUESTION_COUNT };
      // Pass the user's API Key
      const newItems = await generateQuizBatch(config, apiKey);
      
      // 2. Setup Session (We play the NEWLY generated questions)
      setSessionItems(newItems);
      setSessionType('new');
      setScore(0);
      setCurrentQIndex(0);
      setSelectedOption(null);
      setShowResult(false);

      // 3. Accumulate to DB (Background)
      setDbItems(prevDb => {
        const uniqueNewItems = newItems.filter(newItem => !isDuplicate(newItem.question, prevDb));
        const levelItems = prevDb.filter(i => i.level === level);
        const otherItems = prevDb.filter(i => i.level !== level);
        let mergedLevelItems = [...levelItems, ...uniqueNewItems];

        if (mergedLevelItems.length > MAX_QUESTIONS_PER_LEVEL) {
          const removeCount = mergedLevelItems.length - MAX_QUESTIONS_PER_LEVEL;
          mergedLevelItems = mergedLevelItems.slice(removeCount);
        }
        return [...otherItems, ...mergedLevelItems];
      });

      setView('play');

    } catch (e: any) {
      console.error(e);
      let msg = "問題の生成に失敗しました。";
      if (e.message?.includes('API Key')) msg += "\nAPIキーが正しいか確認してください。";
      else if (e.status === 429) msg += "\nリクエストが多すぎます。少し待ってから試してください。";
      alert(msg);
    } finally {
      setIsGenerating(false);
      setLoadingLevel(null);
    }
  };

  // Mode B: Review Past Questions
  const handleReviewLevel = (level: QuizLevel) => {
    const levelItems = dbItems.filter(i => i.level === level);
    
    if (levelItems.length === 0) {
      alert("まだ保存された問題がありません。「AI生成」で問題を作成してください。");
      return;
    }

    setIsConfirmingExit(false);
    
    // Shuffle and pick 10 (or less if not enough)
    const shuffled = shuffleArray(levelItems);
    const selected = shuffled.slice(0, SESSION_QUESTION_COUNT);

    setSessionItems(selected);
    setSessionType('review');
    setScore(0);
    setCurrentQIndex(0);
    setSelectedOption(null);
    setShowResult(false);
    setView('play');
  };

  const handleAnswer = (idx: number) => {
    if (showResult) return;
    setSelectedOption(idx);
    setShowResult(true);
    if (idx === sessionItems[currentQIndex].correct_idx) {
      setScore(s => s + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQIndex < sessionItems.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowResult(false);
      setIsConfirmingExit(false);
    } else {
      // End of quiz session
      alert(`お疲れ様でした！\n今回のスコア: ${score} / ${sessionItems.length}`);
      setView('home');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AI世界遺産検定マスター',
          text: 'AIが生成する問題で世界遺産検定の勉強をしよう！',
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback for desktop browsers that don't support share
      navigator.clipboard.writeText(window.location.href);
      alert('URLをコピーしました！');
    }
  };

  // --- Data Management ---

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const parsed = parseCSV(text);
        
        // eslint-disable-next-line no-restricted-globals
        const shouldMerge = dbItems.length > 0 && confirm("現在のリストに追加しますか？\n（キャンセルを押すと、現在のリストを削除して上書きします）");
        
        if (shouldMerge) {
           const uniqueParsed = parsed.filter(newItem => !isDuplicate(newItem.question, dbItems));
           setDbItems(prev => [...prev, ...uniqueParsed]);
           alert(`${uniqueParsed.length}問を追加しました。（重複除外: ${parsed.length - uniqueParsed.length}件）`);
        } else {
           setDbItems(parsed);
           alert(`${parsed.length}問を読み込みました。`);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExportCSV = () => {
    const csv = toCSV(dbItems);
    downloadCSV(csv, `world_heritage_quiz_master_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // --- Views ---

  const renderHome = () => (
    <div className="flex flex-col items-center min-h-[60vh] space-y-8 animate-fade-in px-4 pb-12">
      <div className="text-center space-y-4 pt-4 md:pt-8">
        <h1 className="text-3xl md:text-5xl font-extrabold text-slate-800 tracking-tight drop-shadow-sm">
          <span className="text-blue-600">AI</span> 世界遺産検定
        </h1>
        <p className="text-slate-500 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
          「AI生成」で新しい問題に挑戦し、ライブラリを充実させましょう。<br/>
          「過去問」で保存済み問題からランダムに復習できます。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {Object.values(QuizLevel).map((level) => {
          const savedCount = dbItems.filter(i => i.level === level).length;
          const isLoadingThis = isGenerating && loadingLevel === level;
          const isOtherLoading = isGenerating && loadingLevel !== level;

          return (
            <div 
              key={level}
              className={`
                relative bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-all duration-300
                ${isOtherLoading ? 'opacity-50 grayscale' : 'hover:shadow-md hover:border-blue-200'}
              `}
            >
              {isLoadingThis && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-2xl z-20">
                   <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   <span className="text-sm font-bold text-blue-600 animate-pulse">生成中...</span>
                 </div>
              )}

              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{level}</h3>
                <div className="text-right">
                  <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">Saved</span>
                  <span className="text-lg font-bold text-slate-600">{savedCount}</span>
                  <span className="text-xs text-slate-400">問</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={() => handleGenerateLevel(level)} 
                  disabled={isGenerating}
                  className="flex flex-col items-center justify-center py-4 text-sm"
                >
                  <span className="text-xl mb-1">🤖</span>
                  <span>AI生成</span>
                </Button>

                <Button 
                  onClick={() => handleReviewLevel(level)} 
                  disabled={isGenerating || savedCount === 0}
                  variant="success"
                  className="flex flex-col items-center justify-center py-4 text-sm"
                >
                  <span className="text-xl mb-1">📚</span>
                  <span>過去問</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4">
        <button 
          onClick={() => setView('manage')}
          className="text-slate-400 hover:text-slate-600 text-sm font-medium flex items-center gap-2 px-6 py-3 rounded-full hover:bg-white transition-colors border border-transparent hover:border-slate-200"
        >
          <span>📂</span> データの管理・書き出し
        </button>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-xl animate-fade-in-up">
       <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-2">
        <span className="text-slate-600">⚙️</span> 設定
      </h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Gemini API キー</label>
          <input 
            type="text" 
            value={tempKeyInput}
            onChange={(e) => setTempKeyInput(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            APIキーはブラウザにのみ保存され、外部に送信されることはありません。<br/>
            まだお持ちでない方は <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 underline">Google AI Studio</a> から無料で取得できます。
          </p>
        </div>

        <div className="flex gap-4 pt-4">
          <Button onClick={() => setView('home')} variant="secondary" className="flex-1">キャンセル</Button>
          <Button onClick={handleSaveApiKey} className="flex-1">保存する</Button>
        </div>
      </div>
    </div>
  );

  const renderManage = () => (
    <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-xl animate-fade-in-up">
       <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-2">
        <span className="text-emerald-600">📂</span> データ管理
      </h2>

      <div className="space-y-8">
        <section className="bg-slate-50 p-5 rounded-xl border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex justify-between items-center">
            <span>ライブラリ状況</span>
            <span className="text-xs font-normal text-slate-500 bg-white px-2 py-1 rounded border">上限: 各級{MAX_QUESTIONS_PER_LEVEL}問</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
             {Object.values(QuizLevel).map(lvl => {
               const count = dbItems.filter(i => i.level === lvl).length;
               const percent = Math.min(100, (count / MAX_QUESTIONS_PER_LEVEL) * 100);
               return (
                 <div key={lvl} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <span className="text-xs text-slate-500 block mb-1">{lvl}</span>
                    <span className="text-xl font-bold block mb-2">{count}問</span>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                 </div>
               );
             })}
          </div>
          <div className="mt-4 flex justify-end">
             {/* eslint-disable-next-line no-restricted-globals */}
             <Button onClick={() => { if(confirm('全てのデータを削除しますか？')) setDbItems([]) }} variant="danger" className="text-xs py-2 px-3">
                全データ削除
             </Button>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h3 className="text-base font-bold text-slate-800 mb-3">CSV インポート</h3>
            <label className="block w-full cursor-pointer bg-white hover:bg-blue-50 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-6 text-center transition-colors touch-manipulation group">
              <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
              <div className="text-3xl mb-2 opacity-50 group-hover:opacity-100">📥</div>
              <span className="text-slate-600 font-bold text-sm">ファイルを選択</span>
            </label>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-3">CSV エクスポート</h3>
            <button 
              onClick={handleExportCSV} 
              disabled={dbItems.length === 0}
              className="block w-full bg-white hover:bg-emerald-50 border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl p-6 text-center transition-colors touch-manipulation group disabled:opacity-50 disabled:cursor-not-allowed"
            >
               <div className="text-3xl mb-2 opacity-50 group-hover:opacity-100">📤</div>
              <span className="text-slate-600 font-bold text-sm">ダウンロード</span>
            </button>
          </section>
        </div>

        <div className="pt-4 text-center">
          <Button onClick={() => setView('home')} variant="secondary" className="w-full md:w-auto min-w-[200px]">ホームに戻る</Button>
        </div>
      </div>
    </div>
  );

  const renderPlay = () => {
    const question = sessionItems[currentQIndex];
    if (!question) return null;
    const options = [question.option1, question.option2, question.option3, question.option4];

    return (
      <div className="max-w-3xl mx-auto w-full animate-fade-in">
        {/* Progress Header */}
        <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-2">
             <span className="bg-slate-800 text-white px-3 py-1 rounded text-sm font-bold">{question.level}</span>
             <span className={`text-xs px-2 py-1 rounded font-bold ${sessionType === 'new' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
               {sessionType === 'new' ? 'New Challenge' : 'Review Mode'}
             </span>
           </div>
           <div className="flex flex-col items-end">
             <span className="text-2xl font-black text-slate-800 font-mono tracking-tighter">
               {currentQIndex + 1}<span className="text-base text-slate-400 font-normal">/{sessionItems.length}</span>
             </span>
           </div>
        </div>

        {/* Question Card */}
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xl shadow-slate-200/50 mb-8 relative overflow-hidden border border-slate-100">
          {question.is_japan && (
            <div className="absolute top-0 right-0 bg-red-50 text-red-600 px-4 py-1.5 rounded-bl-2xl text-xs font-bold tracking-wider">
               🇯🇵 国内遺産
            </div>
          )}
          <h2 className="text-xl md:text-2xl font-bold leading-relaxed text-slate-800 mt-2">
            {question.question}
          </h2>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-8">
          {options.map((opt, idx) => {
            let btnClass = "relative p-4 text-left rounded-xl border-2 transition-all font-medium min-h-[64px] flex items-center touch-manipulation ";
            if (showResult) {
              if (idx === question.correct_idx) {
                btnClass += "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-md transform scale-[1.02] z-10";
              } else if (idx === selectedOption) {
                btnClass += "bg-red-50 border-red-400 text-red-900 opacity-80";
              } else {
                btnClass += "bg-slate-50 border-slate-100 text-slate-400 opacity-40";
              }
            } else {
              btnClass += "bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md active:scale-[0.98]";
            }

            return (
              <button 
                key={idx} 
                onClick={() => handleAnswer(idx)}
                disabled={showResult}
                className={btnClass}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold transition-colors
                  ${showResult && idx === question.correct_idx ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}
                `}>
                  {idx + 1}
                </div>
                <span className="text-sm md:text-base">{opt}</span>
              </button>
            )
          })}
        </div>

        {/* Result & Explanation */}
        {showResult && (
          <div className="bg-white border-l-4 border-blue-500 p-6 md:p-8 rounded-r-xl shadow-lg mb-8 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
              <span className={`text-3xl ${selectedOption === question.correct_idx ? 'text-emerald-500' : 'text-red-500'}`}>
                {selectedOption === question.correct_idx ? '✅' : '❌'}
              </span>
              <div>
                <div className={`text-lg font-bold ${selectedOption === question.correct_idx ? 'text-emerald-600' : 'text-red-600'}`}>
                  {selectedOption === question.correct_idx ? '正解！' : '残念...'}
                </div>
                <div className="text-slate-400 text-xs">正解: {options[question.correct_idx]}</div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">解説</span>
                <p className="text-slate-700 leading-relaxed mt-1 text-sm md:text-base">
                  {question.explanation}
                </p>
              </div>

              {question.advanced_explanation && (
                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600">
                   <span className="text-xs font-bold text-blue-500 uppercase tracking-wider block mb-1">豆知識</span>
                   {question.advanced_explanation}
                </div>
              )}
            </div>

            <div className="mt-4 text-right">
              <a href={question.wiki_link} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 text-xs font-medium inline-flex items-center gap-1">
                Wikipedia ↗
              </a>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between gap-4 pt-4 pb-12 items-center">
           {!isConfirmingExit ? (
             <Button 
               onClick={() => setIsConfirmingExit(true)} 
               variant="outline" 
               className="flex-1 md:flex-none py-3 text-sm border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300"
             >
               中断してホームへ
             </Button>
           ) : (
             <div className="flex-1 md:flex-none flex items-center gap-2 animate-fade-in bg-red-50 p-2 rounded-lg border border-red-100">
                <span className="text-xs text-red-600 font-bold whitespace-nowrap pl-1">本当に中断？</span>
                <Button onClick={() => setView('home')} variant="danger" className="py-2 px-3 text-xs">はい</Button>
                <Button onClick={() => setIsConfirmingExit(false)} variant="secondary" className="py-2 px-3 text-xs">いいえ</Button>
             </div>
           )}

           {showResult && (
             <Button onClick={nextQuestion} className="flex-[2] md:flex-none w-full md:w-48 py-3 text-lg shadow-xl shadow-blue-200/50">
               {currentQIndex < sessionItems.length - 1 ? '次の問題へ 👉' : '結果を見る 🏆'}
             </Button>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 py-6 md:py-10 px-4 pb-20 safe-area-inset-bottom font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 md:mb-12 flex justify-between items-center">
           <button onClick={() => setView('home')} className="text-slate-400 hover:text-slate-600 font-bold flex items-center gap-2 transition-colors">
              <span className="text-2xl">🏛</span> 
              <span className="hidden md:inline font-mono tracking-tight">World Heritage Master</span>
           </button>
           <div className="flex items-center gap-3">
             <button onClick={handleShare} className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-2 rounded-full transition-colors" aria-label="アプリを共有">
                📤
             </button>
             <button onClick={() => setView('settings')} className={`bg-slate-200 hover:bg-slate-300 text-slate-600 p-2 rounded-full transition-colors ${!apiKey && 'animate-pulse ring-2 ring-blue-400'}`} aria-label="設定">
                ⚙️
             </button>
             {view !== 'home' && view !== 'settings' && (
               <div className="hidden sm:block text-xs font-bold text-slate-400 uppercase tracking-widest border border-slate-200 px-3 py-1 rounded-full">
                 {view === 'manage' ? 'Management' : 'Playing'}
               </div>
             )}
           </div>
        </header>

        <main>
          {view === 'home' && renderHome()}
          {view === 'settings' && renderSettings()}
          {view === 'manage' && renderManage()}
          {view === 'play' && renderPlay()}
        </main>
      </div>
    </div>
  );
}