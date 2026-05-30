import type { UserProfile } from '../services/firebase';
import type { GroupDoc } from '../services/firebase';

export const MOCK_USER: UserProfile = {
  uid: 'user-main',
  email: 'ayerza@gmail.com',
  displayName: 'Iayer',
  photoURL: null,
  ratings: { 278: 'loved', 155: 'loved', 550: 'seen_disliked', 13: 'loved' },
  tasteProfile: {
    genres: { Drama: 0.8, Thriller: 0.7, 'Ciencia Ficción': 0.6 },
    intensity: 0.75,
    seriesVsMovies: 0.5,
    implicitGenres: ['Drama', 'Thriller'],
  },
  onboardingDone: true,  // saltear onboarding en modo mock
};

export const MOCK_USERS: Record<string, UserProfile> = {
  'user-sofia': {
    uid: 'user-sofia',
    displayName: 'Sofia',
    email: 'sofiamagnasco@gmail.com',
    photoURL: null,
    ratings: { 136315: 'loved', 73586: 'loved', 119051: 'loved', 496243: 'seen_disliked' },
    tasteProfile: {
      genres: { Drama: 0.9, Comedia: 0.6, Thriller: 0.4 },
      intensity: 0.7,
      seriesVsMovies: 0.8,
      implicitGenres: ['Drama'],
    },
    onboardingDone: true,
  },
  'user-leo': {
    uid: 'user-leo',
    displayName: 'Leo',
    email: 'leo@gmail.com',
    photoURL: null,
    ratings: { 27205: 'loved', 95396: 'loved', 872585: 'loved', 119051: 'loved' },
    tasteProfile: {
      genres: { Thriller: 0.9, 'Ciencia Ficción': 0.8, Drama: 0.7 },
      intensity: 0.85,
      seriesVsMovies: 0.5,
      implicitGenres: ['Thriller', 'Ciencia Ficción'],
    },
    onboardingDone: true,
  },
};

export const MOCK_GROUP: GroupDoc = {
  id: 'g-pareja',
  name: 'Iayer & Sofia',
  members: ['user-main', 'user-sofia'],  // 2 personas — foco del MVP
  createdBy: 'user-main',
  inviteCode: 'QP7VK2',
  platforms: ['netflix', 'hbo'],
  country: 'AR',
};
