import { useState, useEffect } from 'react';
import { load } from '@tauri-apps/plugin-store';

const defaultSettings = { 
  preferredIde: 'code', 
  gemini_api_key: '', 
  gemini_model: 'models/gemini-1.5-flash',
  enable_ai_summary: true,
  theme: 'dark',
  ai_provider: 'gemini',
  local_base_url: 'http://localhost:1234/v1',
  startup_behavior: 'welcome'
};

export function useSettings() {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('models/gemini-1.5-flash');
  const [enableAi, setEnableAi] = useState(true);
  const [isLightMode, setIsLightMode] = useState(false);
  const [preferredIde, setPreferredIde] = useState('code');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [localBaseUrl, setLocalBaseUrl] = useState('http://localhost:1234/v1');
  const [startupBehavior, setStartupBehavior] = useState<'welcome' | 'restore'>('welcome');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted settings from Tauri store
  useEffect(() => {
    load('settings.json', { autoSave: true, defaults: defaultSettings }).then(store => {
      Promise.all([
        store.get<string>('preferredIde'),
        store.get<string>('gemini_api_key'),
        store.get<string>('gemini_model'),
        store.get<boolean>('enable_ai_summary'),
        store.get<string>('theme'),
        store.get<string>('ai_provider'),
        store.get<string>('local_base_url'),
        store.get<'welcome' | 'restore'>('startup_behavior')
      ]).then(([ide, key, model, enable, theme, provider, baseUrl, startup]) => {
        if (ide !== undefined && ide !== null) setPreferredIde(ide);
        if (key !== undefined && key !== null) setApiKey(key);
        if (model !== undefined && model !== null) setSelectedModel(model);
        if (enable !== undefined && enable !== null) setEnableAi(enable);
        if (theme !== undefined && theme !== null) setIsLightMode(theme === 'light');
        if (provider !== undefined && provider !== null) setAiProvider(provider);
        if (baseUrl !== undefined && baseUrl !== null) setLocalBaseUrl(baseUrl);
        if (startup === 'welcome' || startup === 'restore') setStartupBehavior(startup);
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

  const handleSetApiKey = (val: string) => { setApiKey(val); saveSetting('gemini_api_key', val); };
  const handleSetSelectedModel = (val: string) => { setSelectedModel(val); saveSetting('gemini_model', val); };
  const handleSetEnableAi = (val: boolean) => { setEnableAi(val); saveSetting('enable_ai_summary', val); };
  const handleSetPreferredIde = (val: string) => { setPreferredIde(val); saveSetting('preferredIde', val); };
  const handleSetAiProvider = (val: string) => { setAiProvider(val); saveSetting('ai_provider', val); };
  const handleSetLocalBaseUrl = (val: string) => { setLocalBaseUrl(val); saveSetting('local_base_url', val); };
  const handleSetStartupBehavior = (val: 'welcome' | 'restore') => { setStartupBehavior(val); saveSetting('startup_behavior', val); };

  return {
    apiKey, setApiKey: handleSetApiKey,
    selectedModel, setSelectedModel: handleSetSelectedModel,
    enableAi, setEnableAi: handleSetEnableAi,
    isLightMode, setIsLightMode,
    preferredIde, handleSetPreferredIde,
    aiProvider, setAiProvider: handleSetAiProvider,
    localBaseUrl, setLocalBaseUrl: handleSetLocalBaseUrl,
    startupBehavior, setStartupBehavior: handleSetStartupBehavior,
  };
}
