export type AgeRange = 'young' | 'mid' | 'adult' | 'senior';
export type ToneId   = 'mix' | 'prestige' | 'fun';

export type RootStackParamList = {
  Login: undefined;
  OnboardingIntro: undefined;
  AgeSelect: { fromProfile?: true };
  ToneSelect: { ageRange: AgeRange; fromProfile?: true };
  Onboarding: { fromProfile?: true; ageRange?: AgeRange; toneId?: ToneId };
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
