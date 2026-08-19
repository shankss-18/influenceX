import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export interface IEventCategory extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EventCategorySchema = new Schema<IEventCategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

EventCategorySchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const EventCategory = mongoose.model<IEventCategory>('EventCategory', EventCategorySchema);
