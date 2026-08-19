import mongoose, { Document, Schema, Types } from 'mongoose';

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

export interface ICreditRule extends Document {
  _id: Types.ObjectId;
  type: CreditRuleType;
  name: string;
  description: string;
  defaultAmount: number;
  isActive: boolean;
  requiresSecondApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CreditRuleSchema = new Schema<ICreditRule>(
  {
    type: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    defaultAmount: {
      type: Number,
      required: true,
      default: 10,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    requiresSecondApproval: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

CreditRuleSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const CreditRule = mongoose.model<ICreditRule>('CreditRule', CreditRuleSchema);
