
import React, { useState, useEffect } from 'react';
import { 
  LucideSettings, LucideKey, LucideServer, LucideBot, LucideCheck, 
  LucideLoader2, LucideX, LucideExternalLink, LucideSave, LucideTriangleAlert,
  LucideSparkles, LucideGlobe 
} from 'lucide-react';
import { AIConfig, AIProvider } from '../types';
import { validateConnection } from '../utils/aiService';

interface AISettingsModalProps {
  currentConfig: AIConfig | null;
  onSave: (config: AIConfig) => void;
  onClose: () => void;
  onRemove: () => void;
}

const PROVIDER_PRESETS = [
  { id: 'gemini', name: 'Google Gemini', type: 'gemini', url: '', model: 'gemini-3-flash-preview', desc: 'Best for reasoning & Bengali support' },
  { id: 'openai', name: 'OpenAI (ChatGPT)', type: 'openai', url: 'https://api.openai.com/v1', model: 'gpt-4o', desc: 'Standard for high quality' },
  { id: 'ollama', name: 'Ollama (Local)', type: 'custom', url: 'http://localhost:11434/v1', model: 'llama3', desc: 'Run open-source models locally' },
  { id: 'deepseek', name: 'DeepSeek', type: 'custom', url: 'https://api.deepseek.com', model: 'deepseek-chat', desc: 'High performance open model' },
  { id: 'groq', name: 'Groq', type: 'custom', url: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', desc: 'Extremely fast inference' },
  { id: 'openrouter', name: 'OpenRouter', type: 'custom', url: 'https://openrouter.ai/api/v1', model: 'tngtech/deepseek-r1t2-chimera:free', desc: 'Aggregator for many models' },
  { id: 'custom', name: 'Custom / Other', type: 'custom', url: '', model: '', desc: 'Any OpenAI-compatible API' },
];

export const AISettingsModal: React.FC<AISettingsModalProps> = ({ currentConfig, onSave, onClose, onRemove }) => {
  // Determine initial selected preset based on config
  const getInitialPresetId = () => {
    if (!currentConfig) return 'gemini';
    if (currentConfig.provider === 'gemini') return 'gemini';
    if (currentConfig.provider === 'openai') return 'openai';
    
    // Check known URLs for custom providers
    if (currentConfig.baseUrl?.includes('localhost:11434')) return 'ollama';
    if (currentConfig.baseUrl?.includes('deepseek')) return 'deepseek';
    if (currentConfig.baseUrl?.includes('groq')) return 'groq';
    if (currentConfig.baseUrl?.includes('openrouter')) return 'openrouter';
    
    return 'custom';
  };

  const [selectedPresetId, setSelectedPresetId] = useState(getInitialPresetId());
  
  const [provider, setProvider] = useState<AIProvider>(currentConfig?.provider || 'gemini');
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(currentConfig?.baseUrl || '');
  const [model, setModel] = useState(currentConfig?.model || 'gemini-3-flash-preview');
  
  const [isValidating, setIsValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = PROVIDER_PRESETS.find(p => p.id === presetId);
    if (preset) {
        setProvider(preset.type as AIProvider);
        if (preset.url) setBaseUrl(preset.url);
        if (preset.model) setModel(preset.model);
        // Clear API key if switching types significantly, unless it's just a preset change that might share keys
        if (presetId === 'ollama') setApiKey(''); // Ollama usually doesn't need a key
    }
  };

  const handleTestAndSave = async () => {
    setErrorMsg(null);
    
    // Allow empty key for local/custom providers (like Ollama)
    if (!apiKey && provider === 'gemini') {
        setErrorMsg("Google Gemini-এর জন্য API Key প্রয়োজন।");
        return;
    }
    if (!apiKey && provider === 'openai') {
        setErrorMsg("OpenAI-এর জন্য API Key প্রয়োজন।");
        return;
    }
    
    const config: AIConfig = { provider, apiKey, baseUrl, model };
    setIsValidating(true);
    
    const success = await validateConnection(config);
    setIsValidating(false);

    if (success) {
        onSave(config);
        onClose();
    } else {
        setErrorMsg("সংযোগ ব্যর্থ হয়েছে। সেটিংস বা মডেল নেম চেক করুন।");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 shadow-2xl rounded-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto">
        
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                <LucideSettings className="text-indigo-600" size={24}/>
                AI সেটআপ
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                <LucideX size={24} />
            </button>
        </div>

        {/* Provider Preset Selection */}
        <div className="mb-5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Service Provider</label>
            <div className="relative">
                <select 
                    value={selectedPresetId}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none"
                >
                    {PROVIDER_PRESETS.map(preset => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-3.5 pointer-events-none text-gray-500">
                    <LucideGlobe size={16} />
                </div>
            </div>
            {/* Description */}
            <p className="text-[10px] text-gray-500 mt-2 px-1">
                {PROVIDER_PRESETS.find(p => p.id === selectedPresetId)?.desc}
            </p>
        </div>

        {/* Config Fields */}
        <div className="space-y-4 mb-6">
            {/* Base URL (Shown for Custom/OpenAI types except standard OpenAI which has fixed url usually, but we allow editing for custom) */}
            {provider !== 'gemini' && (
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Base URL / API Endpoint</label>
                    <div className="relative">
                        <LucideServer className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="https://api.openai.com/v1"
                            disabled={selectedPresetId === 'openai'} // Standard OpenAI URL usually doesn't change
                            className={`w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${selectedPresetId === 'openai' ? 'bg-gray-100 text-gray-500' : ''}`}
                        />
                    </div>
                </div>
            )}

            {/* API Key */}
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                    API Key 
                    {selectedPresetId === 'ollama' && <span className="text-gray-400 font-normal ml-1">(Optional for Local)</span>}
                </label>
                <div className="relative">
                    <LucideKey className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input 
                        type="password" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={provider === 'gemini' ? "AIza..." : "sk-..."}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>
                {provider === 'gemini' && (
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 flex items-center gap-1 mt-1 hover:underline">
                        Get Gemini Key <LucideExternalLink size={8} />
                    </a>
                )}
                {selectedPresetId === 'groq' && (
                    <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 flex items-center gap-1 mt-1 hover:underline">
                        Get Groq Key <LucideExternalLink size={8} />
                    </a>
                )}
            </div>

            {/* Model Name */}
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Model Name</label>
                <div className="relative">
                    <LucideBot className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="gpt-4o, llama3, etc."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                    Examples: <span className="font-mono bg-gray-100 px-1 rounded">gpt-4o</span>, <span className="font-mono bg-gray-100 px-1 rounded">llama3</span>, <span className="font-mono bg-gray-100 px-1 rounded">deepseek-chat</span>
                </p>
            </div>
        </div>

        {/* Error Message */}
        {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-xs font-bold">
                <LucideTriangleAlert size={16} />
                {errorMsg}
            </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
             <button 
                onClick={handleTestAndSave}
                disabled={isValidating}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
            >
                {isValidating ? <LucideLoader2 size={18} className="animate-spin" /> : <LucideSave size={18} />}
                {isValidating ? 'যাচাই করা হচ্ছে...' : 'সেভ করুন'}
            </button>
            {currentConfig && (
                <button 
                    onClick={onRemove}
                    className="px-4 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl font-bold text-sm"
                >
                    মুছে ফেলুন
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
