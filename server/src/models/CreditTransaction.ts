import mongoose, { Document, Schema, Types } from 'mongoose';
import { CreditRuleType } from './CreditRule';
import { getCurrentISTDate } from '../utils/timezone';

export type CreditTransactionStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface ICreditTransaction extends Document {
  _id: Types.ObjectId;
  transactionId: string;
  studentId: Types.ObjectId;
  eventId?: Types.ObjectId | null;
  creditType: CreditRuleType;
  amount: number;
  reason: string;
  relatesTo?: string | null;
  awardedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId | null;
  status: CreditTransactionStatus;
  createdAt: Date;
  updatedAt?: Date;
  approvedAt?: Date | null;
}

const CreditTransactionSchema = new Schema<ICreditTransaction>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student ID is required'],
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
      index: true,
    },
    creditType: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason is mandatory for every credit transaction'],
      trim: true,
    },
    relatesTo: {
      type: String,
      default: null,
    },
    awardedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'APPROVED',
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: getCurrentISTDate,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Prevent direct updates and deletions at schema level (Allow only status changes via approval method)
CreditTransactionSchema.pre('deleteOne', function () {
  throw new Error('CreditTransaction collection is append-only. Transactions cannot be deleted.');
});

CreditTransactionSchema.pre('deleteMany', function () {
  throw new Error('CreditTransaction collection is append-only. Transactions cannot be deleted.');
});

CreditTransactionSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const CreditTransaction = mongoose.model<ICreditTransaction>(
  'CreditTransaction',
  CreditTransactionSchema
);
