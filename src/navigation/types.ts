export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  App: undefined;
  Group: { groupId: string };
  Mood: { groupId: string };
  Matching: { groupId: string };
  Results: { matchId: string };
};

export type AppTabParamList = {
  Home: undefined;
  History: undefined;
  Profile: undefined;
};
