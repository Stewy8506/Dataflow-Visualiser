import { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw, Zap, Settings2, Sparkles, LayoutGrid, Keyboard, GitBranch, Filter } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

interface SettingsModalProps {
  apiKey: string;
  setApiKey: (val: string) => void;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  enableAi: boolean;
  setEnableAi: (val: boolean) => void;
  preferredIde: string;
  setPreferredIde: (val: string) => void;
  aiProvider: string;
  setAiProvider: (val: string) => void;
  localBaseUrl: string;
  setLocalBaseUrl: (val: string) => void;
  isLightMode: boolean;
  setIsLightMode: (val: boolean) => void;
  startupBehavior: 'welcome' | 'restore';
  setStartupBehavior: (val: 'welcome' | 'restore') => void;
  onClose: () => void;
}

type SettingsTab = 'general' | 'graph' | 'ai' | 'editor' | 'keybindings';

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
  aiProvider, setAiProvider,
  localBaseUrl, setLocalBaseUrl,
  isLightMode, setIsLightMode,
  startupBehavior, setStartupBehavior,
  onClose,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [availableModels, setAvailableModels] = useState<GeminiModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const [theme, setTheme] = useState(isLightMode ? 'light' : 'dark');
  
  const { customFilters, setCustomFilters } = useAppStore();
  const { layoutDirection, setLayoutDirection, nodesep, setNodesep, ranksep, setRanksep } = useAppStore();

  useEffect(() => {
    if (apiKey) loadModels();
  }, [apiKey]);

  const loadModels = async () => {
    if (aiProvider === 'gemini' && !apiKey) return;
    setIsLoadingModels(true);
    try {
      if (aiProvider === 'gemini') {
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
      } else {
        // OpenAI compatible /v1/models endpoint
        const res = await fetch(`${localBaseUrl}/models`);
        const data = await res.json();
        if (data.data) {
          const models: GeminiModel[] = data.data.map((m: any) => ({
            name: m.id,
            displayName: m.id,
            supportedGenerationMethods: ['generateContent']
          }));
          setAvailableModels(models);
          if (!selectedModel || !models.find(m => m.name === selectedModel)) {
            if (models.length > 0) setSelectedModel(models[0].name);
          }
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
      if (aiProvider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();
        setTestStatus(data.models?.length > 0 ? 'success' : 'error');
      } else {
        const res = await fetch(`${localBaseUrl}/models`);
        const data = await res.json();
        setTestStatus(data.data?.length > 0 ? 'success' : 'error');
      }
    } catch {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const handleSave = () => {
    setIsLightMode(theme === 'light');
    onClose();
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'graph', label: 'Graph Engine', icon: LayoutGrid },
    { id: 'ai', label: 'AI Capabilities', icon: Sparkles },
    { id: 'editor', label: 'Editor & Git', icon: GitBranch },
    { id: 'keybindings', label: 'Keybindings', icon: Keyboard },
  ];

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center nebula-fade-in">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl h-[600px] flex rounded-xl border border-border bg-surface shadow-2xl overflow-hidden nebula-slide-up">
        {/* Settings Sidebar */}
        <div className="w-56 bg-surface-raised border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-bold text-text-main tracking-tight">Settings</h2>
          </div>
          <div className="p-2 space-y-1 flex-1 overflow-y-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === tab.id 
                      ? 'bg-blue-600 text-white' 
                      : 'text-text-dim hover:text-text-main hover:bg-surface'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 flex flex-col bg-background">
          <div className="flex-1 overflow-y-auto p-8">
            <h3 className="text-xl font-bold text-text-main mb-6">
              {tabs.find(t => t.id === activeTab)?.label}
            </h3>

            {activeTab === 'general' && (
              <div className="space-y-6 max-w-lg">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Theme</label>
                  <select
                    value={theme}
                    onChange={e => setTheme(e.target.value)}
                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                  >
                    <option value="dark">Dark Mode</option>
                    <option value="light">Light Mode</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Startup Behavior</label>
                  <select
                    value={startupBehavior}
                    onChange={e => setStartupBehavior(e.target.value as 'welcome' | 'restore')}
                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                  >
                    <option value="welcome">Show Welcome Screen</option>
                    <option value="restore">Restore last workspace</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="space-y-6 max-w-lg">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Layout Direction</label>
                  <select
                    value={layoutDirection}
                    onChange={e => setLayoutDirection(e.target.value as any)}
                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                  >
                    <option value="TB">Top to Bottom (Vertical)</option>
                    <option value="LR">Left to Right (Horizontal)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase flex justify-between">
                    <span>Node Separation</span>
                    <span className="text-text-main">{nodesep}px</span>
                  </label>
                  <input 
                    type="range" min="30" max="200" step="10"
                    value={nodesep} onChange={e => setNodesep(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase flex justify-between">
                    <span>Rank Separation</span>
                    <span className="text-text-main">{ranksep}px</span>
                  </label>
                  <input 
                    type="range" min="100" max="800" step="50"
                    value={ranksep} onChange={e => setRanksep(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase flex items-center gap-1.5 mb-1">
                    <Filter size={12} />
                    Custom Ignore Patterns
                  </label>
                  <input
                    type="text"
                    value={customFilters}
                    onChange={e => setCustomFilters(e.target.value)}
                    placeholder="e.g. scripts/, assets/, *.css"
                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 placeholder:text-text-dim/40"
                  />
                  <p className="text-[10px] text-text-dim">
                    Comma-separated list of folders or file extensions to hide from the graph.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-6 max-w-lg">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">AI Provider</label>
                  <select
                    value={aiProvider}
                    onChange={e => setAiProvider(e.target.value)}
                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                  >
                    <option value="gemini">Google Gemini (Cloud)</option>
                    <option value="local">Local Model (OpenAI Compatible API)</option>
                  </select>
                </div>

                {aiProvider === 'gemini' ? (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Google AI API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 pr-10 font-mono placeholder:text-text-dim/40"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors cursor-pointer"
                      >
                        {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Local API Base URL</label>
                    <input
                      type="text"
                      value={localBaseUrl}
                      onChange={e => setLocalBaseUrl(e.target.value)}
                      placeholder="http://localhost:1234/v1"
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 font-mono placeholder:text-text-dim/40"
                    />
                    <p className="text-[10px] text-text-dim mt-1">E.g. http://localhost:1234/v1 for LMStudio or http://localhost:11434/v1 for Ollama</p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase">AI Model</label>
                    <button
                      onClick={loadModels}
                      disabled={isLoadingModels || (aiProvider === 'gemini' && !apiKey) || (aiProvider === 'local' && !localBaseUrl)}
                      className="p-1 text-text-dim hover:text-blue-400 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <RefreshCw size={13} className={isLoadingModels ? 'animate-spin' : ''} />
                    </button>
                  </div>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    disabled={isLoadingModels || (aiProvider === 'gemini' && !apiKey) || (aiProvider === 'local' && !localBaseUrl)}
                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 disabled:opacity-40 appearance-none cursor-pointer"
                  >
                    {isLoadingModels ? (
                      <option>Loading models...</option>
                    ) : availableModels.length > 0 ? (
                      availableModels.map(m => (
                        <option key={m.name} value={m.name}>
                          {m.displayName} {aiProvider === 'gemini' ? `(${m.name.replace('models/', '')})` : ''}
                        </option>
                      ))
                    ) : (
                      <option value={selectedModel}>{selectedModel}</option>
                    )}
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-surface-raised border border-border">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-main">AI Summarization</span>
                    <span className="text-xs text-text-dim mt-1">Automatically enrich nodes with AI insights</span>
                  </div>
                  <div onClick={() => setEnableAi(!enableAi)} className={`nebula-switch ${enableAi ? 'active' : ''}`} />
                </div>

                {((aiProvider === 'gemini' && apiKey) || (aiProvider === 'local' && localBaseUrl)) && (
                  <button
                    onClick={handleTestConnection}
                    disabled={testStatus === 'testing'}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border ${
                      testStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : testStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-surface border-border hover:border-blue-500/30 text-text-muted hover:text-text-main'
                    }`}
                  >
                    <Zap size={14} />
                    {testStatus === 'testing' ? 'Testing Connection...'
                      : testStatus === 'success' ? 'Connection Successful!'
                      : testStatus === 'error' ? 'Connection Failed'
                      : 'Test Connection'}
                  </button>
                )}
              </div>
            )}

            {activeTab === 'editor' && (
              <div className="space-y-6 max-w-lg">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Preferred IDE</label>
                  <select
                    value={preferredIde}
                    onChange={e => setPreferredIde(e.target.value)}
                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                  >
                    <option value="code">VS Code (code)</option>
                    <option value="cursor">Cursor (cursor)</option>
                    <option value="idea">IntelliJ IDEA (idea)</option>
                    <option value="webstorm">WebStorm (webstorm)</option>
                    <option value="nvim">Neovim (nvim)</option>
                  </select>
                  <p className="text-xs text-text-dim mt-1.5">This IDE will be used when opening files from the visualizer.</p>
                </div>

                <div className="p-4 rounded-xl bg-surface-raised border border-border border-dashed">
                  <h4 className="text-sm font-semibold text-text-main mb-2">Git Integration</h4>
                  <p className="text-xs text-text-dim mb-4">Git features are automatically detected from the workspace root.</p>
                  <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
                    <span className="text-sm">Auto-fetch Churn Data</span>
                    <div className="nebula-switch active pointer-events-none" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'keybindings' && (
              <div className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-surface-raised border border-border">
                  <div className="text-sm text-text-main">Command Palette</div>
                  <div className="text-right"><kbd className="px-2 py-1 bg-surface border border-border rounded text-xs text-text-muted font-mono">Ctrl/Cmd + K</kbd></div>
                  
                  <div className="text-sm text-text-main">Search Nodes</div>
                  <div className="text-right"><kbd className="px-2 py-1 bg-surface border border-border rounded text-xs text-text-muted font-mono">Ctrl/Cmd + F</kbd></div>

                  <div className="text-sm text-text-main">Toggle Settings</div>
                  <div className="text-right"><kbd className="px-2 py-1 bg-surface border border-border rounded text-xs text-text-muted font-mono">Ctrl/Cmd + ,</kbd></div>
                </div>
                <p className="text-xs text-text-dim italic">Shortcuts are currently fixed to keep command access predictable.</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-sm text-text-muted hover:text-text-main transition-colors rounded-lg">
              Cancel
            </button>
            <button onClick={handleSave} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
