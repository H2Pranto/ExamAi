
import React, { useEffect, useState, useCallback } from 'react';
import { Question } from '../types';
import { LucideClock } from 'lucide-react';
import { RichText } from './RichText';

interface QuizViewProps {
  questions: Question[];
  timeLimitMinutes: number;
  examTitle: string;
  customExamName?: string;
  onSubmit: (answers: (string | null)[]) => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ questions, timeLimitMinutes, examTitle, customExamName, onSubmit }) => {
  const [timeLeft, setTimeLeft] = useState(timeLimitMinutes * 60);
  const [userAnswers, setUserAnswers] = useState<(string | null)[]>(new Array(questions.length).fill(null));

  const handleTimeUp = useCallback(() => {
    onSubmit(userAnswers);
  }, [onSubmit, userAnswers]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleTimeUp]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleOptionSelect = (qIndex: number, value: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[qIndex] = value;
    setUserAnswers(newAnswers);
  };

  const answeredCount = userAnswers.filter(a => a !== null).length;

  return (
    <div className="pt-20 pb-10">
      
      {/* Top Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white shadow-md border-b border-gray-200">
        <div className="max-w-5xl mx-auto py-4 px-4 flex items-center justify-between gap-2 sm:gap-4">
            
            <div className="flex flex-col justify-center min-w-[80px]">
                 <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider leading-none mb-1.5">পরীক্ষা</span>
                 <span className="text-xl font-black text-gray-800 leading-none whitespace-nowrap">{examTitle}</span>
                 {customExamName && (
                    <span className="text-sm font-bold text-gray-400 leading-none mt-1 whitespace-nowrap">
                        {customExamName.length > 10 ? `${customExamName.slice(0, 10)}...` : customExamName}
                    </span>
                 )}
            </div>

            <div className="w-px h-10 bg-gray-200 hidden sm:block"></div>

            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 border border-red-100 shrink-0 shadow-sm">
                    <LucideClock size={18} />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[11px] text-gray-500 font-bold mb-0.5">সময় বাকি</span>
                    <span className={`text-xl font-bold tabular-nums ${timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-gray-900'}`}>
                        {formatTime(timeLeft)}
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-center leading-none px-2 min-w-[60px]">
                 <span className="text-[11px] text-gray-500 font-bold mb-0.5">উত্তর</span>
                 <div className="text-xl font-bold text-blue-600">
                    {answeredCount}<span className="text-gray-400 text-sm font-semibold">/{questions.length}</span>
                 </div>
            </div>

            <button 
                onClick={() => onSubmit(userAnswers)}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all"
            >
                সাবমিট
            </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="max-w-5xl mx-auto space-y-3 px-4 sm:px-0">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            
            <div className="flex items-start gap-3 mb-3">
              <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm shadow-sm mt-0.5">
                {idx + 1}
              </span>
               <div className="text-gray-800 font-bold text-lg leading-relaxed pt-1 pb-1">
                <RichText text={q.q} />
              </div>
            </div>
            
            <div className="space-y-2">
              {Object.entries(q.opt).map(([key, val]) => {
                const isSelected = userAnswers[idx] === key;
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 shadow-sm'
                        : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={key}
                      checked={isSelected}
                      onChange={() => handleOptionSelect(idx, key)}
                      className="hidden"
                    />
                    
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border ${
                       isSelected 
                         ? 'bg-blue-600 text-white border-blue-600' 
                         : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {key}
                    </div>
                    
                    <div className={`font-bold text-lg leading-relaxed py-0.5 ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                      <RichText text={val} isOption />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
