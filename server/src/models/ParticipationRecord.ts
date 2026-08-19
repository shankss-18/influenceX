import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export interface IParticipationRecord extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  studentId: Types.ObjectId;
  participated: boolean;
  points?: number;
  recordedBy: Types.ObjectId;
  recordedAt: Date;
  evaluatedBy?: Types.ObjectId;
  evaluatedAt?: Date;
  notes?: string;
}

const ParticipationRecordSchema = new Schema<IParticipationRecord>(
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
    participated: {
      type: Boolean,
      default: true,
      required: true,
      index: true,
    },
    points: {
      type: Number,
      default: 0,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    recordedAt: {
      type: Date,
      default: getCurrentISTDate,
    },
    evaluatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    evaluatedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// DB-level unique compound index on (eventId, studentId)
ParticipationRecordSchema.index({ eventId: 1, studentId: 1 }, { unique: true });

ParticipationRecordSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const ParticipationRecord = mongoose.model<IParticipationRecord>(
  'ParticipationRecord',
  ParticipationRecordSchema
);
