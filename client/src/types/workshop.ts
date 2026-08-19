export type WorkshopStatus =
  | 'Live'
  | 'Setup Pending'
  | 'Ready'
  | 'Attendance Open'
  | 'Attendance Closed'
  | 'Ended';

export interface AssignedVolunteer {
  userId: string;
  name: string;
  ixId: string;
  niatId?: string;
  assignedAt?: string;
}

export interface WorkshopHall {
  _id?: string;
  name: string;
  capacity: number;
  assignedVolunteers?: AssignedVolunteer[];
}

export interface WorkshopSummary {
  id: string;
  eventId: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  status: WorkshopStatus;
  rawStatus: string;
  hallsCount: number;
  halls: WorkshopHall[];
  capacity?: number;
  totalCapacity: number;
  studentsAssigned: number;
  volunteersAssigned: number;
  minVolunteersNeeded: number;
  maxVolunteersNeeded: number;
  volunteersSetupCompleted: boolean;
  studentsSetupCompleted: boolean;
  creditCap: number;
  creditsIssuedSoFar: number;
  attendanceWindowStart: string;
  attendanceWindowEnd: string;
}

export interface VolunteerRosterItem {
  rowNumber: number;
  name: string;
  niatId: string;
  ixId: string;
  workshopName: string;
  isValid: boolean;
  issue?: string;
}

export interface StudentRosterItem {
  id?: string;
  studentId?: string;
  assignedOrder: number;
  name?: string;
  fullName?: string;
  ixId?: string;
  influenceXId?: string;
  niatId?: string;
  collegeStudentId?: string;
  collegeEmail?: string;
  branch?: string;
  hallName: string;
  isWaitlisted: boolean;
  status?: string;
}

export interface ConsoleStudentRow {
  id: string;
  studentId: string;
  fullName: string;
  influenceXId: string;
  collegeStudentId: string;
  branch: string;
  hallName: string;
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'NOT_MARKED';
  attendanceMarkedBy: string | null;
  attendanceMarkedAt: string | null;
  participated: boolean;
  participationNotes: string;
  registrationCredit: number;
  attendanceCredit: number;
  participationCredit: number;
  totalWorkshopCredits: number;
  capRemaining: number;
}
