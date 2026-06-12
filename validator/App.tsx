import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/HomeScreen';
import OnboardingScreen from './src/OnboardingScreen';
import ResultsScreen from './src/ResultsScreen';
import type { AgeRange, OnboardingState, AnchorInfo } from './src/useOnboarding';
import type { NormalizedTitle } from './src/tmdb';

type Screen = 'home' | 'onboarding' | 'results';

interface ResultsData {
  ratings:         Record<number, string>;
  liveProfile:     Record<string, number>;
  titles:          NormalizedTitle[];
  anchorPositions: AnchorInfo[];
}

export default function App() {
  const [screen, setScreen]     = useState<Screen>('home');
  const [ageRange, setAgeRange] = useState<AgeRange>('adult');
  const [results, setResults]   = useState<ResultsData | null>(null);

  function handleStart(age: AgeRange) {
    setAgeRange(age);
    setResults(null);
    setScreen('onboarding');
  }

  function handleFinish(data: Pick<OnboardingState, 'ratings' | 'liveProfile' | 'titles' | 'anchorPositions'>) {
    setResults(data as ResultsData);
    setScreen('results');
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen === 'home' && (
        <HomeScreen onStart={handleStart} />
      )}
      {screen === 'onboarding' && (
        <OnboardingScreen
          key={ageRange}
          ageRange={ageRange}
          onFinish={handleFinish}
        />
      )}
      {screen === 'results' && results && (
        <ResultsScreen
          {...results}
          onRepeat={() => setScreen('home')}
        />
      )}
    </SafeAreaProvider>
  );
}
