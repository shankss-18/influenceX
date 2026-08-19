import mongoose, { Document, Schema, Types } from 'mongoose';
import { getCurrentISTDate } from '../utils/timezone';

export type ExcelImportStatus = 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';

export interface IExcelImport extends Document {
  _id: Types.ObjectId;
  importId: string;
  eventId: Types.ObjectId;
  fileName: string;
  fileSize: number;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
  totalRows: number;
  importedCount: number;
  rejectedCount: number;
  status: ExcelImportStatus;
  originalFilePath: string;
  errorReportPath?: string | null;
}

const ExcelImportSchema = new Schema<IExcelImport>(
  {
    importId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: getCurrentISTDate,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    importedCount: {
      type: Number,
      default: 0,
    },
    rejectedCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'],
      default: 'COMPLETED',
      required: true,
    },
    originalFilePath: {
      type: String,
      required: true,
    },
    errorReportPath: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

ExcelImportSchema.set('toJSON', {
  transform: function (_doc, ret: Record<string, any>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const ExcelImport = mongoose.model<IExcelImport>('ExcelImport', ExcelImportSchema);
