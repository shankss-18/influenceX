import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export type RegistrationRegisteredBy = 'SELF' | 'ADMIN_IMPORT' | 'WORKSHOP_AUTO_ASSIGN';
export type RegistrationStatus = 'REGISTERED' | 'CANCELLED' | 'WAITLISTED';

export interface IEventRegistration extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  studentId: Types.ObjectId;
  hallName?: string;
  assignedOrder?: number;
  isWaitlisted?: boolean;
  registeredAt: Date;
  registeredBy: RegistrationRegisteredBy;
  status: RegistrationStatus;
}

const EventRegistrationSchema = new Schema<IEventRegistration>(
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
    hallName: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    assignedOrder: {
      type: Number,
      default: 0,
    },
    isWaitlisted: {
      type: Boolean,
      default: false,
    },
    registeredAt: {
      type: Date,
      default: getCurrentISTDate,
    },
    registeredBy: {
      type: String,
      enum: ['SELF', 'ADMIN_IMPORT', 'WORKSHOP_AUTO_ASSIGN'],
      default: 'SELF',
      required: true,
    },
    status: {
      type: String,
      enum: ['REGISTERED', 'CANCELLED', 'WAITLISTED'],
      default: 'REGISTERED',
      required: true,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound indexes
EventRegistrationSchema.index({ eventId: 1, studentId: 1 }, { unique: true });
EventRegistrationSchema.index({ eventId: 1, hallName: 1 });

EventRegistrationSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const EventRegistration = mongoose.model<IEventRegistration>(
  'EventRegistration',
  EventRegistrationSchema
);
