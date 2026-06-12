import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import * as ExpoNotifications from 'expo-notifications';
import { useAuthStore } from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { useMatchStore } from '../store/useMatchStore';
import { onAuthChange, getUserGroups, getUserHistory } from '../services/firebase';
import { registerPushToken } from '../services/notifications';
import { navigationRef } from './navigationRef';
import { MOCK_USER, MOCK_GROUP } from '../utils/mock';
import { fetchProviderLogoUrls } from '../services/tmdb';
import AppTabs from './AppTabs';
import SplashScreen   from '../screens/SplashScreen';
import LoginScreen    from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import OnboardingIntroScreen from '../screens/OnboardingIntroScreen';
import AgeSelectScreen       from '../screens/AgeSelectScreen';
import ToneSelectScreen      from '../screens/ToneSelectScreen';
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
  const { setGroups, addGroup, setPendingInviteCode } = useGroupStore();
  const { setHistory } = useMatchStore();
  const [splashDone, setSplashDone] = useState(false);

  // Notification tap handling
  useEffect(() => {
    function handleNotificationResponse(response: ExpoNotifications.NotificationResponse) {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const groupId = typeof data.groupId === 'string' ? data.groupId : null;
      if (groupId && (data?.type === 'mood_selected' || data?.type === 'vote_request')) {
        if (navigationRef.isReady()) {
          navigationRef.navigate('Mood', { groupId });
        }
      }
    }

    // Cold start: app opened by tapping notification
    ExpoNotifications.getLastNotificationResponseAsync()
      .then(r => { if (r) handleNotificationResponse(r); })
      .catch(() => {});

    // App already open
    const sub = ExpoNotifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => sub.remove();
  }, []);

  // Pre-fetch platform logos (fire and forget)
  useEffect(() => { fetchProviderLogoUrls().catch(() => {}); }, []);

  // Deep link handling
  useEffect(() => {
    function handleUrl(url: string) {
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code;
      if ((parsed.hostname === 'join' || parsed.path === 'join') && typeof code === 'string') {
        setPendingInviteCode(code.toUpperCase());
      }
    }
    // App opened from cold start via link
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); }).catch(() => {});
    // App already open, link tapped
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (USE_MOCK) {
      setUser(MOCK_USER);
      addGroup(MOCK_GROUP);
      return;
    }

    setLoading(true);
    const unsub = onAuthChange(async u => {
      if (!u) {
        // Limpiar stores al cerrar sesión para que no queden datos del usuario anterior
        useGroupStore.getState().reset();
        useMatchStore.getState().reset();
      }
      setUser(u);
      if (u) {
        try {
          const [groups, history] = await Promise.all([
            getUserGroups(u.uid),
            getUserHistory(u.uid),
          ]);
          setGroups(groups);
          setHistory(history);
          registerPushToken(u.uid).catch(() => {});
        } catch { /* silenciar */ }
      } else {
        useGroupStore.getState().reset();
        useMatchStore.getState().reset();
      }
    });
    return unsub;
  }, []);

  // Mostrar splash hasta que la animación termine Y el auth esté resuelto
  if (!splashDone || isLoading) {
    return <SplashScreen onComplete={() => setSplashDone(true)} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 200 }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : !user.onboardingDone ? (
        <>
          <Stack.Screen name="OnboardingIntro" component={OnboardingIntroScreen} />
          <Stack.Screen name="AgeSelect"   component={AgeSelectScreen} />
          <Stack.Screen name="ToneSelect"  component={ToneSelectScreen} />
          <Stack.Screen name="Onboarding"  component={OnboardingScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="App"             component={AppTabs} />
          <Stack.Screen name="OnboardingIntro" component={OnboardingIntroScreen} />
          <Stack.Screen name="AgeSelect"   component={AgeSelectScreen} />
          <Stack.Screen name="ToneSelect"  component={ToneSelectScreen} />
          <Stack.Screen name="Onboarding"  component={OnboardingScreen} />
          <Stack.Screen name="Group"           component={GroupScreen} />
          <Stack.Screen name="Mood"       component={MoodScreen} />
          <Stack.Screen name="Matching"   component={MatchingScreen} />
          <Stack.Screen name="Results"    component={ResultsScreen} />
          <Stack.Screen name="PostView"   component={PostViewScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
