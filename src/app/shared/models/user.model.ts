export enum Role {
  STUDENT = 'STUDENT',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  profilePicture?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Student extends User {
  totalPoints: number;
  completedScenarios: number;
  averageScore: number;
  currentLevel: number;
}

export interface Instructor extends User {
  bio?: string;
  specialization?: string;
  studentsCount: number;
  scenariosCreated: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  emailVerified: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}
