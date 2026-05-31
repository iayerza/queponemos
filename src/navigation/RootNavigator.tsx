import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { onAuthChange, getUserGroups } from '../services/firebase';
import { MOCK_USER, MOCK_GROUP } from '../utils/mock';
import AppTabs from './AppTabs';
import SplashScreen   from '../screens/SplashScreen';
import LoginScreen    from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import GroupScreen    from '../screens/GroupScreen';
import MoodScreen     from '../screens/MoodScreen';
import MatchingScreen from '../screens/MatchingScreen';
import ResultsScreen  from '../screens/ResultsScreen';
import PostViewScreen  from '../screens/PostViewScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

export default function RootNavigator() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();
  const { setGroups, addGroup } = useGroupStore();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (USE_MOCK) {
      setUser(MOCK_USER);
      addGroup(MOCK_GROUP);
      return;
    }

    setLoading(true);
    const unsub = onAuthChange(async u => {
      setUser(u);
      if (u) {
        try {
          const groups = await getUserGroups(u.uid);
          setGroups(groups);
        } catch { /* silenciar */ }
      }
    });
    return unsub;
  }, []);

  // Mostrar splash hasta que la animación termine Y el auth esté resuelto
  if (!splashDone || isLoading) {
    return <SplashScreen onComplete={() => setSplashDone(true)} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : !user.onboardingDone ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="App"      component={AppTabs} />
          <Stack.Screen name="Group"    component={GroupScreen} />
          <Stack.Screen name="Mood"     component={MoodScreen} />
          <Stack.Screen name="Matching" component={MatchingScreen} />
          <Stack.Screen name="Results"  component={ResultsScreen} />
          <Stack.Screen name="PostView" component={PostViewScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
