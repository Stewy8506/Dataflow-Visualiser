import { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw, X, Zap } from 'lucide-react';

interface SettingsModalProps {
  apiKey: string;
  setApiKey: (val: string) => void;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  enableAi: boolean;
  setEnableAi: (val: boolean) => void;
  preferredIde: string;
  setPreferredIde: (val: string) => void;
  onClose: () => void;
}

interface GeminiModel {
  name: string;
  displayName: string;
  supportedGenerationMethods: string[];
}

export function SettingsModal({
  apiKey, setApiKey,
  selectedModel, setSelectedModel,
  enableAi, setEnableAi,
  preferredIde, setPreferredIde,
  onClose,
}: SettingsModalProps) {
  const [availableModels, setAvailableModels] = useState<GeminiModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (apiKey) loadModels();
  }, [apiKey]);

  const loadModels = async () => {
    if (!apiKey) return;
    setIsLoadingModels(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await res.json();
      if (data.models) {
        const generateContentModels: GeminiModel[] = data.models.filter((m: GeminiModel) =>
          m.supportedGenerationMethods?.includes('generateContent')
        );
        setAvailableModels(generateContentModels);
        if (!selectedModel || !generateContentModels.find(m => m.name === selectedModel)) {
          if (generateContentModels.length > 0) setSelectedModel(generateContentModels[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load models', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await res.json();
      setTestStatus(data.models?.length > 0 ? 'success' : 'error');
    } catch {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const handleSave = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini_model', selectedModel);
    localStorage.setItem('enable_ai_summary', String(enableAi));
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center nebula-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 nebula-slide-up">
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-text-main">Settings</h2>
            <button onClick={onClose} className="p-1.5 text-text-dim hover:text-text-main hover:bg-surface-raised rounded-lg transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-5">
            {/* API Key */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 pr-10 font-mono placeholder:text-text-dim/40 transition-colors"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted transition-colors cursor-pointer"
                >
                  {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Model Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase">AI Model</label>
                <button
                  onClick={loadModels}
                  disabled={!apiKey || isLoadingModels}
                  className="p-1 text-text-dim hover:text-blue-400 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="Refresh models"
                >
                  <RefreshCw size={13} className={isLoadingModels ? 'animate-spin' : ''} />
                </button>
              </div>
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                disabled={isLoadingModels || !apiKey}
                className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 disabled:opacity-40 appearance-none cursor-pointer transition-colors"
              >
                {isLoadingModels ? (
                  <option>Loading models...</option>
                ) : availableModels.length > 0 ? (
                  availableModels.map(m => (
                    <option key={m.name} value={m.name}>
                      {m.displayName} ({m.name.replace('models/', '')})
                    </option>
                  ))
                ) : (
                  <option value={selectedModel}>{selectedModel}</option>
                )}
              </select>
            </div>

            {/* AI Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-raised border border-border-subtle">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-text-main">AI Summary Generation</span>
                <span className="text-[11px] text-text-dim mt-0.5">Automatically enrich nodes with AI analysis</span>
              </div>
              <div onClick={() => setEnableAi(!enableAi)} className={`nebula-switch ${enableAi ? 'active' : ''}`} />
            </div>

            {/* Preferred IDE */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Preferred IDE</label>
              <select
                value={preferredIde}
                onChange={e => setPreferredIde(e.target.value)}
                className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 appearance-none cursor-pointer transition-colors"
              >
                <option value="code">VS Code (code)</option>
                <option value="cursor">Cursor (cursor)</option>
                <option value="idea">IntelliJ IDEA (idea)</option>
                <option value="webstorm">WebStorm (webstorm)</option>
                <option value="nvim">Neovim (nvim)</option>
              </select>
            </div>

            {/* Test Connection */}
            {apiKey && (
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border ${
                  testStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : testStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-surface-raised border-border hover:border-blue-500/30 text-text-muted hover:text-text-main'
                }`}
              >
                <Zap size={14} />
                {testStatus === 'testing' ? 'Testing...'
                  : testStatus === 'success' ? 'Connection Successful!'
                  : testStatus === 'error' ? 'Connection Failed'
                  : 'Test Connection'}
              </button>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border-subtle">
            <button onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-main transition-colors cursor-pointer rounded-lg">
              Cancel
            </button>
            <button onClick={handleSave} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
