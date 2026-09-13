export interface ProfilePrompt {
  id?: string;
  question: string;
  answer: string;
  order?: number;
}

export interface Candidate {
  id?: string;
  userId: string;
  name: string;
  age?: number;
  location?: string;
  distance_km: number;
  bio: string;
  gender?: string;
  interests: string[];
  verified?: boolean;
  isVerified?: boolean;
  liked?: boolean;
  photos: { id?: string; url: string }[];
  jobTitle?: string;
  company?: string;
  latitude?: number;
  longitude?: number;
  lastActiveAt?: string | Date;
  isOnline?: boolean;
  isBoosted?: boolean;
  voiceBioUrl?: string | null;
  twoTruths?: { statements: string[]; lieIndex: number } | null;
  prompts?: ProfilePrompt[];
  topPickReason?: string;
  blindMode?: boolean;
  hint?: string;
}

export interface Match {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    online: boolean;
    lastSeen?: string;
    lastActiveAt?: string | Date;
    bio?: string;
    latitude?: number;
    longitude?: number;
    location?: string;
    isVerified?: boolean;
    interests?: string[];
    voiceBioUrl?: string | null;
    twoTruths?: { statements: string[]; lieIndex: number } | null;
    prompts?: ProfilePrompt[];
  };
  lastMessage: {
    text: string;
    createdAt: string;
    senderId: string;
    unread: boolean;
  };
  matchedAt: string;
  isUnmatched?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  content?: string;
  timestamp?: string;
  sentAt?: string;
  isMe?: boolean;
  mediaUrl?: string;
  mediaType?: 'text' | 'audio' | 'image' | 'date_invite' | 'icebreaker';
  isEphemeral?: boolean;
  viewedAt?: string | Date | null;
  metadata?: {
    venueName?: string;
    address?: string;
    dateTime?: string;
    notes?: string;
    status?: 'pending' | 'accepted' | 'declined';
    respondedBy?: string;
  } | null;
}

export const STANDARD_PROMPTS = [
  'My simple pleasures...',
  'The way to win me over is...',
  'I get along best with people who...',
  'A boundary of mine is...',
  'The quickest way to my heart is...',
  'Never have I ever...',
  'My most controversial opinion is...',
  'Together, we could...',
  'Dating me is like...',
];

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
  cooking: { label: 'Cooking', icon: '🍳' },
  yoga: { label: 'Yoga', icon: '🧘' },
  nightlife: { label: 'Nightlife', icon: '🍸' },
  nature: { label: 'Nature', icon: '🌿' },
};
