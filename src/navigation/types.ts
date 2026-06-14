export type ToneId    = 'tension' | 'light' | 'think' | 'fear';
export type FormatPref = 'movie' | 'series' | 'both';

export type RootStackParamList = {
  Login: undefined;
  OnboardingIntro: undefined;
  ToneSelect:  { fromProfile?: true };
  Onboarding:  { fromProfile?: true; tone?: ToneId; format?: FormatPref };
  App: undefined;
  Group: { groupId: string };
  Mood: { groupId?: string; solo?: true };
  Matching: { groupId?: string; solo?: true };
  Results: { matchId: string };
  PostView: { title: string; year: number; posterPath: string | null; matchId: string; titleIdx: number; tmdbId?: number; type?: 'movie' | 'series' };
};

export type AppTabParamList = {
  Home: undefined;
  History: undefined;
  Profile: undefined;
};
