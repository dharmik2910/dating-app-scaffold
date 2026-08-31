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

export const MOCK_CANDIDATES: Candidate[] = [
  {
    userId: 'user-1',
    name: 'Sophia Chen',
    age: 25,
    location: 'Downtown, San Francisco',
    distance_km: 2.4,
    jobTitle: 'UI/UX Designer',
    company: 'Figma',
    bio: 'Coffee addict, sunset watcher, and design enthusiast. Looking for someone to explore hidden coffee shops with ✨',
    interests: ['coffee', 'art', 'photography', 'travel'],
    verified: true,
    photos: [
      {
        id: 'p1-1',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1000&auto=format&fit=crop',
      },
      {
        id: 'p1-2',
        url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=1000&auto=format&fit=crop',
      },
      {
        id: 'p1-3',
        url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=1000&auto=format&fit=crop',
      },
    ],
  },
  {
    userId: 'user-2',
    name: 'Alex Rivera',
    age: 27,
    location: 'Mission District',
    distance_km: 4.1,
    jobTitle: 'Software Engineer',
    company: 'Stripe',
    bio: 'Weekend hiker, sourdough baker, and retro video game collector. Tell me your favorite sci-fi book 📚',
    interests: ['tech', 'hiking', 'gaming', 'foodie'],
    verified: true,
    photos: [
      {
        id: 'p2-1',
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop',
      },
      {
        id: 'p2-2',
        url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1000&auto=format&fit=crop',
      },
    ],
  },
  {
    userId: 'user-3',
    name: 'Maya Lin',
    age: 24,
    location: 'SOMA',
    distance_km: 1.8,
    jobTitle: 'Architect',
    company: 'Gensler',
    bio: 'Live music lover, golden retriever mom, and amateur pasta chef 🍝',
    interests: ['music', 'pets', 'foodie', 'wine'],
    verified: false,
    photos: [
      {
        id: 'p3-1',
        url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1000&auto=format&fit=crop',
      },
      {
        id: 'p3-2',
        url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=1000&auto=format&fit=crop',
      },
    ],
  },
  {
    userId: 'user-4',
    name: 'Elena Rostova',
    age: 26,
    location: 'Marina Bay',
    distance_km: 5.2,
    jobTitle: 'Fitness Coach',
    company: 'Equinox',
    bio: 'Marathon runner, smoothie bowl fanatic, and beach volleyball addict 🏐',
    interests: ['fitness', 'hiking', 'travel', 'coffee'],
    verified: true,
    photos: [
      {
        id: 'p4-1',
        url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=1000&auto=format&fit=crop',
      },
    ],
  },
];

export const MOCK_MATCHES: Match[] = [
  {
    id: 'match-1',
    user: {
      id: 'user-1',
      name: 'Sophia Chen',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
      online: true,
    },
    lastMessage: {
      text: 'Hey! Loved your profile picture at the museum 🎨',
      createdAt: '10:42 AM',
      senderId: 'user-1',
      unread: true,
    },
    matchedAt: '2 hours ago',
  },
  {
    id: 'match-2',
    user: {
      id: 'user-3',
      name: 'Maya Lin',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop',
      online: false,
      lastSeen: '15m ago',
    },
    lastMessage: {
      text: 'Are you going to the concert this Friday?',
      createdAt: 'Yesterday',
      senderId: 'me',
      unread: false,
    },
    matchedAt: '1 day ago',
  },
  {
    id: 'match-3',
    user: {
      id: 'user-4',
      name: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=400&auto=format&fit=crop',
      online: true,
    },
    lastMessage: {
      text: 'Matched! Say hello to Elena',
      createdAt: '3 days ago',
      senderId: 'system',
      unread: false,
    },
    matchedAt: '3 days ago',
  },
];

export const MOCK_CHAT_MESSAGES: Record<string, Message[]> = {
  'match-1': [
    {
      id: 'm1',
      senderId: 'user-1',
      text: 'Hey there! Nice to match with you 😊',
      timestamp: '10:30 AM',
      isMe: false,
    },
    {
      id: 'm2',
      senderId: 'me',
      text: 'Hey Sophia! How is your week going?',
      timestamp: '10:35 AM',
      isMe: true,
    },
    {
      id: 'm3',
      senderId: 'user-1',
      text: 'Pretty great! Just grabbin a cold brew at Sightglass Coffee ☕',
      timestamp: '10:40 AM',
      isMe: false,
    },
    {
      id: 'm4',
      senderId: 'user-1',
      text: 'Hey! Loved your profile picture at the museum 🎨',
      timestamp: '10:42 AM',
      isMe: false,
    },
  ],
};

export const CURRENT_USER = {
  id: 'me',
  name: 'David Miller',
  age: 27,
  jobTitle: 'Product Manager',
  company: 'Tech Corp',
  location: 'San Francisco, CA',
  bio: 'Passionate about buildin awesome products, espresso brewing, and coastal drives 🏎️',
  photos: [
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=1000&auto=format&fit=crop',
  ],
  interests: ['tech', 'coffee', 'travel', 'fitness', 'music'],
  preferences: {
    gender: 'Women',
    minAge: 21,
    maxAge: 32,
    distanceKm: 25,
  },
  completionPercentage: 85,
};
