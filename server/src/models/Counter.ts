import mongoose, { Schema } from 'mongoose';

export interface ICounter {
  _id: string; // Identifier for the sequence, e.g. 'student_influencex_id', 'event_id_2026'
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      default: 0,
      required: true,
    },
  },
  {
    _id: false, // Disables automatic ObjectId generation since custom string _id is provided
    versionKey: false,
    timestamps: false,
  }
);

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);
