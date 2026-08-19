import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actorUserId?: Types.ObjectId | null;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  beforeValue?: any;
  afterValue?: any;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
      default: 'ANONYMOUS',
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      default: null,
      index: true,
    },
    targetId: {
      type: String,
      default: null,
      index: true,
    },
    beforeValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    afterValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: 'unknown',
    },
    userAgent: {
      type: String,
      default: 'unknown',
    },
    createdAt: {
      type: Date,
      default: getCurrentISTDate,
      immutable: true, // Cannot be updated
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Append-only guarantee: Prevent update or delete at the schema level if ever invoked
AuditLogSchema.pre('updateOne', function () {
  throw new Error('AuditLog is append-only. Updates are prohibited.');
});
AuditLogSchema.pre('updateMany', function () {
  throw new Error('AuditLog is append-only. Updates are prohibited.');
});
AuditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('AuditLog is append-only. Updates are prohibited.');
});
AuditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('AuditLog is append-only. Deletions are prohibited.');
});
AuditLogSchema.pre('deleteOne', function () {
  throw new Error('AuditLog is append-only. Deletions are prohibited.');
});
AuditLogSchema.pre('deleteMany', function () {
  throw new Error('AuditLog is append-only. Deletions are prohibited.');
});

AuditLogSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
