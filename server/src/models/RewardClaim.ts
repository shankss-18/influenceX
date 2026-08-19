import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export type RewardClaimStatus = 'REQUESTED' | 'APPROVED' | 'DISTRIBUTED' | 'REJECTED';

export interface IRewardClaim extends Document {
  _id: Types.ObjectId;
  rewardId: Types.ObjectId;
  studentId: Types.ObjectId;
  requestedAt: Date;
  status: RewardClaimStatus;
  verifiedBy?: Types.ObjectId | null;
  distributedBy?: Types.ObjectId | null;
  distributedAt?: Date | null;
  notes?: string;
}

const RewardClaimSchema = new Schema<IRewardClaim>(
  {
    rewardId: {
      type: Schema.Types.ObjectId,
      ref: 'Reward',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    requestedAt: {
      type: Date,
      default: getCurrentISTDate,
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'DISTRIBUTED', 'REJECTED'],
      default: 'REQUESTED',
      required: true,
      index: true,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    distributedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    distributedAt: {
      type: Date,
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

RewardClaimSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const RewardClaim = mongoose.model<IRewardClaim>('RewardClaim', RewardClaimSchema);
