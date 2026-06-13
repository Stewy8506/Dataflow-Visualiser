import { useState, useEffect } from 'react';
import { load } from '@tauri-apps/plugin-store';

const defaultSettings = { 
  preferredIde: 'code', 
  gemini_api_key: '', 
  gemini_model: 'models/gemini-1.5-flash',
  openai_api_key: '',
  openai_model: 'gpt-4o-mini',
  anthropic_api_key: '',
  anthropic_model: 'claude-3-5-sonnet-latest',
  groq_api_key: '',
  groq_model: 'llama-3.3-70b-versatile',
  deepseek_api_key: '',
  deepseek_model: 'deepseek-coder',
  openrouter_api_key: '',
  openrouter_model: 'meta-llama/llama-3.3-70b-instruct',
  cohere_api_key: '',
  cohere_model: 'command-r-plus',
  enable_ai_summary: true,
  theme: 'dark',
  ai_provider: 'gemini',
  local_base_url: 'http://localhost:1234/v1',
  startup_behavior: 'welcome',
  accentColor: 'blue',
  sansFont: 'Plus Jakarta Sans',
  monoFont: 'JetBrains Mono',
  gridPattern: 'dots',
  gridOpacity: 0.14,
  edgeType: 'bezier',
  edgeAnimationSpeed: 1,
  autoFitOnLoad: true,
  defaultNodeScale: 'normal',
  aiTemperature: 0.2,
  customSummaryPrompt: '',
  aiSidebarPlacement: 'right',
  customIdeCommand: '',
  gitHistoryLimit: 100,
  showDeleteConfirmation: true,
  keybindings: { commandPalette: 'ctrl+k', searchNodes: 'ctrl+f', toggleSettings: 'ctrl+,' }
};

export function useSettings() {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('models/gemini-1.5-flash');
  
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [anthropicModel, setAnthropicModel] = useState('claude-3-5-sonnet-latest');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [deepseekModel, setDeepseekModel] = useState('deepseek-coder');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [openrouterModel, setOpenrouterModel] = useState('meta-llama/llama-3.3-70b-instruct');
  const [cohereApiKey, setCohereApiKey] = useState('');
  const [cohereModel, setCohereModel] = useState('command-r-plus');

  const [enableAi, setEnableAi] = useState(true);
  const [isLightMode, setIsLightMode] = useState(false);
  const [preferredIde, setPreferredIde] = useState('code');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [localBaseUrl, setLocalBaseUrl] = useState('http://localhost:1234/v1');
  const [startupBehavior, setStartupBehavior] = useState<'welcome' | 'restore'>('welcome');
  
  const [accentColor, setAccentColor] = useState('blue');
  const [sansFont, setSansFont] = useState('Plus Jakarta Sans');
  const [monoFont, setMonoFont] = useState('JetBrains Mono');
  const [gridPattern, setGridPattern] = useState<'dots' | 'lines' | 'none'>('dots');
  const [gridOpacity, setGridOpacity] = useState(0.14);
  
  const [edgeType, setEdgeType] = useState<'bezier' | 'straight' | 'smoothstep'>('bezier');
  const [edgeAnimationSpeed, setEdgeAnimationSpeed] = useState(1);
  const [autoFitOnLoad, setAutoFitOnLoad] = useState(true);
  const [defaultNodeScale, setDefaultNodeScale] = useState<'small' | 'normal' | 'large'>('normal');
  
  const [aiTemperature, setAiTemperature] = useState(0.2);
  const [customSummaryPrompt, setCustomSummaryPrompt] = useState('');
  const [aiSidebarPlacement, setAiSidebarPlacement] = useState<'left' | 'right'>('right');
  
  const [customIdeCommand, setCustomIdeCommand] = useState('');
  const [gitHistoryLimit, setGitHistoryLimit] = useState(100);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(true);
  const [keybindings, setKeybindings] = useState<Record<string, string>>({
    commandPalette: 'ctrl+k',
    searchNodes: 'ctrl+f',
    toggleSettings: 'ctrl+,'
  });

  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted settings from Tauri store
  useEffect(() => {
    load('settings.json', { autoSave: true, defaults: defaultSettings }).then(store => {
      Promise.all([
        store.get<string>('preferredIde'),
        store.get<string>('gemini_api_key'),
        store.get<string>('gemini_model'),
        store.get<string>('openai_api_key'),
        store.get<string>('openai_model'),
        store.get<string>('anthropic_api_key'),
        store.get<string>('anthropic_model'),
        store.get<string>('groq_api_key'),
        store.get<string>('groq_model'),
        store.get<string>('deepseek_api_key'),
        store.get<string>('deepseek_model'),
        store.get<string>('openrouter_api_key'),
        store.get<string>('openrouter_model'),
        store.get<string>('cohere_api_key'),
        store.get<string>('cohere_model'),
        store.get<boolean>('enable_ai_summary'),
        store.get<string>('theme'),
        store.get<string>('ai_provider'),
        store.get<string>('local_base_url'),
        store.get<'welcome' | 'restore'>('startup_behavior'),
        store.get<string>('accentColor'),
        store.get<string>('sansFont'),
        store.get<string>('monoFont'),
        store.get<'dots' | 'lines' | 'none'>('gridPattern'),
        store.get<number>('gridOpacity'),
        store.get<'bezier' | 'straight' | 'smoothstep'>('edgeType'),
        store.get<number>('edgeAnimationSpeed'),
        store.get<boolean>('autoFitOnLoad'),
        store.get<'small' | 'normal' | 'large'>('defaultNodeScale'),
        store.get<number>('aiTemperature'),
        store.get<string>('customSummaryPrompt'),
        store.get<'left' | 'right'>('aiSidebarPlacement'),
        store.get<string>('customIdeCommand'),
        store.get<number>('gitHistoryLimit'),
        store.get<boolean>('showDeleteConfirmation'),
        store.get<Record<string, string>>('keybindings')
      ]).then(([
        ide, gKey, gModel, oKey, oModel, aKey, aModel, grKey, grModel, dsKey, dsModel, orKey, orModel, coKey, coModel,
        enable, theme, provider, baseUrl, startup, accent, sans, mono, gridPat, gridOp, edge, speed, autoFit, scale, temp, prompt, sidebar, ideCmd, gitLim, confirmDel, keys
      ]) => {
        if (ide !== undefined && ide !== null) setPreferredIde(ide);
        if (gKey !== undefined && gKey !== null) setApiKey(gKey);
        if (gModel !== undefined && gModel !== null) setSelectedModel(gModel);
        if (oKey !== undefined && oKey !== null) setOpenaiApiKey(oKey);
        if (oModel !== undefined && oModel !== null) setOpenaiModel(oModel);
        if (aKey !== undefined && aKey !== null) setAnthropicApiKey(aKey);
        if (aModel !== undefined && aModel !== null) setAnthropicModel(aModel);
        if (grKey !== undefined && grKey !== null) setGroqApiKey(grKey);
        if (grModel !== undefined && grModel !== null) setGroqModel(grModel);
        if (dsKey !== undefined && dsKey !== null) setDeepseekApiKey(dsKey);
        if (dsModel !== undefined && dsModel !== null) setDeepseekModel(dsModel);
        if (orKey !== undefined && orKey !== null) setOpenrouterApiKey(orKey);
        if (orModel !== undefined && orModel !== null) setOpenrouterModel(orModel);
        if (coKey !== undefined && coKey !== null) setCohereApiKey(coKey);
        if (coModel !== undefined && coModel !== null) setCohereModel(coModel);
        
        if (enable !== undefined && enable !== null) setEnableAi(enable);
        if (theme !== undefined && theme !== null) setIsLightMode(theme === 'light');
        if (provider !== undefined && provider !== null) setAiProvider(provider);
        if (baseUrl !== undefined && baseUrl !== null) setLocalBaseUrl(baseUrl);
        if (startup === 'welcome' || startup === 'restore') setStartupBehavior(startup);
        
        if (accent !== undefined && accent !== null) setAccentColor(accent);
        if (sans !== undefined && sans !== null) setSansFont(sans);
        if (mono !== undefined && mono !== null) setMonoFont(mono);
        if (gridPat !== undefined && gridPat !== null) setGridPattern(gridPat);
        if (gridOp !== undefined && gridOp !== null) setGridOpacity(gridOp);
        
        if (edge !== undefined && edge !== null) setEdgeType(edge);
        if (speed !== undefined && speed !== null) setEdgeAnimationSpeed(speed);
        if (autoFit !== undefined && autoFit !== null) setAutoFitOnLoad(autoFit);
        if (scale !== undefined && scale !== null) setDefaultNodeScale(scale);
        
        if (temp !== undefined && temp !== null) setAiTemperature(temp);
        if (prompt !== undefined && prompt !== null) setCustomSummaryPrompt(prompt);
        if (sidebar !== undefined && sidebar !== null) setAiSidebarPlacement(sidebar);
        
        if (ideCmd !== undefined && ideCmd !== null) setCustomIdeCommand(ideCmd);
        if (gitLim !== undefined && gitLim !== null) setGitHistoryLimit(gitLim);
        if (confirmDel !== undefined && confirmDel !== null) setShowDeleteConfirmation(confirmDel);
        if (keys !== undefined && keys !== null) setKeybindings(keys);
        
        setIsLoaded(true);
      });
    });
  }, []);

  const saveSetting = async (key: string, value: any) => {
    const store = await load('settings.json', { autoSave: true, defaults: defaultSettings });
    await store.set(key, value);
    await store.save();
  };

  // Sync theme to DOM
  useEffect(() => {
    if (!isLoaded) return;
    saveSetting('theme', isLightMode ? 'light' : 'dark');
    if (isLightMode) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [isLightMode, isLoaded]);

  // Sync accent color to DOM
  useEffect(() => {
    if (!isLoaded) return;
    const root = document.documentElement;
    const ACCENT_PRESETS: Record<string, { main: string; hover: string; light: string }> = {
      blue: { main: '#3b82f6', hover: '#2563eb', light: 'rgba(59, 130, 246, 0.15)' },
      emerald: { main: '#10b981', hover: '#059669', light: 'rgba(16, 185, 129, 0.15)' },
      indigo: { main: '#6366f1', hover: '#4f46e5', light: 'rgba(99, 102, 241, 0.15)' },
      purple: { main: '#a855f7', hover: '#9333ea', light: 'rgba(168, 85, 247, 0.15)' },
      orange: { main: '#f97316', hover: '#ea580c', light: 'rgba(249, 115, 22, 0.15)' },
      amber: { main: '#f59e0b', hover: '#d97706', light: 'rgba(245, 158, 11, 0.15)' },
      rose: { main: '#f43f5e', hover: '#e11d48', light: 'rgba(244, 63, 94, 0.15)' }
    };
    const preset = ACCENT_PRESETS[accentColor] || ACCENT_PRESETS.blue;
    root.style.setProperty('--theme-accent', preset.main);
    root.style.setProperty('--theme-accent-hover', preset.hover);
    root.style.setProperty('--theme-accent-light', preset.light);
    saveSetting('accentColor', accentColor);
  }, [accentColor, isLoaded]);

  // Sync fonts to DOM
  useEffect(() => {
    if (!isLoaded) return;
    document.documentElement.style.setProperty('--theme-sans-font', `"${sansFont}"`);
    saveSetting('sansFont', sansFont);
  }, [sansFont, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    document.documentElement.style.setProperty('--theme-mono-font', `"${monoFont}"`);
    saveSetting('monoFont', monoFont);
  }, [monoFont, isLoaded]);

  const handleSetApiKey = (val: string) => { setApiKey(val); saveSetting('gemini_api_key', val); };
  const handleSetSelectedModel = (val: string) => { setSelectedModel(val); saveSetting('gemini_model', val); };
  
  const handleSetOpenaiApiKey = (val: string) => { setOpenaiApiKey(val); saveSetting('openai_api_key', val); };
  const handleSetOpenaiModel = (val: string) => { setOpenaiModel(val); saveSetting('openai_model', val); };
  const handleSetAnthropicApiKey = (val: string) => { setAnthropicApiKey(val); saveSetting('anthropic_api_key', val); };
  const handleSetAnthropicModel = (val: string) => { setAnthropicModel(val); saveSetting('anthropic_model', val); };
  const handleSetGroqApiKey = (val: string) => { setGroqApiKey(val); saveSetting('groq_api_key', val); };
  const handleSetGroqModel = (val: string) => { setGroqModel(val); saveSetting('groq_model', val); };
  const handleSetDeepseekApiKey = (val: string) => { setDeepseekApiKey(val); saveSetting('deepseek_api_key', val); };
  const handleSetDeepseekModel = (val: string) => { setDeepseekModel(val); saveSetting('deepseek_model', val); };
  const handleSetOpenrouterApiKey = (val: string) => { setOpenrouterApiKey(val); saveSetting('openrouter_api_key', val); };
  const handleSetOpenrouterModel = (val: string) => { setOpenrouterModel(val); saveSetting('openrouter_model', val); };
  const handleSetCohereApiKey = (val: string) => { setCohereApiKey(val); saveSetting('cohere_api_key', val); };
  const handleSetCohereModel = (val: string) => { setCohereModel(val); saveSetting('cohere_model', val); };

  const handleSetEnableAi = (val: boolean) => { setEnableAi(val); saveSetting('enable_ai_summary', val); };
  const handleSetPreferredIde = (val: string) => { setPreferredIde(val); saveSetting('preferredIde', val); };
  const handleSetAiProvider = (val: string) => { setAiProvider(val); saveSetting('ai_provider', val); };
  const handleSetLocalBaseUrl = (val: string) => { setLocalBaseUrl(val); saveSetting('local_base_url', val); };
  const handleSetStartupBehavior = (val: 'welcome' | 'restore') => { setStartupBehavior(val); saveSetting('startup_behavior', val); };

  const handleSetAccentColor = (val: string) => { setAccentColor(val); saveSetting('accentColor', val); };
  const handleSetSansFont = (val: string) => { setSansFont(val); saveSetting('sansFont', val); };
  const handleSetMonoFont = (val: string) => { setMonoFont(val); saveSetting('monoFont', val); };
  const handleSetGridPattern = (val: 'dots' | 'lines' | 'none') => { setGridPattern(val); saveSetting('gridPattern', val); };
  const handleSetGridOpacity = (val: number) => { setGridOpacity(val); saveSetting('gridOpacity', val); };

  const handleSetEdgeType = (val: 'bezier' | 'straight' | 'smoothstep') => { setEdgeType(val); saveSetting('edgeType', val); };
  const handleSetEdgeAnimationSpeed = (val: number) => { setEdgeAnimationSpeed(val); saveSetting('edgeAnimationSpeed', val); };
  const handleSetAutoFitOnLoad = (val: boolean) => { setAutoFitOnLoad(val); saveSetting('autoFitOnLoad', val); };
  const handleSetDefaultNodeScale = (val: 'small' | 'normal' | 'large') => { setDefaultNodeScale(val); saveSetting('defaultNodeScale', val); };

  const handleSetAiTemperature = (val: number) => { setAiTemperature(val); saveSetting('aiTemperature', val); };
  const handleSetCustomSummaryPrompt = (val: string) => { setCustomSummaryPrompt(val); saveSetting('customSummaryPrompt', val); };
  const handleSetAiSidebarPlacement = (val: 'left' | 'right') => { setAiSidebarPlacement(val); saveSetting('aiSidebarPlacement', val); };

  const handleSetCustomIdeCommand = (val: string) => { setCustomIdeCommand(val); saveSetting('customIdeCommand', val); };
  const handleSetGitHistoryLimit = (val: number) => { setGitHistoryLimit(val); saveSetting('gitHistoryLimit', val); };
  const handleSetShowDeleteConfirmation = (val: boolean) => { setShowDeleteConfirmation(val); saveSetting('showDeleteConfirmation', val); };
  const handleSetKeybindings = (val: Record<string, string>) => { setKeybindings(val); saveSetting('keybindings', val); };

  // Resolve active key & model dynamically for simplified consumption
  const dynamicApiKey = (() => {
    switch (aiProvider) {
      case 'gemini': return apiKey;
      case 'openai': return openaiApiKey;
      case 'anthropic': return anthropicApiKey;
      case 'groq': return groqApiKey;
      case 'deepseek': return deepseekApiKey;
      case 'openrouter': return openrouterApiKey;
      case 'cohere': return cohereApiKey;
      default: return '';
    }
  })();

  const dynamicModel = (() => {
    switch (aiProvider) {
      case 'gemini': return selectedModel;
      case 'openai': return openaiModel;
      case 'anthropic': return anthropicModel;
      case 'groq': return groqModel;
      case 'deepseek': return deepseekModel;
      case 'openrouter': return openrouterModel;
      case 'cohere': return cohereModel;
      case 'local': return selectedModel; // uses selectedModel or first fetched
      default: return selectedModel;
    }
  })();

  const handleSetDynamicModel = (val: string) => {
    switch (aiProvider) {
      case 'gemini': handleSetSelectedModel(val); break;
      case 'openai': handleSetOpenaiModel(val); break;
      case 'anthropic': handleSetAnthropicModel(val); break;
      case 'groq': handleSetGroqModel(val); break;
      case 'deepseek': handleSetDeepseekModel(val); break;
      case 'openrouter': handleSetOpenrouterModel(val); break;
      case 'cohere': handleSetCohereModel(val); break;
      case 'local': handleSetSelectedModel(val); break;
    }
  };

  return {
    apiKey: dynamicApiKey, setApiKey: handleSetApiKey, // back-compat
    selectedModel: dynamicModel, setSelectedModel: handleSetDynamicModel, // back-compat
    
    geminiApiKey: apiKey, setGeminiApiKey: handleSetApiKey,
    geminiModel: selectedModel, setGeminiModel: handleSetSelectedModel,
    openaiApiKey, setOpenaiApiKey: handleSetOpenaiApiKey,
    openaiModel, setOpenaiModel: handleSetOpenaiModel,
    anthropicApiKey, setAnthropicApiKey: handleSetAnthropicApiKey,
    anthropicModel, setAnthropicModel: handleSetAnthropicModel,
    groqApiKey, setGroqApiKey: handleSetGroqApiKey,
    groqModel, setGroqModel: handleSetGroqModel,
    deepseekApiKey, setDeepseekApiKey: handleSetDeepseekApiKey,
    deepseekModel, setDeepseekModel: handleSetDeepseekModel,
    openrouterApiKey, setOpenrouterApiKey: handleSetOpenrouterApiKey,
    openrouterModel, setOpenrouterModel: handleSetOpenrouterModel,
    cohereApiKey, setCohereApiKey: handleSetCohereApiKey,
    cohereModel, setCohereModel: handleSetCohereModel,

    enableAi, setEnableAi: handleSetEnableAi,
    isLightMode, setIsLightMode,
    preferredIde, setPreferredIde: handleSetPreferredIde,
    aiProvider, setAiProvider: handleSetAiProvider,
    localBaseUrl, setLocalBaseUrl: handleSetLocalBaseUrl,
    startupBehavior, setStartupBehavior: handleSetStartupBehavior,
    
    accentColor, setAccentColor: handleSetAccentColor,
    sansFont, setSansFont: handleSetSansFont,
    monoFont, setMonoFont: handleSetMonoFont,
    gridPattern, setGridPattern: handleSetGridPattern,
    gridOpacity, setGridOpacity: handleSetGridOpacity,
    
    edgeType, setEdgeType: handleSetEdgeType,
    edgeAnimationSpeed, setEdgeAnimationSpeed: handleSetEdgeAnimationSpeed,
    autoFitOnLoad, setAutoFitOnLoad: handleSetAutoFitOnLoad,
    defaultNodeScale, setDefaultNodeScale: handleSetDefaultNodeScale,
    
    aiTemperature, setAiTemperature: handleSetAiTemperature,
    customSummaryPrompt, setCustomSummaryPrompt: handleSetCustomSummaryPrompt,
    aiSidebarPlacement, setAiSidebarPlacement: handleSetAiSidebarPlacement,
    
    customIdeCommand, setCustomIdeCommand: handleSetCustomIdeCommand,
    gitHistoryLimit, setGitHistoryLimit: handleSetGitHistoryLimit,
    showDeleteConfirmation, setShowDeleteConfirmation: handleSetShowDeleteConfirmation,
    keybindings, setKeybindings: handleSetKeybindings,
    
    isLoaded
  };
}
