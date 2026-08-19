import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'EXCUSED'
  | 'LATE'
  | 'CORRECTION_REQUESTED';

export type CorrectionStatus =
  | 'NONE'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: AttendanceStatus;
  markedBy: Types.ObjectId;
  markedAt: Date;
  correctionReason?: string | null;
  correctionStatus: CorrectionStatus;
  requestedStatus?: AttendanceStatus | null;
  requestedBy?: Types.ObjectId | null;
  approvedBy?: Types.ObjectId | null;
  lastUpdatedBy?: Types.ObjectId | null;
  lastUpdatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'EXCUSED', 'LATE', 'CORRECTION_REQUESTED'],
      default: 'PRESENT',
      required: true,
      index: true,
    },
    markedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    markedAt: {
      type: Date,
      default: getCurrentISTDate,
    },
    correctionReason: {
      type: String,
      default: null,
    },
    correctionStatus: {
      type: String,
      enum: ['NONE', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'NONE',
    },
    requestedStatus: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'EXCUSED', 'LATE', null],
      default: null,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastUpdatedAt: {
      type: Date,
      default: getCurrentISTDate,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// DB-level unique compound index on (eventId, studentId)
AttendanceSchema.index({ eventId: 1, studentId: 1 }, { unique: true });

AttendanceSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
