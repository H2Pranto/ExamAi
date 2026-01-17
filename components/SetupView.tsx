
import React, { useState, useRef, useEffect } from 'react';
import { QuizConfig, QuizMode, SessionBackup, ExamResult, AIConfig } from '../types';
import { 
  LucideSettings, LucidePlay, LucideRotateCcw, LucideFileText, LucideCamera, 
  LucideLoader2, LucideImagePlus, LucideShuffle, LucideX, LucideSend, 
  LucideTrash2, LucideKey, LucideEye, LucideEyeOff, LucideExternalLink, 
  LucideSparkles, LucideUser, LucideSave, LucideFolderOpen, LucideDatabase, 
  LucideWand2, LucideArrowUp, LucideLayout, LucidePlus, LucideImage,
  LucideDownload, LucideUpload, LucidePaperclip, LucideFile
} from 'lucide-react';
import { parseQuestions, extractExamName, generateBackupFilename } from '../utils/parser';
import { generateAIResponse, Message } from '../utils/aiService';
import { AISettingsModal } from './AISettingsModal';

interface VisualQuestion {
  q: string;
  opt: { ক: string; খ: string; গ: string; ঘ: string };
  a: string;
}

interface SetupViewProps {
  rawInput: string;
  setRawInput: (val: string) => void;
  config: QuizConfig;
  setConfig: (val: QuizConfig) => void;
  stats: { total: number; taken: number | string; remaining: number | string };
  history: ExamResult[];
  progress: { nextSerialIndex: number; usedRandomIndices: number[] };
  onLoadSession: (data: SessionBackup) => void;
  onStart: () => void;
  onReset: () => void;
  aiConfig: AIConfig | null;
  onSetAiConfig: (config: AIConfig) => void;
  onRemoveAiConfig: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({
  rawInput,
  setRawInput,
  config,
  setConfig,
  stats,
  history,
  progress,
  onLoadSession,
  onStart,
  onReset,
  aiConfig,
  onSetAiConfig,
  onRemoveAiConfig
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiInterface, setShowAiInterface] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [forceRecentStructure, setForceRecentStructure] = useState(false);

  // Visual Form State
  const [showVisualForm, setShowVisualForm] = useState(false);
  const [visualQuestions, setVisualQuestions] = useState<VisualQuestion[]>([{
    q: '',
    opt: { ক: '', খ: '', গ: '', ঘ: '' },
    a: 'ক'
  }]);
  const [examName, setExamName] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionInputRef = useRef<HTMLInputElement>(null);
  const fieldImageInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const activeFieldRef = useRef<{ idx: number; field: string } | null>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    if (selectedFiles.length > 0) {
      setForceRecentStructure(true);
    }
  }, [selectedFiles.length]);

  const handleChange = (field: keyof QuizConfig, value: string | number | boolean) => {
    const newConfig = { ...config, [field]: value };
    if (field === 'questionLimit') {
      const numValue = Number(value);
      if (value !== '' && !isNaN(numValue)) {
        newConfig.timeMinutes = Math.max(1, Math.round(numValue * 0.6));
      }
    }
    setConfig(newConfig);
  };

  const handleExportSession = () => {
    if (!rawInput.trim() && history.length === 0) {
      alert("ব্যাকআপ করার মতো কোনো ডাটা নেই।");
      return;
    }
    const currentName = extractExamName(rawInput);
    const backup: SessionBackup = {
      version: 1,
      timestamp: Date.now(),
      rawInput,
      config,
      progress: progress,
      history: history
    };
    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Unified filename
    link.download = generateBackupFilename(currentName);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.version && (json.rawInput !== undefined || json.history)) {
           onLoadSession(json as SessionBackup);
        } else {
           alert("ভুল ফরম্যাটের সেশন ফাইল!");
        }
      } catch (err) {
        alert("ফাইল রিড করতে সমস্যা হয়েছে।");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const openAiGenerator = () => {
    if (!aiConfig) {
      setShowSettingsModal(true);
      return;
    }
    setShowAiInterface(true);
    setForceRecentStructure(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAiGeneratorFields = () => {
    setSelectedFiles([]);
    setCustomPrompt("");
  };

  const handleGenerate = async () => {
    if (selectedFiles.length === 0 && !customPrompt.trim()) {
        alert("অনুগ্রহ করে ফাইল যোগ করুন অথবা বিষয় লিখুন।");
        return;
    }
    if (!aiConfig) {
        setShowSettingsModal(true);
        return;
    }
    setIsGenerating(true);
    try {
      const contentParts: any[] = [];

      // Process files
      for (const file of selectedFiles) {
          if (file.type.startsWith('image/')) {
              const base64Data = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
              });
              contentParts.push({ inlineData: { mimeType: file.type, data: base64Data } });
          } else if (file.type === 'application/pdf') {
              const base64Data = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
              });
              // Note: Non-Gemini providers might not support inline PDF. 
              // The service adapter will try to handle or fail gracefully.
              contentParts.push({ inlineData: { mimeType: 'application/pdf', data: base64Data } });
          } else {
              // Assume text-based for others (txt, csv, json, md, etc.)
              const textData = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve(e.target?.result as string);
                  reader.onerror = reject;
                  reader.readAsText(file);
              });
              contentParts.push({ text: `\n\n--- File: ${file.name} ---\n${textData}\n` });
          }
      }

      const userInstruction = customPrompt.trim();
      const shouldGenerateTitle = rawInput.trim().length === 0;

      const fullPrompt = `
      TASK: Generate Multiple Choice Questions (MCQs) in Bengali based on the provided content (Images, PDF, Text, etc.).
      USER PROMPT: ${userInstruction ? userInstruction : "Analyze input and generate questions."}
      
      VISUAL RULES (CRITICAL):
      1. ONLY use [icon:IconName] or [img:Source] if:
         a) You are analyzing provided images.
         b) The user explicitly requested an icon-based question.
         c) The question logic strictly requires a visual symbol.
      2. DO NOT add decorative icons to standard text questions.
      3. If the input is plain text/PDF, output plain text questions only.
      
      STRICT FORMAT:
      ${shouldGenerateTitle ? "1. The VERY FIRST line of output MUST be a short, relevant Exam Name based on the content, wrapped in triple asterisks. Example: ***History of Bangladesh***\n      2. Then list the questions in this format:" : "List the questions in this format:"}
      Question | Opt A | Opt B | Opt C | Opt D | CorrectKey ###
      
      CorrectKey must be: ক, খ, গ, or ঘ.
      `;
      
      contentParts.push({ text: fullPrompt });

      const messages: Message[] = [{ role: 'user', parts: contentParts }];
      
      const responseText = await generateAIResponse(aiConfig, messages);
      
      if (responseText) {
        setRawInput(prev => (prev.trim() ? prev + '\n' : '') + responseText.trim());
        setShowAiInterface(false);
      }
    } catch (err: any) {
      console.error("AI API Error:", err);
      alert(`AI জেনারেশন ব্যর্থ হয়েছে।\nError: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInputInteraction = () => {
    if (selectedFiles.length === 0) {
      setForceRecentStructure(false);
    }
  };

  // Visual Maker Handlers
  const handleOpenVisualForm = () => {
    if (rawInput.trim()) {
        const parsed = parseQuestions(rawInput);
        const extractedName = extractExamName(rawInput);
        if (extractedName) setExamName(extractedName);

        if (parsed.length > 0) {
            setVisualQuestions(parsed.map(p => ({
                q: p.q,
                opt: p.opt as { ক: string; খ: string; গ: string; ঘ: string },
                a: p.a
            })));
        } else {
             setVisualQuestions([{ q: '', opt: { ক: '', খ: '', গ: '', ঘ: '' }, a: 'ক' }]);
        }
    } else {
        setVisualQuestions([{ q: '', opt: { ক: '', খ: '', গ: '', ঘ: '' }, a: 'ক' }]);
        setExamName("");
    }
    setShowVisualForm(true);
  };

  const addVisualQuestion = () => {
    setVisualQuestions([...visualQuestions, {
      q: '',
      opt: { ক: '', খ: '', গ: '', ঘ: '' },
      a: 'ক'
    }]);
  };

  const updateVisualQuestion = (idx: number, field: string, value: string) => {
    const updated = [...visualQuestions];
    if (field === 'q' || field === 'a') {
      (updated[idx] as any)[field] = value;
    } else {
      (updated[idx].opt as any)[field] = value;
    }
    setVisualQuestions(updated);
  };

  const triggerFieldImage = (idx: number, field: string) => {
    activeFieldRef.current = { idx, field };
    fieldImageInputRef.current?.click();
  };

  const handleFieldImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeFieldRef.current) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const { idx, field } = activeFieldRef.current!;
      const currentVal = field === 'q' 
        ? visualQuestions[idx].q 
        : (visualQuestions[idx].opt as any)[field];
      
      const newVal = currentVal + ` [img:${base64}]`;
      updateVisualQuestion(idx, field, newVal);
      activeFieldRef.current = null;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveVisualQuestions = () => {
    const formatted = visualQuestions
      .filter(vq => vq.q.trim())
      .map(vq => `${vq.q} | ${vq.opt.ক} | ${vq.opt.খ} | ${vq.opt.গ} | ${vq.opt.ঘ} | ${vq.a}`)
      .join(' ### ');
    
    if (formatted) {
      // Changed format to use ***Name*** as requested
      const finalOutput = (examName ? `***${examName}***\n` : '') + formatted + ' ###';
      setRawInput(finalOutput);
    }
    setShowVisualForm(false);
    setVisualQuestions([{ q: '', opt: { ক: '', খ: '', গ: '', ঘ: '' }, a: 'ক' }]);
    setExamName("");
  };

  const handleModalImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        let contentToParse = text;

        // Try to parse as JSON first (SessionBackup format)
        try {
          const json = JSON.parse(text);
          if (json.rawInput) {
             contentToParse = json.rawInput;
          }
        } catch (e) {
          // Not JSON, assume raw text format
        }

        const parsed = parseQuestions(contentToParse);
        const name = extractExamName(contentToParse);
        if (name) setExamName(name);
        
        if (parsed.length > 0) {
            const mapped = parsed.map(p => ({
                q: p.q,
                opt: p.opt as { ক: string; খ: string; গ: string; ঘ: string },
                a: p.a
            }));
            setVisualQuestions(prev => [...prev, ...mapped]);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleModalExport = () => {
    const formatted = visualQuestions
      .filter(vq => vq.q.trim())
      .map(vq => `${vq.q} | ${vq.opt.ক} | ${vq.opt.খ} | ${vq.opt.গ} | ${vq.opt.ঘ} | ${vq.a}`)
      .join(' ### ');
    
    if (!formatted) {
        alert("এক্সপোর্ট করার মতো প্রশ্ন নেই");
        return;
    }
    // Content string
    const generatedRawInput = (examName ? `***${examName}***\n` : '') + formatted + ' ###';
    
    // Create full session backup
    const backup: SessionBackup = {
      version: 1,
      timestamp: Date.now(),
      rawInput: generatedRawInput,
      config: config,
      progress: progress,
      history: history
    };

    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Unified filename
    link.download = generateBackupFilename(examName || "questions");
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasAiInput = selectedFiles.length > 0 || customPrompt.trim() !== "";
  const isShowingRecentStructure = forceRecentStructure || selectedFiles.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-lg p-5 mb-6 border border-gray-200 text-gray-800 relative">
      <input type="file" ref={fieldImageInputRef} onChange={handleFieldImageChange} accept="image/*" className="hidden" />

      {/* Visual Form Modal */}
      {showVisualForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 relative">
            <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <LucideLayout size={20} className="text-blue-600" />
                    <h2 className="text-base font-extrabold text-gray-900 leading-tight flex items-baseline gap-1">
                      প্রশ্ন ফর্ম <span className="text-gray-400 font-normal text-[0.75em]">| প্রশ্ন সংখ্যা: {visualQuestions.length}</span>
                    </h2>
                </div>
                
                <div className="flex items-center gap-1 ml-2 border-l pl-3 border-gray-200">
                    <input type="file" ref={modalFileInputRef} onChange={handleModalImport} accept=".json,.txt" className="hidden" />
                    <button onClick={() => modalFileInputRef.current?.click()} className="flex items-center gap-1.5 px-1.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-md text-xs font-bold border border-gray-200 transition-colors">
                        <LucideUpload size={14} /> ইমপোর্ট
                    </button>
                    <button onClick={handleModalExport} className="flex items-center gap-1.5 px-1.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-md text-xs font-bold border border-gray-200 transition-colors">
                        <LucideDownload size={14} /> এক্সপোর্ট
                    </button>
                </div>
              </div>
              <button onClick={() => setShowVisualForm(false)} className="p-1 hover:bg-gray-200 rounded-full shrink-0">
                <LucideX size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
              <span className="text-sm font-bold text-gray-600 whitespace-nowrap">পরীক্ষার নাম (ঐচ্ছিক) :</span>
              <input 
                type="text" 
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="পরীক্ষার নাম লিখুন..."
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white">
              {visualQuestions.map((vq, idx) => (
                <div key={idx} className="p-3 border border-blue-100 bg-blue-50/20 rounded-xl relative">
                   <div className="absolute -top-2 left-3 px-2 py-0 bg-blue-600 text-white text-[9px] font-bold rounded">প্রশ্ন {idx + 1}</div>
                   <button 
                     onClick={() => setVisualQuestions(visualQuestions.filter((_, i) => i !== idx))} 
                     className="absolute -top-2 right-3 p-1 bg-white border border-red-100 text-red-500 rounded-full shadow-sm hover:bg-red-50"
                   >
                     <LucideTrash2 size={12} />
                   </button>
                   
                   <div className="space-y-3 pt-1">
                      <div className="relative">
                         <textarea 
                            className="w-full p-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white min-h-[60px]"
                            placeholder="প্রশ্ন লিখুন..."
                            value={vq.q}
                            onChange={(e) => updateVisualQuestion(idx, 'q', e.target.value)}
                         />
                         <button onClick={() => triggerFieldImage(idx, 'q')} className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-blue-500"><LucideImage size={18} /></button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         {['ক', 'খ', 'গ', 'ঘ'].map(key => (
                            <div key={key} className="relative flex items-center gap-2">
                               <div className="w-5 h-5 shrink-0 flex items-center justify-center bg-blue-100 text-blue-700 text-[9px] font-bold rounded-full">{key}</div>
                               <input 
                                  type="text"
                                  className="flex-1 p-1.5 pr-8 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder={`অপশন ${key}...`}
                                  value={(vq.opt as any)[key]}
                                  onChange={(e) => updateVisualQuestion(idx, key, e.target.value)}
                               />
                               <button onClick={() => triggerFieldImage(idx, key as any)} className="absolute right-1 top-0.5 p-1.5 text-gray-400 hover:text-blue-500"><LucideImage size={14} /></button>
                            </div>
                         ))}
                      </div>

                      <div className="flex items-center gap-3 border-t border-blue-50 pt-2">
                         <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">সঠিক উত্তর:</span>
                         <div className="flex gap-1.5">
                            {['ক', 'খ', 'গ', 'ঘ'].map(key => (
                               <button 
                                  key={key}
                                  onClick={() => updateVisualQuestion(idx, 'a', key)}
                                  className={`w-7 h-7 flex items-center justify-center rounded-lg border font-bold text-xs transition-all ${vq.a === key ? 'bg-green-600 text-white border-green-700 shadow-sm' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}
                               >
                                  {key}
                                </button>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
              ))}
              <button 
                onClick={addVisualQuestion} 
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-all flex flex-col items-center justify-center gap-1 bg-gray-50/50"
              >
                <LucidePlus size={20} />
                <span className="text-[9px] font-bold uppercase tracking-widest">নতুন প্রশ্ন যোগ করুন</span>
              </button>
            </div>

            <div className="p-2 border-t border-gray-200 bg-gray-50 flex gap-2">
              <button 
                onClick={handleSaveVisualQuestions}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold border border-indigo-800 text-sm shadow-sm flex items-center justify-center gap-2"
              >
                যোগ করুন
              </button>
              <button 
                onClick={() => setShowVisualForm(false)} 
                className="flex-1 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-lg font-bold border border-gray-300 text-sm shadow-sm"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <AISettingsModal
          currentConfig={aiConfig}
          onSave={onSetAiConfig}
          onClose={() => setShowSettingsModal(false)}
          onRemove={onRemoveAiConfig}
        />
      )}

      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><LucideFileText size={20} /></div>
            <h2 className="text-lg font-bold text-blue-600">প্রশ্ন ব্যাংক সেটআপ</h2>
        </div>
        <button onClick={() => setShowSettingsModal(true)} className={`relative w-10 h-10 rounded-full flex items-center justify-center shadow-sm border ${aiConfig ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-transparent' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
            {aiConfig ? <LucideSparkles size={18} /> : <LucideUser size={20} />}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${aiConfig ? 'bg-green-500' : 'bg-red-400'}`}></span>
        </button>
      </div>
      <div className="mb-5">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf,.pdf,text/plain,.txt,.csv,.json,.md" multiple className="hidden" />
        {showAiInterface ? (
           <div className="w-full h-[180px] bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden relative">
              <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                  {hasAiInput && (
                    <button 
                      onClick={clearAiGeneratorFields} 
                      className="p-1.5 bg-white/50 text-gray-400 hover:text-red-500 rounded-full hover:bg-white shadow-sm border border-gray-100"
                      title="মুছে ফেলুন"
                    >
                      <LucideTrash2 size={14} />
                    </button>
                  )}
                  <button 
                    onClick={() => setShowAiInterface(false)} 
                    className="p-1.5 bg-white/50 text-gray-400 hover:text-red-500 rounded-full hover:bg-white shadow-sm border border-gray-100"
                    title="বন্ধ করুন"
                  >
                    <LucideX size={14} />
                  </button>
              </div>
              <div className="p-3 flex flex-col h-full">
                <h3 className="shrink-0 text-sm font-bold text-slate-700 flex items-center gap-2 px-1 mb-2"><LucideSparkles size={16} className="text-indigo-500" /> AI প্রশ্ন জেনারেটর</h3>
                
                {!isShowingRecentStructure ? (
                  <div className="flex-1 flex gap-3 px-1 pb-1">
                    <div className="flex-1 border border-gray-300 rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
                        <textarea 
                            className="w-full flex-1 p-3 text-sm focus:outline-none bg-white text-gray-900 resize-none leading-relaxed" 
                            placeholder="বিষয় লিখুন (যেমন: বাংলাদেশের নদী)..." 
                            value={customPrompt} 
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            disabled={isGenerating}
                        />
                    </div>
                    <div className="flex flex-col gap-2 justify-end">
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="w-12 h-12 border-2 border-dashed border-slate-300 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm active:scale-95 bg-white"
                            title="ফাইল যোগ করুন"
                        >
                            <LucidePaperclip size={24} />
                        </button>
                        <button 
                            onClick={handleGenerate} 
                            disabled={isGenerating || (selectedFiles.length === 0 && !customPrompt.trim())} 
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-sm active:scale-95 ${
                              isGenerating 
                                ? 'bg-slate-200 text-slate-400' 
                                : (selectedFiles.length > 0 || customPrompt.trim() !== "")
                                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                            }`}
                        >
                            {isGenerating ? <LucideLoader2 size={20} className="animate-spin" /> : <LucideArrowUp size={24} />}
                        </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 flex items-center gap-3 overflow-x-auto py-1 px-1">
                        <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 flex-shrink-0 bg-white border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-500"><LucidePaperclip size={30} /></button>
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="relative w-20 h-20 flex-shrink-0 bg-white rounded-xl border border-slate-200 p-1 shadow-sm group">
                             {file.type.startsWith('image/') ? (
                                <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover rounded-lg" />
                             ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg p-1">
                                    <LucideFile size={24} className="text-gray-400 mb-1" />
                                    <span className="text-[9px] text-gray-500 text-center break-all leading-tight line-clamp-2">{file.name}</span>
                                </div>
                             )}
                             <button onClick={() => removeFile(idx)} className="absolute -top-2 -right-2 bg-white text-red-500 border border-red-100 p-1 rounded-full shadow-md hover:bg-red-50 z-10"><LucideX size={14} /></button>
                          </div>
                        ))}
                    </div>
                    <div className="shrink-0 flex gap-2 mt-2">
                        <input 
                            type="text" 
                            className="flex-1 h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-indigo-500 bg-white text-gray-900" 
                            placeholder="বিষয় লিখুন..." 
                            value={customPrompt} 
                            onChange={(e) => setCustomPrompt(e.target.value)} 
                            onFocus={handleInputInteraction}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()} 
                            disabled={isGenerating} 
                        />
                        <button onClick={handleGenerate} disabled={isGenerating || (selectedFiles.length === 0 && !customPrompt.trim())} className={`h-11 w-12 rounded-lg flex items-center justify-center ${
                          isGenerating 
                            ? 'bg-slate-200 text-slate-400' 
                            : (selectedFiles.length > 0 || customPrompt.trim() !== "")
                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                        }`}>
                            {isGenerating ? <LucideLoader2 size={20} className="animate-spin" /> : <LucideArrowUp size={24} />}
                        </button>
                    </div>
                  </>
                )}
              </div>
           </div>
        ) : (
           <div className="w-full h-[180px] flex flex-col">
              <div className="shrink-0 flex justify-between items-center mb-2 gap-2">
                  <label className="block text-base font-bold text-gray-700 leading-tight">
                    প্রশ্ন ব্যাংক <span className="text-gray-400 font-normal text-[9px] block sm:inline">(ফরম্যাট: প্রশ্ন | ক | খ | গ | ঘ | সঠিক ###)</span>
                  </label>
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={handleOpenVisualForm} 
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 text-xs whitespace-nowrap shadow-sm transition-colors"
                    >
                      <LucideLayout size={14} /> প্রশ্ন ফর্ম
                    </button>
                    <button 
                        onClick={openAiGenerator} 
                        className="flex items-center gap-1.5 px-3 py-2 rounded-md font-bold text-white bg-indigo-500 hover:bg-indigo-600 text-xs whitespace-nowrap shadow-sm border border-transparent"
                    >
                        <LucideWand2 size={14} /> AI জেনারেটর
                    </button>
                  </div>
              </div>
              <div className="flex-1 relative bg-gray-50 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden">
                <textarea 
                  className="w-full h-full p-3 bg-transparent border-none focus:ring-0 text-sm font-mono resize-none text-gray-900 relative z-10" 
                  value={rawInput} 
                  onChange={(e) => setRawInput(e.target.value)} 
                />
                {!rawInput && (
                  <div className="absolute inset-0 p-3 pointer-events-none text-gray-400 font-mono text-[0.75em] z-0">
                    <div className="opacity-70 text-[1.2em]">সঠিক ফরমেটে প্রশ্ন লিখুন বা পেস্ট করুন...</div>
                    <div className="mt-1 leading-relaxed opacity-60 whitespace-pre-wrap text-[0.95em]">
{`উদাহরণ:
জাপানের মুদ্রা? | ইয়েন | রিয়াল | ডলার | টাকা | ক ###
বাংলাদেশের রাজধানী? | ঢাকা | খুলনা | রাজশাহী | বরিশাল | ক ### 
N.B. ছবি বা সিম্বল যোগ করতে প্রশ্ন বা অপশনের শেষে [img:url] বা [icon:info] লিখুন অথবা প্রশ্ন ফর্ম ব্যবহার করুন।`}
                    </div>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 z-20">
                  {rawInput.length > 0 && (
                    <button onClick={() => setRawInput('')} className="p-1.5 bg-white text-gray-400 hover:text-red-500 rounded-md shadow-sm border border-gray-200"><LucideTrash2 size={14} /></button>
                  )}
                </div>
              </div>
           </div>
        )}
      </div>
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-5 text-gray-900">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div><label className="block text-xs font-bold text-gray-500 mb-1">সময় (মিনিট)</label><input type="number" min="1" className="w-full h-10 px-2 border border-gray-300 rounded-md text-center font-bold bg-white text-gray-900" value={config.timeMinutes} onChange={(e) => handleChange('timeMinutes', e.target.value === '' ? '' : parseInt(e.target.value))} /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">লিমিট (প্রশ্ন)</label><input type="number" min="1" className="w-full h-10 px-2 border border-gray-300 rounded-md text-center font-bold bg-white text-gray-900" value={config.questionLimit} onChange={(e) => handleChange('questionLimit', e.target.value === '' ? '' : parseInt(e.target.value))} /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">অপশন শাফল</label><button type="button" onClick={() => handleChange('shuffleOptions', !config.shuffleOptions)} className={`w-full h-10 px-2 rounded-md border flex items-center justify-center gap-2 font-bold ${config.shuffleOptions ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 border-gray-300'}`}><LucideShuffle size={16} /><span className="text-xs">{config.shuffleOptions ? 'চালু' : 'বন্ধ'}</span></button></div>
        </div>
        <div><label className="block text-xs font-bold text-gray-500 mb-1">মোড (প্রশ্নের ক্রোম)</label><div className="relative"><select className="w-full h-10 px-2 border border-gray-300 rounded-md bg-white text-sm text-gray-900" value={config.mode} onChange={(e) => handleChange('mode', e.target.value as QuizMode)}><option value={QuizMode.SERIAL}>সিরিয়াল (Serial)</option><option value={QuizMode.RANDOM_LIMITED}>র‍্যান্ডম লিমিটেড</option><option value={QuizMode.RANDOM_UNLIMITED}>র‍্যান্ডম আনলিমিটেড</option></select></div></div>
      </div>
      <div className="flex items-center justify-between bg-blue-50 text-blue-800 py-1.5 px-3 rounded-lg mb-4 border border-blue-100 text-xs">
        <div className="flex items-center gap-2"><LucideDatabase size={14} /><span className="font-bold">প্রশ্ন স্ট্যাটাস:</span></div>
        <div className="font-bold space-x-3"><span>মোট: {stats.total}</span><span>হয়েছে: {stats.taken}</span><span>বাকি: {stats.remaining}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <input type="file" ref={sessionInputRef} onChange={handleImportSession} accept=".json" className="hidden" />
        <button onClick={() => sessionInputRef.current?.click()} className="flex items-center justify-center gap-2 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs font-bold"><LucideFolderOpen size={14} /> লোড সেশন</button>
        <button onClick={handleExportSession} className="flex items-center justify-center gap-2 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-xs font-bold"><LucideSave size={14} /> সেভ সেশন</button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <button onClick={onStart} className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm text-sm"><LucidePlay size={18} /> পরীক্ষা শুরু করুন</button>
        <button onClick={onReset} className="flex items-center justify-center gap-2 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold"><LucideRotateCcw size={16} /> সব রিসেট করুন</button>
      </div>
    </div>
  );
};
