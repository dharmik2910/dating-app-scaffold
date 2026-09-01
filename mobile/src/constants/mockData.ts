export interface Candidate {
  userId: string;
  name: string;
  age: number;
  location: string;
  distance_km: number;
  bio: string;
  interests: string[];
  verified: boolean;
  liked?: boolean;
  photos: { id: string; url: string }[];
  jobTitle?: string;
  company?: string;
  latitude?: number;
  longitude?: number;
  lastActiveAt?: string | Date;
  isOnline?: boolean;
}

export interface Match {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    online: boolean;
    lastSeen?: string;
    bio?: string;
    latitude?: number;
    longitude?: number;
    location?: string;
  };
  lastMessage: {
    text: string;
    createdAt: string;
    senderId: string;
    unread: boolean;
  };
  matchedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isMe: boolean;
}

export const INTEREST_LABELS: Record<string, { label: string; icon: string }> = {
  coffee: { label: 'Coffee', icon: '☕' },
  travel: { label: 'Travel', icon: '✈️' },
  fitness: { label: 'Fitness', icon: '🏋️‍♂️' },
  music: { label: 'Music', icon: '🎧' },
  foodie: { label: 'Foodie', icon: '🍕' },
  gaming: { label: 'Gaming', icon: '🎮' },
  art: { label: 'Art', icon: '🎨' },
  photography: { label: 'Photography', icon: '📸' },
  reading: { label: 'Reading', icon: '📚' },
  pets: { label: 'Pets', icon: '🐶' },
  movies: { label: 'Movies', icon: '🎬' },
  tech: { label: 'Tech', icon: '💻' },
  hiking: { label: 'Outdoor', icon: '🧗‍♂️' },
  wine: { label: 'Wine', icon: '🍷' },
};
