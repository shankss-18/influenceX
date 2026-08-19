import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export type StudentStatus = 'PENDING' | 'APPROVED' | 'DISABLED';

export interface IProfileFields {
  bio?: string;
  photoUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

export interface IStudent extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  influenceXId: string;
  collegeStudentId: string;
  fullName: string;
  collegeEmail: string;
  phone?: string;
  branch: string;
  year: number;
  section: string;
  joiningDate: Date;
  status: StudentStatus;
  cachedTotalCredits: number;
  currentLevel: string;
  profileFields: IProfileFields;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Associated User ID is required'],
      unique: true,
      index: true,
    },
    influenceXId: {
      type: String,
      required: [true, 'InfluenceX ID is required'],
      unique: true,
      immutable: true, // NEVER reused or changed once assigned
      trim: true,
      index: true,
    },
    collegeStudentId: {
      type: String,
      required: [true, 'College Student Roll/ID is required'],
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full Name is required'],
      trim: true,
      index: true,
    },
    collegeEmail: {
      type: String,
      required: [true, 'College Email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    branch: {
      type: String,
      required: [true, 'Branch is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    year: {
      type: Number,
      required: [true, 'Academic Year is required'],
      min: 1,
      max: 5,
      index: true,
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    joiningDate: {
      type: Date,
      default: getCurrentISTDate,
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'APPROVED', 'DISABLED'],
        message: '{VALUE} is not a valid student status',
      },
      default: 'PENDING',
      required: true,
      index: true,
    },
    cachedTotalCredits: {
      type: Number,
      default: 0,
    },
    currentLevel: {
      type: String,
      default: 'Explorer',
    },
    profileFields: {
      bio: { type: String, default: '' },
      photoUrl: { type: String, default: '' },
      linkedinUrl: { type: String, default: '' },
      githubUrl: { type: String, default: '' },
    },
    createdAt: {
      type: Date,
      default: getCurrentISTDate,
    },
    updatedAt: {
      type: Date,
      default: getCurrentISTDate,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

StudentSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const Student = mongoose.model<IStudent>('Student', StudentSchema);
