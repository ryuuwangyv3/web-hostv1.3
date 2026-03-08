import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Settings {
  theme: string;
  fontSize: number;
  autoSave: boolean;
  aiSuggestions: boolean;
  showLineNumbers: boolean;
  wordWrap: boolean;
  formatOnSave: boolean;
}

const defaultSettings: Settings = {
  theme: 'dark-plus',
  fontSize: 13,
  autoSave: true,
  aiSuggestions: true,
  showLineNumbers: true,
  wordWrap: false,
  formatOnSave: true,
};

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('akasha-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('akasha-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
