import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export type GoodieStatus = 'PENDING' | 'ISSUED';

export interface IRankGoodie extends Document {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  levelName: string;
  goodieName: string;
  unlockedAt: Date;
  status: GoodieStatus;
  issuedAt?: Date | null;
  issuedBy?: Types.ObjectId | null;
  notes?: string;
}

const RankGoodieSchema = new Schema<IRankGoodie>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    levelName: {
      type: String,
      required: true,
      index: true,
    },
    goodieName: {
      type: String,
      required: true,
    },
    unlockedAt: {
      type: Date,
      default: getCurrentISTDate,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ISSUED'],
      default: 'PENDING',
      index: true,
    },
    issuedAt: {
      type: Date,
      default: null,
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index to prevent duplicate goodie records for the same tier
RankGoodieSchema.index({ studentId: 1, levelName: 1 }, { unique: true });

RankGoodieSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const RankGoodie = mongoose.model<IRankGoodie>('RankGoodie', RankGoodieSchema);
