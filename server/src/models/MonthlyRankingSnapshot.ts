import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export interface IMonthlyRankingSnapshot extends Document {
  _id: Types.ObjectId;
  month: string; // Format: YYYY-MM
  studentId: Types.ObjectId;
  creditsThisMonth: number;
  totalCreditsAtSnapshot: number;
  rank: number;
  participationCount: number;
  completedEventsCount: number;
  snapshotTakenAt: Date;
  version: number;
}

const MonthlyRankingSnapshotSchema = new Schema<IMonthlyRankingSnapshot>(
  {
    month: {
      type: String,
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    creditsThisMonth: {
      type: Number,
      required: true,
      default: 0,
    },
    totalCreditsAtSnapshot: {
      type: Number,
      required: true,
      default: 0,
    },
    rank: {
      type: Number,
      required: true,
    },
    participationCount: {
      type: Number,
      default: 0,
    },
    completedEventsCount: {
      type: Number,
      default: 0,
    },
    snapshotTakenAt: {
      type: Date,
      default: getCurrentISTDate,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

MonthlyRankingSnapshotSchema.index({ month: 1, studentId: 1, version: 1 }, { unique: true });

MonthlyRankingSnapshotSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const MonthlyRankingSnapshot = mongoose.model<IMonthlyRankingSnapshot>(
  'MonthlyRankingSnapshot',
  MonthlyRankingSnapshotSchema
);
