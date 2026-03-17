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
  completedScenarios?: number;
  scenariosCompleted?: number;
  averageScore?: number;
  currentLevel: number;
  completionPercentage?: number;
  enrollmentDate?: string;
  assignedInstructorId?: string;
  permitNumber?: string;
  preferredLanguage?: string;
  dateOfBirth?: string;
  instructorNotes?: string;
  targetCompletionDate?: string;
  badgesEarned?: number;
  drivingSchool?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  lastLoginAt?: string;
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

// ── Admin models ────────────────────────────────────────────

export interface AdminUserDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: Role;
  enabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AdminInstructorDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  enabled: boolean;
  createdAt: string;
  licenseNumber?: string;
  drivingSchool?: string;
  yearsOfExperience?: number;
  joinDate?: string;
  averageRating?: number;
  totalRatings?: number;
  activeStudents?: number;
  totalStudentsTaught?: number;
  availableForNewStudents?: boolean;
  maxStudents?: number;
}

export interface AdminStatsDTO {
  totalUsers: number;
  totalStudents: number;
  totalInstructors: number;
  totalAdmins: number;
  activeUsers: number;
  pendingInstructors: number;
  averageStudentCompletionPercentage: number;
  totalScenariosCompleted: number;
  averageInstructorRating: number;
  totalActiveStudents: number;
}

export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
