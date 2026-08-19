import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILevelThreshold extends Document {
  _id: Types.ObjectId;
  name: string;
  minCredits: number;
  order: number;
  badgeColor?: string;
  icon?: string;
  goodieName?: string;
  totalStock: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

const LevelThresholdSchema = new Schema<ILevelThreshold>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    minCredits: {
      type: Number,
      required: true,
      default: 0,
    },
    order: {
      type: Number,
      required: true,
      unique: true,
    },
    badgeColor: {
      type: String,
      default: '#4F46E5',
    },
    icon: {
      type: String,
      default: '🌱',
    },
    goodieName: {
      type: String,
      default: 'Club Goodie Kit',
    },
    totalStock: {
      type: Number,
      default: 50,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

LevelThresholdSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const LevelThreshold = mongoose.model<ILevelThreshold>(
  'LevelThreshold',
  LevelThresholdSchema
);
