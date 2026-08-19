export type UserRole = 'STUDENT' | 'VOLUNTEER' | 'ADMIN' | 'EVENT_TEAM' | 'FACULTY';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type StudentStatus = 'PENDING' | 'APPROVED' | 'DISABLED';
export type EventStatus = 'DRAFT' | 'OPEN' | 'ONGOING' | 'COMPLETED' | 'ARCHIVED';
export type WindowStatus = 'NOT_STARTED' | 'OPEN' | 'CLOSED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE' | 'CORRECTION_REQUESTED';
export type CorrectionStatus = 'NONE' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export type CreditRuleType =
  | 'REGISTRATION'
  | 'ATTENDANCE'
  | 'PARTICIPATION'
  | 'INTERACTION'
  | 'FINALIST'
  | 'WINNER'
  | 'RUNNER_UP'
  | 'VOLUNTEER'
  | 'TEAM_MEMBER'
  | 'TEAM_LEAD'
  | 'COMMUNITY_CONTRIBUTION'
  | 'SPECIAL_RECOGNITION'
  | 'MANUAL_ADJUSTMENT'
  | 'CORRECTION'
  | 'REVERSAL';

export type CreditTransactionStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type RewardStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
export type RewardClaimStatus = 'REQUESTED' | 'APPROVED' | 'DISTRIBUTED' | 'REJECTED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  ixId?: string;
  mustChangePassword?: boolean;
  assignedHallName?: string;
  assignedWorkshopId?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Student {
  id: string;
  userId: string | User;
  influenceXId: string;
  collegeStudentId: string;
  fullName: string;
  collegeEmail: string;
  phone?: string;
  branch: string;
  year: number;
  section: string;
  joiningDate: string;
  status: StudentStatus;
  cachedTotalCredits: number;
  currentLevel: string;
  profileFields: {
    bio?: string;
    photoUrl?: string;
    linkedinUrl?: string;
    githubUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EventCategory {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WindowInterval {
  status: WindowStatus;
  start: string;
  startIST: string;
  end: string;
  endIST: string;
  isOpen: boolean;
}

export interface EventWindowStatuses {
  serverTime: string;
  serverTimeIST: string;
  registration: WindowInterval;
  attendance: WindowInterval;
  credit: WindowInterval;
}

export interface EventItem {
  id: string;
  eventId: string;
  name: string;
  description: string;
  categoryId: EventCategory | string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  capacity: number;
  assignedEventTeamUserIds?: string[] | User[];
  registrationStart: string;
  registrationEnd: string;
  attendanceWindowStart: string;
  attendanceWindowEnd: string;
  creditWindowStart: string;
  creditWindowEnd: string;
  status: EventStatus;
  createdBy: string | User;
  updatedBy: string | User;
  createdAt: string;
  updatedAt: string;
  registeredCount: number;
  availableSpots: number;
  isFull: boolean;
  windowStatuses: EventWindowStatuses;
  isUserRegistered?: boolean;
}

export interface EventRegistration {
  id: string;
  eventId: string | EventItem;
  studentId: string | Student;
  registeredAt: string;
  registeredBy: 'SELF' | 'ADMIN_IMPORT';
  status: 'REGISTERED' | 'CANCELLED' | 'WAITLISTED';
}

export interface Attendance {
  id: string;
  eventId: string;
  studentId: string | Student;
  status: AttendanceStatus;
  markedBy: string | User;
  markedAt: string;
  correctionReason?: string | null;
  correctionStatus: CorrectionStatus;
  requestedStatus?: AttendanceStatus | null;
  requestedBy?: string | User | null;
  approvedBy?: string | User | null;
  lastUpdatedBy?: string | User | null;
  lastUpdatedAt: string;
}

export interface ParticipationRecord {
  id: string;
  eventId: string;
  studentId: string | Student;
  participated: boolean;
  recordedBy: string | User;
  recordedAt: string;
  notes?: string;
}

export interface EventRosterItem {
  registrationId: string;
  registeredAt: string;
  student: Student;
  attendance: Attendance | null;
  participation: ParticipationRecord | null;
}

export interface CreditRule {
  id: string;
  type: CreditRuleType;
  name: string;
  description: string;
  defaultAmount: number;
  isActive: boolean;
  requiresSecondApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  transactionId: string;
  studentId: Student | string;
  eventId?: EventItem | string | null;
  creditType: CreditRuleType;
  amount: number;
  reason: string;
  relatesTo?: string | null;
  awardedBy: User | string;
  approvedBy?: User | string | null;
  status: CreditTransactionStatus;
  createdAt: string;
  approvedAt?: string | null;
}

export interface LevelThreshold {
  id: string;
  name: string;
  minCredits: number;
  order: number;
  badgeColor?: string;
}

export interface MonthlyRankingSnapshot {
  id: string;
  month: string;
  studentId: Student | string;
  creditsThisMonth: number;
  totalCreditsAtSnapshot: number;
  rank: number;
  participationCount: number;
  completedEventsCount: number;
  snapshotTakenAt: string;
  version: number;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredCredits: number;
  totalQuantity: number;
  availableQuantity: number;
  imageUrl?: string;
  status: RewardStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RewardClaim {
  id: string;
  rewardId: Reward | string;
  studentId: Student | string;
  requestedAt: string;
  status: RewardClaimStatus;
  verifiedBy?: User | string | null;
  distributedBy?: User | string | null;
  distributedAt?: string | null;
  notes?: string;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  influenceXId: string;
  fullName: string;
  branch: string;
  year: number;
  section: string;
  currentLevel: string;
  credits: number;
  totalAllTimeCredits?: number;
}

export interface ExcelImport {
  id: string;
  importId: string;
  eventId: string;
  fileName: string;
  fileSize: number;
  uploadedBy: User;
  uploadedAt: string;
  totalRows: number;
  importedCount: number;
  rejectedCount: number;
  status: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';
  originalFilePath: string;
  errorReportPath?: string | null;
}

export interface ImportPreviewError {
  rowNumber: number;
  collegeStudentId?: string;
  fullName?: string;
  collegeEmail?: string;
  reason: string;
  rawData: Record<string, any>;
}

export interface ImportPreview {
  tempFilePath: string;
  originalFileName: string;
  fileSize: number;
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  unknownStudentCount: number;
  missingFieldCount: number;
  validRows: Array<{
    rowNumber: number;
    studentId: string;
    student: {
      id: string;
      influenceXId: string;
      collegeStudentId: string;
      fullName: string;
      collegeEmail: string;
      branch: string;
      year: number;
    };
  }>;
  errors: ImportPreviewError[];
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RankGoodie {
  id: string;
  studentId: {
    id: string;
    fullName: string;
    influenceXId: string;
    collegeStudentId: string;
    branch: string;
    year: number;
    section: string;
    currentLevel: string;
    cachedTotalCredits: number;
  };
  levelName: string;
  goodieName: string;
  unlockedAt: string;
  status: 'PENDING' | 'ISSUED';
  issuedAt?: string | null;
  issuedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  notes?: string;
}
