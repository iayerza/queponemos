export type RootStackParamList = {
  Login: undefined;
  Onboarding: { fromProfile?: true };
  App: undefined;
  Group: { groupId: string };
  Mood: { groupId?: string; solo?: true };
  Matching: { groupId?: string; solo?: true };
  Results: { matchId: string };
  PostView: { title: string; year: number; posterPath: string | null; matchId: string; titleIdx: number };
};

export type AppTabParamList = {
  Home: undefined;
  History: undefined;
  Profile: undefined;
};
