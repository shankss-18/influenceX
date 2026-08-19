import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export type WorkshopStatus =
  | 'Live'
  | 'Setup Pending'
  | 'Ready'
  | 'Attendance Open'
  | 'Attendance Closed'
  | 'Ended'
  | 'DRAFT'
  | 'OPEN'
  | 'ONGOING'
  | 'COMPLETED'
  | 'ARCHIVED';

export interface IAssignedVolunteer {
  userId: Types.ObjectId;
  name: string;
  ixId: string;
  niatId?: string;
  assignedAt?: Date;
}

export interface IWorkshopHall {
  _id?: Types.ObjectId;
  name: string;
  capacity: number;
  assignedVolunteers?: IAssignedVolunteer[];
}

export interface IEvent extends Document {
  _id: Types.ObjectId;
  eventId: string;
  name: string;
  description: string;
  categoryId?: Types.ObjectId;
  date: Date;
  startTime: string;
  endTime: string;
  venue: string;
  hall?: string;
  halls: IWorkshopHall[];
  capacity: number;
  creditCap: number;
  assignedEventTeamUserIds: Types.ObjectId[];
  registrationStart: Date;
  registrationEnd: Date;
  attendanceWindowStart: Date;
  attendanceWindowEnd: Date;
  creditWindowStart: Date;
  creditWindowEnd: Date;
  interactionWindowStart?: Date;
  interactionWindowEnd?: Date;
  volunteersSetupCompleted: boolean;
  studentsSetupCompleted: boolean;
  credentialsGeneratedAt?: Date;
  registrationFormUrl?: string;
  status: WorkshopStatus;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  computedStatus?: string;
}

const AssignedVolunteerSchema = new Schema<IAssignedVolunteer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    ixId: { type: String, required: true },
    niatId: { type: String, default: '' },
    assignedAt: { type: Date, default: getCurrentISTDate },
  },
  { _id: false }
);

const WorkshopHallSchema = new Schema<IWorkshopHall>(
  {
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    assignedVolunteers: { type: [AssignedVolunteerSchema], default: [] },
  },
  { _id: true }
);

const EventSchema = new Schema<IEvent>(
  {
    eventId: {
      type: String,
      required: [true, 'Event ID is required'],
      unique: true,
      immutable: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'EventCategory',
      default: null,
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
      index: true,
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true,
    },
    venue: {
      type: String,
      default: 'Campus Venues',
      trim: true,
    },
    hall: {
      type: String,
      default: '',
      trim: true,
    },
    halls: {
      type: [WorkshopHallSchema],
      default: [],
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      default: 50,
    },
    creditCap: {
      type: Number,
      default: 50,
      min: 1,
    },
    assignedEventTeamUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    registrationStart: {
      type: Date,
      default: getCurrentISTDate,
    },
    registrationEnd: {
      type: Date,
      default: getCurrentISTDate,
    },
    attendanceWindowStart: {
      type: Date,
      required: [true, 'Attendance window start is required'],
    },
    attendanceWindowEnd: {
      type: Date,
      required: [true, 'Attendance window end is required'],
    },
    creditWindowStart: {
      type: Date,
      default: getCurrentISTDate,
    },
    creditWindowEnd: {
      type: Date,
      default: getCurrentISTDate,
    },
    interactionWindowStart: {
      type: Date,
      default: null,
    },
    interactionWindowEnd: {
      type: Date,
      default: null,
    },
    volunteersSetupCompleted: {
      type: Boolean,
      default: false,
    },
    studentsSetupCompleted: {
      type: Boolean,
      default: false,
    },
    credentialsGeneratedAt: {
      type: Date,
      default: null,
    },
    registrationFormUrl: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      default: 'Live',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: getCurrentISTDate,
    },
    updatedAt: {
      type: Date,
      default: getCurrentISTDate,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

EventSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id?.toString();
    return ret;
  },
});

/**
 * Computes dynamic status for the 4-screen workshop lifecycle
 */
export function computeWorkshopLifecycleStatus(event: IEvent, now: Date = getCurrentISTDate()): WorkshopStatus {
  if (event.status === 'Ended' || event.status === 'COMPLETED' || event.status === 'ARCHIVED') {
    return 'Ended';
  }

  // Check if setup is completed
  const hasHalls = event.halls && event.halls.length > 0;
  const isSetupDone = event.volunteersSetupCompleted && event.studentsSetupCompleted;

  if (!isSetupDone) {
    return 'Setup Pending';
  }

  const nowTime = now.getTime();
  const windowStart = new Date(event.attendanceWindowStart).getTime();
  const windowEnd = new Date(event.attendanceWindowEnd).getTime();

  if (nowTime < windowStart) {
    return 'Ready';
  }

  if (nowTime >= windowStart && nowTime <= windowEnd) {
    return 'Attendance Open';
  }

  return 'Attendance Closed';
}

EventSchema.set('toJSON', {
  transform: function (doc: any, ret: Record<string, any>) {
    ret.id = ret._id;
    ret.computedStatus = computeWorkshopLifecycleStatus(doc);
    delete ret._id;
    return ret;
  },
});

export const Event = mongoose.model<IEvent>('Event', EventSchema);
