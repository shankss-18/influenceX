import mongoose, { Document, Schema, Types } from 'mongoose';

export type RewardStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';

export interface IReward extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  category: string;
  requiredCredits: number;
  totalQuantity: number;
  availableQuantity: number;
  imageUrl?: string;
  status: RewardStatus;
  createdAt: Date;
  updatedAt: Date;
}

const RewardSchema = new Schema<IReward>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: true,
      default: 'Goodies',
    },
    requiredCredits: {
      type: Number,
      required: true,
      min: [0, 'Required credits cannot be negative'],
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: [0, 'Total quantity cannot be negative'],
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: [0, 'Available quantity cannot be negative'],
    },
    imageUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'],
      default: 'ACTIVE',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

RewardSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const Reward = mongoose.model<IReward>('Reward', RewardSchema);
