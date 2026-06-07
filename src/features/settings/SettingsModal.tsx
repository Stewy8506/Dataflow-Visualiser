import { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw, Zap, Settings2, Sparkles, LayoutGrid, Keyboard, GitBranch, Filter, Key } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useSettings } from '../../hooks/useSettings';

interface SettingsModalProps {
  settings: ReturnType<typeof useSettings>;
  onClose: () => void;
}

type SettingsTab = 'general' | 'graph' | 'ai' | 'editor' | 'keybindings';

interface GeminiModel {
  name: string;
  displayName: string;
  supportedGenerationMethods: string[];
}

export function SettingsModal({ settings, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [availableModels, setAvailableModels] = useState<GeminiModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Local state for shortcut recording
  const [recordingAction, setRecordingAction] = useState<string | null>(null);

  const { customFilters, setCustomFilters } = useAppStore();
  const { layoutDirection, setLayoutDirection, nodesep, setNodesep, ranksep, setRanksep } = useAppStore();

  useEffect(() => {
    loadModels();
  }, [settings.aiProvider, settings.apiKey]);

  // Key event capturing logic for shortcuts
  useEffect(() => {
    if (!recordingAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't record isolated modifier keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const keys: string[] = [];
      if (e.ctrlKey) keys.push('ctrl');
      if (e.metaKey) keys.push('meta');
      if (e.altKey) keys.push('alt');
      if (e.shiftKey) keys.push('shift');

      let mainKey = e.key.toLowerCase();
      // Translate spacebar
      if (mainKey === ' ') mainKey = 'space';
      keys.push(mainKey);

      const shortcut = keys.join('+');
      settings.setKeybindings({
        ...settings.keybindings,
        [recordingAction]: shortcut
      });
      setRecordingAction(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingAction, settings]);

  const loadModels = async () => {
    const provider = settings.aiProvider;
    const apiKey = settings.apiKey;
    
    if (provider !== 'local' && !apiKey) return;
    
    setIsLoadingModels(true);
    try {
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();
        if (data.models) {
          const generateContentModels: GeminiModel[] = data.models.filter((m: GeminiModel) =>
            m.supportedGenerationMethods?.includes('generateContent')
          );
          setAvailableModels(generateContentModels);
          if (!settings.selectedModel || !generateContentModels.find(m => m.name === settings.selectedModel)) {
            if (generateContentModels.length > 0) settings.setSelectedModel(generateContentModels[0].name);
          }
        }
      } else if (provider === 'anthropic') {
        const models = [
          { name: 'claude-3-5-sonnet-latest', displayName: 'Claude 3.5 Sonnet', supportedGenerationMethods: [] },
          { name: 'claude-3-5-haiku-latest', displayName: 'Claude 3.5 Haiku', supportedGenerationMethods: [] },
          { name: 'claude-3-opus-latest', displayName: 'Claude 3 Opus', supportedGenerationMethods: [] }
        ];
        setAvailableModels(models);
        if (!settings.selectedModel || !models.find(m => m.name === settings.selectedModel)) {
          settings.setSelectedModel(models[0].name);
        }
      } else if (provider === 'cohere') {
        const models = [
          { name: 'command-r-plus', displayName: 'Command R+', supportedGenerationMethods: [] },
          { name: 'command-r', displayName: 'Command R', supportedGenerationMethods: [] },
          { name: 'command-light', displayName: 'Command Light', supportedGenerationMethods: [] }
        ];
        setAvailableModels(models);
        if (!settings.selectedModel || !models.find(m => m.name === settings.selectedModel)) {
          settings.setSelectedModel(models[0].name);
        }
      } else {
        // OpenAI compatible endpoint (/models)
        let baseUrl = '';
        switch (provider) {
          case 'openai': baseUrl = 'https://api.openai.com/v1'; break;
          case 'groq': baseUrl = 'https://api.groq.com/openai/v1'; break;
          case 'deepseek': baseUrl = 'https://api.deepseek.com/v1'; break;
          case 'openrouter': baseUrl = 'https://openrouter.ai/api/v1'; break;
          case 'local': baseUrl = settings.localBaseUrl; break;
        }
        
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (provider !== 'local' && apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const res = await fetch(`${baseUrl}/models`, { headers });
        const data = await res.json();
        if (data.data) {
          const models: GeminiModel[] = data.data.map((m: any) => ({
            name: m.id,
            displayName: m.id,
            supportedGenerationMethods: []
          }));
          setAvailableModels(models);
          if (!settings.selectedModel || !models.find(m => m.name === settings.selectedModel)) {
            if (models.length > 0) settings.setSelectedModel(models[0].name);
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
    const provider = settings.aiProvider;
    const apiKey = settings.apiKey;
    
    try {
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();
        setTestStatus(data.models?.length > 0 ? 'success' : 'error');
      } else if (provider === 'anthropic' || provider === 'cohere') {
        setTestStatus(apiKey.length > 0 ? 'success' : 'error');
      } else {
        let baseUrl = '';
        switch (provider) {
          case 'openai': baseUrl = 'https://api.openai.com/v1'; break;
          case 'groq': baseUrl = 'https://api.groq.com/openai/v1'; break;
          case 'deepseek': baseUrl = 'https://api.deepseek.com/v1'; break;
          case 'openrouter': baseUrl = 'https://openrouter.ai/api/v1'; break;
          case 'local': baseUrl = settings.localBaseUrl; break;
        }
        
        const headers: Record<string, string> = {};
        if (provider !== 'local' && apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const res = await fetch(`${baseUrl}/models`, { headers });
        const data = await res.json();
        setTestStatus(data.data?.length > 0 || data.object === 'list' ? 'success' : 'error');
      }
    } catch {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'general', label: 'General & UI', icon: Settings2 },
    { id: 'graph', label: 'Graph Engine', icon: LayoutGrid },
    { id: 'ai', label: 'AI Capabilities', icon: Sparkles },
    { id: 'editor', label: 'Editor & Git', icon: GitBranch },
    { id: 'keybindings', label: 'Keyboard Shortcuts', icon: Keyboard },
  ];

  // Accent Preset Configuration
  const accentPresets = [
    { id: 'blue', color: '#3b82f6', label: 'Blue' },
    { id: 'emerald', color: '#10b981', label: 'Emerald' },
    { id: 'indigo', color: '#6366f1', label: 'Indigo' },
    { id: 'purple', color: '#a855f7', label: 'Purple' },
    { id: 'orange', color: '#f97316', label: 'Orange' },
    { id: 'amber', color: '#f59e0b', label: 'Amber' },
    { id: 'rose', color: '#f43f5e', label: 'Rose' }
  ];

  const fontsSans = [
    'Plus Jakarta Sans',
    'Inter',
    'Outfit',
    'Roboto'
  ];

  const fontsMono = [
    'JetBrains Mono',
    'Fira Code',
    'Source Code Pro'
  ];

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center nebula-fade-in">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl h-[620px] flex rounded-xl border border-border bg-surface shadow-2xl overflow-hidden nebula-slide-up">
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
                      ? 'bg-accent-primary text-white' 
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
              <div className="space-y-6 max-w-xl">
                {/* Theme Selector */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Theme Mode</label>
                    <select
                      value={settings.isLightMode ? 'light' : 'dark'}
                      onChange={e => settings.setIsLightMode(e.target.value === 'light')}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary appearance-none cursor-pointer"
                    >
                      <option value="dark">Dark Mode</option>
                      <option value="light">Light Mode</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Startup Behavior</label>
                    <select
                      value={settings.startupBehavior}
                      onChange={e => settings.setStartupBehavior(e.target.value as 'welcome' | 'restore')}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary appearance-none cursor-pointer"
                    >
                      <option value="welcome">Show Welcome Screen</option>
                      <option value="restore">Restore last workspace</option>
                    </select>
                  </div>
                </div>

                {/* Accent Presets */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Accent Theme Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {accentPresets.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => settings.setAccentColor(preset.id)}
                        className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer`}
                        style={{ 
                          backgroundColor: preset.color, 
                          borderColor: settings.accentColor === preset.id ? 'var(--color-text-main)' : 'transparent',
                          boxShadow: settings.accentColor === preset.id ? `0 0 10px ${preset.color}` : 'none'
                        }}
                        title={preset.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Typography overrides */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Sans Font Family</label>
                    <select
                      value={settings.sansFont}
                      onChange={e => settings.setSansFont(e.target.value)}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary appearance-none cursor-pointer"
                    >
                      {fontsSans.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Mono Font Family</label>
                    <select
                      value={settings.monoFont}
                      onChange={e => settings.setMonoFont(e.target.value)}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary appearance-none cursor-pointer"
                    >
                      {fontsMono.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grid Background presets */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Flow Grid Pattern</label>
                    <select
                      value={settings.gridPattern}
                      onChange={e => settings.setGridPattern(e.target.value as any)}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary appearance-none cursor-pointer"
                    >
                      <option value="dots">Dots Pattern</option>
                      <option value="lines">Lines Pattern</option>
                      <option value="none">None (Solid Color)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase flex justify-between">
                      <span>Grid Opacity</span>
                      <span className="text-text-main">{Math.round(settings.gridOpacity * 100)}%</span>
                    </label>
                    <input 
                      type="range" min="0.05" max="0.5" step="0.01"
                      value={settings.gridOpacity} onChange={e => settings.setGridOpacity(Number(e.target.value))}
                      className="w-full accent-accent-primary cursor-pointer mt-3"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="space-y-6 max-w-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Layout Direction</label>
                    <select
                      value={layoutDirection}
                      onChange={e => setLayoutDirection(e.target.value as any)}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary appearance-none cursor-pointer"
                    >
                      <option value="TB">Top to Bottom (Vertical)</option>
                      <option value="LR">Left to Right (Horizontal)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Edge Rendering Format</label>
                    <select
                      value={settings.edgeType}
                      onChange={e => settings.setEdgeType(e.target.value as any)}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary appearance-none cursor-pointer"
                    >
                      <option value="bezier">Bezier Curve</option>
                      <option value="straight">Straight Lines</option>
                      <option value="smoothstep">Smooth Step Boxed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase flex justify-between">
                      <span>Node Horizontal Sep</span>
                      <span className="text-text-main">{nodesep}px</span>
                    </label>
                    <input 
                      type="range" min="30" max="200" step="10"
                      value={nodesep} onChange={e => setNodesep(Number(e.target.value))}
                      className="w-full accent-accent-primary cursor-pointer mt-3"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase flex justify-between">
                      <span>Rank Layer Sep</span>
                      <span className="text-text-main">{ranksep}px</span>
                    </label>
                    <input 
                      type="range" min="100" max="800" step="50"
                      value={ranksep} onChange={e => setRanksep(Number(e.target.value))}
                      className="w-full accent-accent-primary cursor-pointer mt-3"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Default Node Scale</label>
                    <select
                      value={settings.defaultNodeScale}
                      onChange={e => settings.setDefaultNodeScale(e.target.value as any)}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary appearance-none cursor-pointer"
                    >
                      <option value="small">Compact (Small)</option>
                      <option value="normal">Default (Medium)</option>
                      <option value="large">Spacious (Large)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase flex justify-between">
                      <span>Edge Animation Speed</span>
                      <span className="text-text-main">{settings.edgeAnimationSpeed}x</span>
                    </label>
                    <input 
                      type="range" min="0.5" max="3" step="0.1"
                      value={settings.edgeAnimationSpeed} onChange={e => settings.setEdgeAnimationSpeed(Number(e.target.value))}
                      className="w-full accent-accent-primary cursor-pointer mt-3"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-surface-raised border border-border pt-2 border-t border-border-subtle">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-main">Auto-fit Canvas View</span>
                    <span className="text-xs text-text-dim mt-1">Automatically align and center graph nodes upon loading</span>
                  </div>
                  <div onClick={() => settings.setAutoFitOnLoad(!settings.autoFitOnLoad)} className={`nebula-switch ${settings.autoFitOnLoad ? 'active' : ''}`} />
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
                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary placeholder:text-text-dim/40"
                  />
                  <p className="text-[10px] text-text-dim">
                    Comma-separated list of folders or file extensions to hide from the graph.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-6 max-w-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">AI Provider</label>
                    <select
                      value={settings.aiProvider}
                      onChange={e => settings.setAiProvider(e.target.value)}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary appearance-none cursor-pointer"
                    >
                      <option value="gemini">Google Gemini (Cloud)</option>
                      <option value="openai">OpenAI (Official)</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="groq">Groq (Ultra-fast)</option>
                      <option value="deepseek">DeepSeek Coder</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="cohere">Cohere Command</option>
                      <option value="local">Local Model (OpenAI Compatible API)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">AI Sidebar Placement</label>
                    <select
                      value={settings.aiSidebarPlacement}
                      onChange={e => settings.setAiSidebarPlacement(e.target.value as any)}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary appearance-none cursor-pointer"
                    >
                      <option value="right">Right Side Panel</option>
                      <option value="left">Left Side Panel</option>
                    </select>
                  </div>
                </div>

                {settings.aiProvider === 'gemini' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Google AI API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.geminiApiKey}
                        onChange={e => settings.setGeminiApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary pr-10 font-mono placeholder:text-text-dim/40"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors cursor-pointer"
                      >
                        {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                {settings.aiProvider === 'openai' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">OpenAI API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.openaiApiKey}
                        onChange={e => settings.setOpenaiApiKey(e.target.value)}
                        placeholder="sk-proj-..."
                        className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary pr-10 font-mono placeholder:text-text-dim/40"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors cursor-pointer"
                      >
                        {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                {settings.aiProvider === 'anthropic' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Anthropic API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.anthropicApiKey}
                        onChange={e => settings.setAnthropicApiKey(e.target.value)}
                        placeholder="sk-ant-..."
                        className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary pr-10 font-mono placeholder:text-text-dim/40"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors cursor-pointer"
                      >
                        {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                {settings.aiProvider === 'groq' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Groq API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.groqApiKey}
                        onChange={e => settings.setGroqApiKey(e.target.value)}
                        placeholder="gsk_..."
                        className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary pr-10 font-mono placeholder:text-text-dim/40"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors cursor-pointer"
                      >
                        {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                {settings.aiProvider === 'deepseek' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">DeepSeek API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.deepseekApiKey}
                        onChange={e => settings.setDeepseekApiKey(e.target.value)}
                        placeholder="ds-..."
                        className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary pr-10 font-mono placeholder:text-text-dim/40"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors cursor-pointer"
                      >
                        {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                {settings.aiProvider === 'openrouter' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">OpenRouter API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.openrouterApiKey}
                        onChange={e => settings.setOpenrouterApiKey(e.target.value)}
                        placeholder="sk-or-..."
                        className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary pr-10 font-mono placeholder:text-text-dim/40"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors cursor-pointer"
                      >
                        {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                {settings.aiProvider === 'cohere' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Cohere API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.cohereApiKey}
                        onChange={e => settings.setCohereApiKey(e.target.value)}
                        placeholder="Enter Cohere API Key..."
                        className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary pr-10 font-mono placeholder:text-text-dim/40"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors cursor-pointer"
                      >
                        {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                {settings.aiProvider === 'local' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Local API Base URL</label>
                    <input
                      type="text"
                      value={settings.localBaseUrl}
                      onChange={e => settings.setLocalBaseUrl(e.target.value)}
                      placeholder="http://localhost:1234/v1"
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary font-mono placeholder:text-text-dim/40"
                    />
                    <p className="text-[10px] text-text-dim mt-1">E.g. http://localhost:1234/v1 for LMStudio or http://localhost:11434/v1 for Ollama</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase">AI Model</label>
                      <button
                        onClick={loadModels}
                        disabled={isLoadingModels || (settings.aiProvider !== 'local' && !settings.apiKey) || (settings.aiProvider === 'local' && !settings.localBaseUrl)}
                        className="p-1 text-text-dim hover:text-blue-400 disabled:opacity-30 transition-colors cursor-pointer"
                      >
                        <RefreshCw size={13} className={isLoadingModels ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <select
                      value={settings.selectedModel}
                      onChange={e => settings.setSelectedModel(e.target.value)}
                      disabled={isLoadingModels || (settings.aiProvider !== 'local' && !settings.apiKey) || (settings.aiProvider === 'local' && !settings.localBaseUrl)}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary disabled:opacity-40 appearance-none cursor-pointer"
                    >
                      {isLoadingModels ? (
                        <option>Loading models...</option>
                      ) : availableModels.length > 0 ? (
                        availableModels.map(m => (
                          <option key={m.name} value={m.name}>
                            {m.displayName} {settings.aiProvider === 'gemini' ? `(${m.name.replace('models/', '')})` : ''}
                          </option>
                        ))
                      ) : (
                        <option value={settings.selectedModel}>{settings.selectedModel}</option>
                      )}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase flex justify-between">
                      <span>Model Temperature</span>
                      <span className="text-text-main">{settings.aiTemperature}</span>
                    </label>
                    <input 
                      type="range" min="0" max="1" step="0.05"
                      value={settings.aiTemperature} onChange={e => settings.setAiTemperature(Number(e.target.value))}
                      className="w-full accent-accent-primary cursor-pointer mt-3"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-surface-raised border border-border">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-main">AI Summarization</span>
                    <span className="text-xs text-text-dim mt-1">Automatically enrich nodes with AI insights</span>
                  </div>
                  <div onClick={() => settings.setEnableAi(!settings.enableAi)} className={`nebula-switch ${settings.enableAi ? 'active' : ''}`} />
                </div>

                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Custom Code Summarization System Prompt</label>
                  <textarea
                    value={settings.customSummaryPrompt}
                    onChange={e => settings.setCustomSummaryPrompt(e.target.value)}
                    placeholder="Enter instructions for how Gemini should explain your code..."
                    rows={4}
                    className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-xs text-text-main font-mono outline-none focus:border-accent-primary placeholder:text-text-dim/40 resize-y"
                  />
                  <p className="text-[10px] text-text-dim">
                     Leave blank to use standard structural descriptions.
                  </p>
                </div>

                {((settings.aiProvider === 'local' && settings.localBaseUrl) || (settings.aiProvider !== 'local' && settings.apiKey)) && (
                  <button
                    onClick={handleTestConnection}
                    disabled={testStatus === 'testing'}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border ${
                      testStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : testStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-surface border-border hover:border-accent-primary/30 text-text-muted hover:text-text-main'
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
              <div className="space-y-6 max-w-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Preferred IDE</label>
                    <select
                      value={settings.preferredIde}
                      onChange={e => settings.setPreferredIde(e.target.value)}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary appearance-none cursor-pointer"
                    >
                      <option value="code">VS Code (code)</option>
                      <option value="cursor">Cursor (cursor)</option>
                      <option value="idea">IntelliJ IDEA (idea)</option>
                      <option value="webstorm">WebStorm (webstorm)</option>
                      <option value="nvim">Neovim (nvim)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Custom CLI Override Command</label>
                    <input
                      type="text"
                      value={settings.customIdeCommand}
                      onChange={e => settings.setCustomIdeCommand(e.target.value)}
                      placeholder="e.g. nvim, code-insiders"
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary placeholder:text-text-dim/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-text-dim tracking-wider uppercase block">Git History Analysis Limit</label>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={settings.gitHistoryLimit}
                      onChange={e => settings.setGitHistoryLimit(Number(e.target.value))}
                      className="w-full bg-surface-raised border border-border rounded-lg px-4 py-2.5 text-sm text-text-main outline-none focus:border-accent-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-surface-raised border border-border mt-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-text-main">Deletion Alerts</span>
                      <span className="text-xs text-text-dim mt-1">Prompt before deleting dead code files</span>
                    </div>
                    <div onClick={() => settings.setShowDeleteConfirmation(!settings.showDeleteConfirmation)} className={`nebula-switch ${settings.showDeleteConfirmation ? 'active' : ''}`} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'keybindings' && (
              <div className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-surface-raised border border-border items-center">
                  <div className="text-sm font-semibold text-text-dim">Action</div>
                  <div className="text-sm font-semibold text-text-dim text-center">Shortcut</div>
                  <div className="text-sm font-semibold text-text-dim text-right">Customize</div>

                  <div className="text-sm text-text-main">Command Palette</div>
                  <div className="text-center">
                    <kbd className="px-2 py-1 bg-surface border border-border rounded text-xs text-text-muted font-mono uppercase">
                      {settings.keybindings.commandPalette}
                    </kbd>
                  </div>
                  <div className="text-right">
                    <button 
                      onClick={() => setRecordingAction('commandPalette')}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                        recordingAction === 'commandPalette' 
                          ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                          : 'bg-surface hover:bg-surface-raised border-border text-text-main'
                      }`}
                    >
                      {recordingAction === 'commandPalette' ? 'Press keys...' : 'Record'}
                    </button>
                  </div>

                  <div className="text-sm text-text-main">Search Nodes</div>
                  <div className="text-center">
                    <kbd className="px-2 py-1 bg-surface border border-border rounded text-xs text-text-muted font-mono uppercase">
                      {settings.keybindings.searchNodes}
                    </kbd>
                  </div>
                  <div className="text-right">
                    <button 
                      onClick={() => setRecordingAction('searchNodes')}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                        recordingAction === 'searchNodes' 
                          ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                          : 'bg-surface hover:bg-surface-raised border-border text-text-main'
                      }`}
                    >
                      {recordingAction === 'searchNodes' ? 'Press keys...' : 'Record'}
                    </button>
                  </div>

                  <div className="text-sm text-text-main">Toggle Settings</div>
                  <div className="text-center">
                    <kbd className="px-2 py-1 bg-surface border border-border rounded text-xs text-text-muted font-mono uppercase">
                      {settings.keybindings.toggleSettings}
                    </kbd>
                  </div>
                  <div className="text-right">
                    <button 
                      onClick={() => setRecordingAction('toggleSettings')}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                        recordingAction === 'toggleSettings' 
                          ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                          : 'bg-surface hover:bg-surface-raised border-border text-text-main'
                      }`}
                    >
                      {recordingAction === 'toggleSettings' ? 'Press keys...' : 'Record'}
                    </button>
                  </div>
                </div>
                
                {recordingAction && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
                    <Key size={14} className="animate-spin" />
                    <span>Recording... Press your keyboard keys together. Isolated modifier keys (Ctrl, Alt, etc.) are ignored until paired. Click outside to cancel.</span>
                  </div>
                )}
                
                <p className="text-xs text-text-dim italic">Press your customized shortcut combination in the workspace. E.g. <code>ctrl+shift+p</code> or <code>alt+s</code>.</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2.5 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-lg text-sm font-medium shadow-lg shadow-accent-primary/20 transition-all hover:-translate-y-0.5 cursor-pointer">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
