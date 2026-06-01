import { useState, useEffect } from 'react';
import { load } from '@tauri-apps/plugin-store';

export function useSettings() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem('gemini_model') || 'models/gemini-1.5-flash'
  );
  const [enableAi, setEnableAi] = useState(() => {
    const saved = localStorage.getItem('enable_ai_summary');
    return saved === null ? true : saved === 'true';
  });
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });
  const [preferredIde, setPreferredIde] = useState('code');
  const [aiProvider, setAiProvider] = useState(localStorage.getItem('ai_provider') || 'gemini');
  const [localBaseUrl, setLocalBaseUrl] = useState(
    localStorage.getItem('local_base_url') || 'http://localhost:1234/v1'
  );

  // Load persisted settings from Tauri store
  useEffect(() => {
    load('settings.json', { autoSave: false, defaults: { preferredIde: 'code', recentProjects: [] } }).then(store => {
      store.get<string>('preferredIde').then(val => {
        if (val) setPreferredIde(val);
      });
    });
  }, []);

  // Sync theme to DOM
  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);

  const handleSetPreferredIde = async (val: string) => {
    setPreferredIde(val);
    const store = await load('settings.json', { autoSave: false, defaults: { preferredIde: 'code' } });
    await store.set('preferredIde', val);
    await store.save();
  };

  return {
    apiKey, setApiKey,
    selectedModel, setSelectedModel,
    enableAi, setEnableAi,
    isLightMode, setIsLightMode,
    preferredIde,
    handleSetPreferredIde,
    aiProvider, setAiProvider,
    localBaseUrl, setLocalBaseUrl,
  };
}
