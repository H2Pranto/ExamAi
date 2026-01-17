
import React, { useRef } from 'react';
import { ExamResult } from '../types';
import { LucideHistory, LucideChevronRight, LucideAward, LucideDownload, LucideUpload } from 'lucide-react';

interface HistoryViewProps {
  history: ExamResult[];
  examLabelMap: Map<number, string>;
  onReview: (result: ExamResult) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ 
  history, 
  examLabelMap,
  onReview, 
  onExport,
  onImport
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (history.length === 0) {
    return (
      <div className="mt-8 border-t-2 border-gray-200 pt-6">
         <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                <LucideHistory size={20} />
                পরীক্ষার ইতিহাস
            </h3>
            
            <div className="flex gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={onImport}
                  accept=".json"
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 text-xs font-bold shadow-sm transition-colors"
                >
                  <LucideUpload size={14} /> ইমপোর্ট
                </button>
            </div>
         </div>
         <div className="p-6 text-center text-gray-400 bg-white rounded-lg border border-dashed border-gray-300 shadow-sm">
            কোনো ইতিহাস নেই।
        </div>
      </div>
    );
  }

  const displayHistory = [...history].reverse();

  const getTruncatedName = (name: string) => {
    return name.length > 6 ? `(${name.slice(0, 6)}...)` : `(${name})`;
  };

  return (
    <div className="mt-8 border-t-2 border-gray-200 pt-6">
      <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
            <LucideHistory size={20} />
            পরীক্ষার ইতিহাস
          </h3>
          
          <div className="flex gap-2">
            <button 
                onClick={onExport}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 text-xs font-bold shadow-sm transition-colors"
                title="ইতিহাস ডাউনলোড করুন"
            >
                <LucideDownload size={14} /> এক্সপোর্ট
            </button>
            
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={onImport}
                accept=".json"
                className="hidden"
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 text-xs font-bold shadow-sm transition-colors"
                title="ইতিহাস আপলোড করুন"
            >
                <LucideUpload size={14} /> ইমপোর্ট
            </button>
          </div>
      </div>
      
      <div className="space-y-3">
        {displayHistory.map((res) => {
          // Individual marking calculation for each history item
          const negMark = res.negativeMark || 0.25;
          const score = (res.stats.correct * 1) - (res.stats.wrong * negMark);
          const examLabel = examLabelMap.get(res.id) || '?';
          
          return (
            <div
              key={res.id}
              onClick={() => onReview(res)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all text-gray-800 shadow-sm group cursor-pointer relative"
            >
              <div className="flex justify-between items-center mb-2 mt-1">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-gray-800 flex items-center">
                    <LucideAward size={16} className="text-amber-500 mr-1.5" />
                    Exam {examLabel}
                    {res.examName && (
                        <span className="text-[0.75em] text-gray-500 ml-0">{getTruncatedName(res.examName)}</span>
                    )}
                  </div>
                </div>

                {/* Score Badge */}
                <span className="text-[10px] text-gray-600 font-bold bg-white px-2 py-0.5 rounded border border-gray-300 shadow-sm flex items-center gap-1 whitespace-nowrap mx-1">
                    Score: {score.toFixed(2)} <span className="text-[0.75em] text-gray-400">(-{negMark})</span>
                </span>

                {/* Date Badge */}
                <span className="text-[10px] text-gray-800 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 whitespace-nowrap">
                  {new Date(res.timestamp).toLocaleDateString()} {new Date(res.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm border-t border-dashed border-gray-200 pt-2 mt-2">
                <div className="flex gap-3 text-xs sm:text-sm">
                  <span className="text-green-600 font-bold">সঠিক: {res.stats.correct}</span>
                  <span className="text-red-600 font-bold">ভুল: {res.stats.wrong}</span>
                  <span className="text-amber-600 font-bold">বাকি: {res.stats.skipped}</span>
                </div>
                
                <div className="flex gap-2">
                    <button 
                      className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100 shadow-sm"
                    >
                      রিভিউ <LucideChevronRight size={12} />
                    </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
