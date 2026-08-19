import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export type UserRole = 'STUDENT' | 'VOLUNTEER' | 'ADMIN' | 'EVENT_TEAM' | 'FACULTY';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  ixId?: string;
  niatId?: string;
  assignedWorkshopId?: Types.ObjectId;
  assignedHallName?: string;
  mustChangePassword?: boolean;
  failedLoginAttempts?: number;
  lockUntil?: Date;
  refreshTokenHash?: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Do not return by default in queries
    },
    role: {
      type: String,
      enum: {
        values: ['STUDENT', 'VOLUNTEER', 'ADMIN', 'EVENT_TEAM', 'FACULTY'],
        message: '{VALUE} is not a valid user role',
      },
      default: 'STUDENT',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'DISABLED'],
        message: '{VALUE} is not a valid status',
      },
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    ixId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    niatId: {
      type: String,
      default: null,
      trim: true,
    },
    assignedWorkshopId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
      index: true,
    },
    assignedHallName: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    refreshTokenHash: {
      type: String,
      select: false,
    },
    createdAt: {
      type: Date,
      default: getCurrentISTDate,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

UserSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', UserSchema);
