
import React, { useState, useEffect, useMemo } from 'react';
import { DEFAULT_QUESTION_TEXT, OPTION_KEYS } from './constants';
import { parseQuestions, extractExamName, generateBackupFilename } from './utils/parser';
import { QuizConfig, QuizMode, AppPhase, Question, ExamResult, QuestionOptions, SessionBackup, AIConfig } from './types';
import { SetupView } from './components/SetupView';
import { QuizView } from './components/QuizView';
import { HistoryView } from './components/HistoryView';
import { ReviewModal } from './components/ReviewModal';

const App: React.FC = () => {
  // State: Input & Config
  const [rawInput, setRawInput] = useState("");
  const [config, setConfig] = useState<QuizConfig>({
    timeMinutes: 15,
    questionLimit: 25,
    mode: QuizMode.SERIAL,
    shuffleOptions: true
  });

  // AI Config State
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  
  useEffect(() => {
    // Try new config format
    const storedConfig = localStorage.getItem('qm_ai_config');
    if (storedConfig) {
        try {
            setAiConfig(JSON.parse(storedConfig));
        } catch (e) { console.error("Failed to parse AI config"); }
    } else {
        // Fallback to legacy key
        const legacyKey = localStorage.getItem('qm_user_api_key');
        if (legacyKey) {
            setAiConfig({
                provider: 'gemini',
                apiKey: legacyKey,
                model: 'gemini-3-flash-preview'
            });
        }
    }
  }, []);

  const handleSetAiConfig = (newConfig: AIConfig) => {
    setAiConfig(newConfig);
    localStorage.setItem('qm_ai_config', JSON.stringify(newConfig));
    // Clear legacy
    localStorage.removeItem('qm_user_api_key');
  };

  const handleRemoveAiConfig = () => {
    setAiConfig(null);
    localStorage.removeItem('qm_ai_config');
    localStorage.removeItem('qm_user_api_key');
  };

  // State: Parsed Data
  const allQuestions = useMemo(() => parseQuestions(rawInput), [rawInput]);
  const parsedExamName = useMemo(() => extractExamName(rawInput), [rawInput]);
  
  // State: Progression Tracking
  const [nextSerialIndex, setNextSerialIndex] = useState(0);
  const [usedRandomIndices, setUsedRandomIndices] = useState<number[]>([]);
  
  // State: Active Session
  const [phase, setPhase] = useState<AppPhase>('SETUP');
  const [activeBatch, setActiveBatch] = useState<Question[]>([]);
  const [activeTimeLimit, setActiveTimeLimit] = useState(15);
  const [activeParentExamId, setActiveParentExamId] = useState<number | undefined>(undefined);
  const [activeExamName, setActiveExamName] = useState<string | undefined>(undefined);
  
  // State: History & Results
  const [history, setHistory] = useState<ExamResult[]>([]);
  const [reviewItem, setReviewItem] = useState<ExamResult | null>(null);

  // Computed: Exam Labels
  const examLabelMap = useMemo(() => {
    const map = new Map<number, string>();
    const rootIdToNumber = new Map<number, number>();
    const rootIdToSubCount = new Map<number, number>();
    let nextRoot = 1;

    const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

    for (const exam of sortedHistory) {
        if (exam.parentExamId && rootIdToNumber.has(exam.parentExamId)) {
             const pNum = rootIdToNumber.get(exam.parentExamId)!;
             const sub = (rootIdToSubCount.get(exam.parentExamId) || 0) + 1;
             rootIdToSubCount.set(exam.parentExamId, sub);
             map.set(exam.id, `${pNum}.${sub}`);
        } else {
             const myNum = nextRoot++;
             rootIdToNumber.set(exam.id, myNum);
             rootIdToSubCount.set(exam.id, 0);
             map.set(exam.id, `${myNum}`);
        }
    }
    return map;
  }, [history]);

  const currentExamLabel = useMemo(() => {
    if (phase !== 'QUIZ') return '';
    let nextRoot = 1;
    const rootIdToNumber = new Map<number, number>();
    const rootIdToSubCount = new Map<number, number>();
    const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

    for (const exam of sortedHistory) {
      if (!exam.parentExamId) {
        rootIdToNumber.set(exam.id, nextRoot++);
        rootIdToSubCount.set(exam.id, 0);
      } else if (rootIdToNumber.has(exam.parentExamId)) {
        const sub = (rootIdToSubCount.get(exam.parentExamId) || 0) + 1;
        rootIdToSubCount.set(exam.parentExamId, sub);
      }
    }

    if (activeParentExamId !== undefined) {
      if (rootIdToNumber.has(activeParentExamId)) {
         const pNum = rootIdToNumber.get(activeParentExamId);
         const sub = (rootIdToSubCount.get(activeParentExamId) || 0) + 1;
         return `Exam ${pNum}.${sub}`;
      }
      return 'Retake';
    } else {
      return `Exam ${nextRoot}`;
    }
  }, [history, activeParentExamId, phase]);

  useEffect(() => {
    if (allQuestions.length === 0) {
      setConfig(prev => ({ ...prev, questionLimit: 25, timeMinutes: 15 }));
      setNextSerialIndex(0);
      setUsedRandomIndices([]);
      return;
    }

    let availableCount = allQuestions.length;
    if (config.mode === QuizMode.SERIAL) {
      const remaining = Math.max(0, allQuestions.length - nextSerialIndex);
      if (remaining > 0) availableCount = remaining;
    } else if (config.mode === QuizMode.RANDOM_LIMITED) {
      const remaining = Math.max(0, allQuestions.length - usedRandomIndices.length);
      if (remaining > 0) availableCount = remaining;
    }
    const smartLimit = Math.min(25, availableCount);
    const smartTime = Math.max(1, Math.round(smartLimit * 0.6));

    setConfig(prev => ({
        ...prev,
        questionLimit: smartLimit,
        timeMinutes: smartTime
    }));
  }, [allQuestions.length, config.mode, nextSerialIndex, usedRandomIndices.length]);

  const getStats = () => {
    if (config.mode === QuizMode.SERIAL) {
      return { total: allQuestions.length, taken: nextSerialIndex, remaining: Math.max(0, allQuestions.length - nextSerialIndex) };
    } else if (config.mode === QuizMode.RANDOM_LIMITED) {
      return { total: allQuestions.length, taken: usedRandomIndices.length, remaining: Math.max(0, allQuestions.length - usedRandomIndices.length) };
    } else {
      return { total: allQuestions.length, taken: "N/A", remaining: "Unlimited" };
    }
  };

  const processBatchOptions = (questions: Question[], forceShuffle = false): Question[] => {
    if (!config.shuffleOptions && !forceShuffle) return questions;
    return questions.map(q => {
      const correctText = q.opt[q.a];
      const currentValues = [q.opt['ক'], q.opt['খ'], q.opt['গ'], q.opt['ঘ']];
      const shuffledValues = [...currentValues].sort(() => Math.random() - 0.5);
      const newOpt: QuestionOptions = {};
      OPTION_KEYS.forEach((key, index) => { newOpt[key] = shuffledValues[index]; });
      const newCorrectKey = OPTION_KEYS.find(key => newOpt[key] === correctText) || q.a;
      return { ...q, opt: newOpt, a: newCorrectKey };
    });
  };

  const handleStartExam = () => {
    if (allQuestions.length === 0) {
      window.alert("সঠিক ফরম্যাটে প্রশ্ন দিন!");
      return;
    }
    const safeLimit = Number(config.questionLimit) || 1;
    const safeTime = Number(config.timeMinutes) || 1;
    let batch: Question[] = [];

    if (config.mode === QuizMode.SERIAL) {
      let startIndex = nextSerialIndex;
      if (startIndex >= allQuestions.length) {
        window.alert("সব প্রশ্ন শেষ! আবার ১ থেকে শুরু।");
        startIndex = 0;
        setNextSerialIndex(0);
      }
      batch = allQuestions.slice(startIndex, startIndex + safeLimit);
      setNextSerialIndex(startIndex + batch.length);
    } 
    else if (config.mode === QuizMode.RANDOM_LIMITED) {
      let available = allQuestions.filter(q => !usedRandomIndices.includes(q.originalIndex));
      if (available.length === 0) {
        window.alert("র‍্যান্ডম লিমিটেড শেষ! রিসেট হচ্ছে।");
        setUsedRandomIndices([]);
        available = [...allQuestions];
      }
      const shuffled = [...available].sort(() => 0.5 - Math.random());
      batch = shuffled.slice(0, safeLimit);
      const newUsed = batch.map(q => q.originalIndex);
      setUsedRandomIndices(prev => [...prev, ...newUsed]);
    } 
    else {
      batch = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, safeLimit);
    }

    if (batch.length === 0) {
       window.alert("কোনো প্রশ্ন পাওয়া যায়নি।");
       return;
    }

    const finalBatch = processBatchOptions(batch);
    setActiveBatch(finalBatch);
    setActiveTimeLimit(safeTime);
    setActiveParentExamId(undefined);
    setActiveExamName(parsedExamName || undefined);
    setPhase('QUIZ');
    window.scrollTo(0, 0);
  };

  const handleRetake = (result: ExamResult) => {
    if (!result.questions || result.questions.length === 0) return;
    let batch = [...result.questions];
    batch.sort(() => Math.random() - 0.5);
    const finalBatch = processBatchOptions(batch, true);
    const timeLimit = Math.max(1, Math.round(finalBatch.length * 0.6));
    const rootId = result.parentExamId || result.id;
    setActiveParentExamId(rootId);
    setActiveBatch(finalBatch);
    setActiveTimeLimit(timeLimit);
    setActiveExamName(result.examName); // Preserve original name
    setPhase('QUIZ');
    setReviewItem(null); 
    window.scrollTo(0, 0);
  };

  const handleLoadSession = (data: SessionBackup) => {
    if (data.rawInput) setRawInput(data.rawInput);
    if (data.config) setConfig(data.config);
    if (data.progress) {
      setNextSerialIndex(data.progress.nextSerialIndex);
      setUsedRandomIndices(data.progress.usedRandomIndices);
    }
    if (data.history && Array.isArray(data.history)) {
        setHistory(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newItems = data.history.filter(item => !existingIds.has(item.id));
            const combined = [...prev, ...newItems];
            return combined.sort((a, b) => a.timestamp - b.timestamp);
        });
    }
    alert("সেশন সফলভাবে লোড হয়েছে!");
  };

  const handleExportHistory = () => {
    if (history.length === 0 && !rawInput) {
      alert("এক্সপোর্ট করার মতো কোনো ডাটা নেই।");
      return;
    }
    
    // Create full SessionBackup instead of just history array
    const backup: SessionBackup = {
      version: 1,
      timestamp: Date.now(),
      rawInput,
      config,
      progress: { nextSerialIndex, usedRandomIndices },
      history
    };

    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Unified filename format
    const name = parsedExamName || extractExamName(rawInput);
    link.download = generateBackupFilename(name);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        let importedHistory: ExamResult[] = [];
        
        // Handle SessionBackup format
        if (json.history && Array.isArray(json.history)) {
          importedHistory = json.history;
        } 
        // Handle legacy array format
        else if (Array.isArray(json)) {
          importedHistory = json;
        }

        if (importedHistory.length > 0 || (json.version && json.history)) {
           // If it's a valid structure even with empty history, or has history items
           if (importedHistory.length > 0) {
              setHistory(prev => {
                  const existingIds = new Set(prev.map(p => p.id));
                  const newItems = importedHistory.filter((item: ExamResult) => !existingIds.has(item.id));
                  const combined = [...prev, ...newItems];
                  return combined.sort((a, b) => a.timestamp - b.timestamp);
              });
              alert("ইতিহাস সফলভাবে ইমপোর্ট হয়েছে!");
           } else {
             alert("ফাইলে কোনো ইতিহাস পাওয়া যায়নি।");
           }
        } else {
          alert("ভুল ফরম্যাটের ফাইল!");
        }
      } catch (err) {
        alert("ফাইল রিড করতে সমস্যা হয়েছে।");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handleSubmitExam = (userAnswers: (string | null)[]) => {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    activeBatch.forEach((q, idx) => {
      const ans = userAnswers[idx];
      if (!ans) skipped++;
      else if (ans === q.a) correct++;
      else wrong++;
    });

    const result: ExamResult = {
      id: Date.now(), 
      timestamp: Date.now(),
      questions: activeBatch,
      userChoices: userAnswers,
      stats: { correct, wrong, skipped, total: activeBatch.length },
      negativeMark: 0.25, // Default marking
      parentExamId: activeParentExamId,
      examName: activeExamName
    };

    setHistory(prev => [...prev, result]);
    setPhase('SETUP');
    setReviewItem(result);
  };

  const handleUpdateExamResult = (updatedResult: ExamResult) => {
    setHistory(prev => prev.map(item => item.id === updatedResult.id ? updatedResult : item));
    if (reviewItem && reviewItem.id === updatedResult.id) {
      setReviewItem(updatedResult);
    }
  };

  const handleReset = () => {
    setNextSerialIndex(0);
    setUsedRandomIndices([]);
    setHistory([]);
    setConfig({
      timeMinutes: 15,
      questionLimit: 25,
      mode: QuizMode.SERIAL,
      shuffleOptions: true
    });
    setPhase('SETUP');
  };

  return (
    <div className="min-h-screen pb-10">
      <div className="w-full mx-auto px-4 py-6">
        
        {phase === 'SETUP' && (
          <div className="max-w-3xl mx-auto">
            <SetupView
              rawInput={rawInput}
              setRawInput={setRawInput}
              config={config}
              setConfig={setConfig}
              stats={getStats()}
              history={history}
              progress={{ nextSerialIndex, usedRandomIndices }}
              onLoadSession={handleLoadSession}
              onStart={handleStartExam}
              onReset={handleReset}
              aiConfig={aiConfig}
              onSetAiConfig={handleSetAiConfig}
              onRemoveAiConfig={handleRemoveAiConfig}
            />
            <div className="history-section">
                <HistoryView 
                  history={history} 
                  examLabelMap={examLabelMap}
                  onReview={setReviewItem} 
                  onExport={handleExportHistory}
                  onImport={handleImportHistory}
                />
            </div>
          </div>
        )}

        {phase === 'QUIZ' && (
          <QuizView
            questions={activeBatch}
            timeLimitMinutes={activeTimeLimit}
            onSubmit={handleSubmitExam}
            examTitle={currentExamLabel}
            customExamName={activeExamName}
          />
        )}
      </div>

      <ReviewModal 
        result={reviewItem}
        examNumber={reviewItem ? examLabelMap.get(reviewItem.id) : undefined}
        onClose={() => setReviewItem(null)} 
        onRetake={() => reviewItem && handleRetake(reviewItem)}
        onUpdateResult={handleUpdateExamResult}
        aiConfig={aiConfig}
        onSetAiConfig={handleSetAiConfig}
        onRemoveAiConfig={handleRemoveAiConfig}
      />
    </div>
  );
};

export default App;
