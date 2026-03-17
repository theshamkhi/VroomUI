export enum Difficulty {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED'
}

export enum Theme {
  URBAN_DRIVING = 'URBAN_DRIVING',
  HIGHWAY_DRIVING = 'HIGHWAY_DRIVING',
  PARKING = 'PARKING',
  NIGHT_DRIVING = 'NIGHT_DRIVING',
  WEATHER_CONDITIONS = 'WEATHER_CONDITIONS',
  DEFENSIVE_DRIVING = 'DEFENSIVE_DRIVING',
  EMERGENCY_SITUATIONS = 'EMERGENCY_SITUATIONS',
  INTERSECTIONS = 'INTERSECTIONS',
  PEDESTRIAN_SAFETY = 'PEDESTRIAN_SAFETY',
  ROAD_SIGNS = 'ROAD_SIGNS',
  TRAFFIC_LAWS = 'TRAFFIC_LAWS',
  VEHICLE_MAINTENANCE = 'VEHICLE_MAINTENANCE',
  ECO_DRIVING = 'ECO_DRIVING',
  MOUNTAIN_DRIVING = 'MOUNTAIN_DRIVING',
  RURAL_DRIVING = 'RURAL_DRIVING',
  ROUNDABOUTS = 'ROUNDABOUTS'
}

export enum ScenarioStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED'
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  theme: Theme;
  status: ScenarioStatus;
  videoId?: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  tags: string[];
  learningObjectives: string[];
  maxPoints: number;
  passingScore: number;
  completionCount: number;
  averageRating: number;
  createdBy: string;
  publishedBy?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface CreateScenarioRequest {
  title: string;
  description: string;
  difficulty: Difficulty;
  theme: Theme;
  durationSeconds?: number;
  tags?: string[];
  prerequisites?: string[];
  learningObjectives?: string[];
  maxPoints: number;
  passingScore: number;
}

export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE'
}

export interface Answer {
  id: string;
  questionId: string;
  answerText: string;
  isCorrect: boolean;
  orderIndex: number;
  explanation?: string;
}

export interface Question {
  id: string;
  scenarioId: string;
  type: QuestionType;
  questionText: string;
  hint?: string;
  explanation?: string;
  points: number;
  timeLimitSeconds?: number;
  orderIndex: number;
  answers: Answer[];
  createdAt: string;
}

export interface InteractionPoint {
  id: string;
  scenarioId: string;
  questionId: string;
  timestampSeconds: number;
  title: string;
  description?: string;
  orderIndex: number;
  mandatory: boolean;
}
export enum AssignmentStatus {
  PENDING   = 'PENDING',
  COMPLETED = 'COMPLETED',
  OVERDUE   = 'OVERDUE',
}

export interface Assignment {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  scenarioId: string;
  scenarioTitle: string;
  assignedAt: string;
  dueDate?: string;
  note?: string;
  completedAt?: string;
  status: AssignmentStatus;
}

export interface CreateAssignmentRequest {
  studentId: string;
  scenarioId: string;
  dueDate?: string;
  note?: string;
}
