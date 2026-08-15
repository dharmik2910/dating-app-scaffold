type UserProfile = {
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type User = {
  profile?: UserProfile | null;
};

export function needsOnboarding(user: User | null | undefined) {
  const profile = user?.profile;
  return !profile?.name || profile.latitude == null || profile.longitude == null;
}

export function getPostAuthPath(user: User | null | undefined) {
  return needsOnboarding(user) ? '/setup' : '/discover';
}
