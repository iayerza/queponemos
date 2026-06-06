import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors } from '../constants/colors';
import { useColors } from '../context/ThemeContext';
import HomeScreen    from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { AppTabParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();

function IconHome({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <Path d="M9 22V12h6v10" />
    </Svg>
  );
}
function IconHistory({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z" />
      <Path d="M9 9h6M9 12h6M9 15h4" />
    </Svg>
  );
}
function IconProfile({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </Svg>
  );
}

function ActiveDot() {
  return (
    <View style={{
      width: 4, height: 4,
      borderRadius: 2,
      backgroundColor: Colors.accent,
      marginTop: 4,
    }} />
  );
}

function TabIcon({ name, focused, inactiveColor }: { name: string; focused: boolean; inactiveColor: string }) {
  const color = focused ? Colors.accent : inactiveColor;
  return (
    <View style={{ alignItems: 'center' }}>
      {name === 'Home'    && <IconHome    color={color} />}
      {name === 'History' && <IconHistory color={color} />}
      {name === 'Profile' && <IconProfile color={color} />}
      {focused && <ActiveDot />}
    </View>
  );
}

export default function AppTabs() {
  const themeColors = useColors();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: themeColors.bg,
          borderTopWidth: 0.5,
          borderTopColor: themeColors.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} inactiveColor={themeColors.faint} />
        ),
        tabBarAccessibilityLabel:
          route.name === 'Home' ? 'Inicio' :
          route.name === 'History' ? 'Mis listas' : 'Perfil',
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
