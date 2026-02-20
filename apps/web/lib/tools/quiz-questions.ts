export interface QuizOption {
  label: string;
  emoji: string;
  tags: Record<string, number>;
}

export interface QuizQuestion {
  id: string;
  question: string;
  subtitle: string;
  multiSelect?: boolean;
  options: QuizOption[];
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'budget',
    question: "What's your ideal daily budget?",
    subtitle: 'Including accommodation, food, and activities',
    options: [
      {
        label: 'Backpacker',
        emoji: '🎒',
        tags: { budget: 3, adventure: 1, solo: 1 },
      },
      {
        label: 'Mid-Range',
        emoji: '💳',
        tags: { moderate: 3, culture: 1, family: 1 },
      },
      {
        label: 'Splurge',
        emoji: '💎',
        tags: { luxury: 3, romantic: 1, relaxation: 1 },
      },
      {
        label: 'No Limit',
        emoji: '👑',
        tags: { luxury: 5, romantic: 2 },
      },
    ],
  },
  {
    id: 'climate',
    question: 'What climate do you prefer?',
    subtitle: 'Think about your ideal weather on vacation',
    options: [
      {
        label: 'Hot & Sunny',
        emoji: '☀️',
        tags: { beach: 3, tropical: 2 },
      },
      {
        label: 'Warm & Mild',
        emoji: '🌤️',
        tags: { mediterranean: 3, culture: 1 },
      },
      {
        label: 'Cool & Crisp',
        emoji: '🍂',
        tags: { urban: 2, culture: 2 },
      },
      {
        label: 'Cold & Dramatic',
        emoji: '❄️',
        tags: { adventure: 3, nature: 2, scenic: 1 },
      },
    ],
  },
  {
    id: 'activities',
    question: 'What activities excite you most?',
    subtitle: 'Pick up to 3 that sound amazing',
    multiSelect: true,
    options: [
      {
        label: 'Museums & History',
        emoji: '🏛️',
        tags: { culture: 3, history: 2 },
      },
      {
        label: 'Beach & Water',
        emoji: '🏖️',
        tags: { beach: 3, relaxation: 2 },
      },
      {
        label: 'Hiking & Nature',
        emoji: '🥾',
        tags: { nature: 3, adventure: 2, scenic: 1 },
      },
      {
        label: 'Food & Markets',
        emoji: '🍜',
        tags: { foodie: 3, culture: 1 },
      },
    ],
  },
  {
    id: 'pace',
    question: "What's your ideal travel pace?",
    subtitle: 'How do you like to spend your days?',
    options: [
      {
        label: 'Go go go!',
        emoji: '🏃',
        tags: { urban: 2, adventure: 2, culture: 1 },
      },
      {
        label: 'Balanced mix',
        emoji: '⚖️',
        tags: { culture: 2, foodie: 1, nature: 1 },
      },
      {
        label: 'Slow & easy',
        emoji: '🧘',
        tags: { relaxation: 3, wellness: 2, beach: 1 },
      },
      {
        label: 'Spontaneous',
        emoji: '🎲',
        tags: { nightlife: 2, adventure: 1, solo: 1 },
      },
    ],
  },
  {
    id: 'companions',
    question: 'Who are you traveling with?',
    subtitle: 'This helps us match the right vibe',
    options: [
      {
        label: 'Solo',
        emoji: '🎒',
        tags: { solo: 3, adventure: 1, budget: 1 },
      },
      {
        label: 'Partner',
        emoji: '💕',
        tags: { romantic: 3, luxury: 1, relaxation: 1 },
      },
      {
        label: 'Friends',
        emoji: '👯',
        tags: { nightlife: 2, adventure: 2, foodie: 1 },
      },
      {
        label: 'Family',
        emoji: '👨‍👩‍👧‍👦',
        tags: { family: 3, culture: 1, nature: 1 },
      },
    ],
  },
  {
    id: 'food',
    question: 'How adventurous are you with food?',
    subtitle: "From comfort food to 'I'll try anything'",
    options: [
      {
        label: 'Play it safe',
        emoji: '🍕',
        tags: { urban: 2, family: 1 },
      },
      {
        label: 'Open-minded',
        emoji: '🍱',
        tags: { foodie: 2, culture: 1 },
      },
      {
        label: "I'll try anything",
        emoji: '🦑',
        tags: { foodie: 4, adventure: 1 },
      },
      {
        label: 'Foodie is my vibe',
        emoji: '👨‍🍳',
        tags: { foodie: 5, culture: 2 },
      },
    ],
  },
];
