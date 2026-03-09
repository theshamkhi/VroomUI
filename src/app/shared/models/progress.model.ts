export enum CompletionStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED_PASSED = 'COMPLETED_PASSED',
  COMPLETED_FAILED = 'COMPLETED_FAILED'
}

export interface Progress {
  id: string;
  studentId: string;
  scenarioId: string;
  scenarioTitle?: string;
  status: CompletionStatus;
  attemptCount: number;
  highestScore: number;
  latestScore: number;
  averageScore: number;
  totalPointsEarned: number;
  totalPossiblePoints: number;
  timeSpentSeconds: number;
  formattedTimeSpent: string;
  correctAnswers: number;
  totalQuestions: number;
  completionPercentage: number;
  startedAt: string;
  completedAt?: string;
  lastAccessedAt: string;
}

export interface SubmitAnswerRequest {
  questionId: string;
  scenarioId: string;
  selectedAnswerIds: string[];
  timeTakenSeconds?: number;
  hintUsed?: boolean;
}

export enum BadgeType {
  COMPLETION = 'COMPLETION',
  MASTERY = 'MASTERY',
  STREAK = 'STREAK',
  SPEED = 'SPEED',
  PERFECT_SCORE = 'PERFECT_SCORE',
  SPECIAL = 'SPECIAL'
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  type: BadgeType;
  pointsRequired?: number;
  scenariosRequired?: number;
  difficulty?: string;
  isActive: boolean;
  createdAt: string;
}

export interface StudentBadge {
  id: string;
  studentId: string;
  badgeId: string;
  badge: Badge;
  earnedAt: string;
  notificationSent: boolean;
}
