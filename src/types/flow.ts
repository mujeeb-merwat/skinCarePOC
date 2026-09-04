export type FlowStep = 1 | 2 | 3 | 4 | 5

export type Severity = 'Mild' | 'Moderate' | 'Noticeable'

export type Concern = {
  name: string
  severity: Severity
  description: string
}

export type Cause = {
  icon: string
  title: string
  description: string
}

export type AnalysisResult = {
  score: number
  skinType: string
  concerns: Concern[]
  causes: Cause[]
}

export type QuizAnswers = {
  skinType: string | null
  concerns: string[]
  routine: string | null
  goal: string | null
}

export type FlowDirection = 'forward' | 'back'

export const initialAnswers: QuizAnswers = {
  skinType: null,
  concerns: [],
  routine: null,
  goal: null,
}

export type QuizQuestion = {
  id: keyof QuizAnswers
  question: string
  options: string[]
  multiSelect?: boolean
  maxSelect?: number
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'skinType',
    question: 'How would you describe your skin?',
    options: ['Oily', 'Dry', 'Combination', 'Normal', 'Not sure'],
  },
  {
    id: 'concerns',
    question: "What's bothering you most right now?",
    options: [
      'Acne & breakouts',
      'Dark spots or pigmentation',
      'Fine lines & wrinkles',
      'Redness & sensitivity',
      'Dullness',
      'Large pores',
    ],
    multiSelect: true,
    maxSelect: 3,
  },
  {
    id: 'routine',
    question: 'What does your routine look like today?',
    options: [
      'Nothing yet',
      'Just a cleanser',
      'Cleanser + moisturizer',
      'Full routine with actives',
    ],
  },
  {
    id: 'goal',
    question: "What's your main goal?",
    options: [
      'Calm & clear skin',
      'Even tone',
      'Smoother texture',
      'Firmer skin',
      'Healthy glow',
    ],
  },
]
