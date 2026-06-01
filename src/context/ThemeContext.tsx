import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type ColorPalette } from '../constants/colors';

export type ThemePreference = 'dark' | 'light' | 'system';

interface ThemeCtx {
  colors: ColorPalette;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  colors: darkColors,
  preference: 'dark',
  setPreference: () => {},
});

const STORAGE_KEY = 'queponemos_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setPreferenceState(val);
      }
    });
  }, []);

  async function setPreference(p: ThemePreference) {
    setPreferenceState(p);
    await AsyncStorage.setItem(STORAGE_KEY, p);
  }

  const isDark =
    preference === 'system' ? systemScheme !== 'light' : preference === 'dark';

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeCtx {
  return useContext(ThemeContext);
}

export function useColors(): ColorPalette {
  return useContext(ThemeContext).colors;
}
