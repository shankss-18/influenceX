import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import fs from 'fs';
import path from 'path';
import { Event } from '../models/Event';
import { Student, IStudent } from '../models/Student';
import { EventRegistration } from '../models/EventRegistration';
import { ExcelImport } from '../models/ExcelImport';
import { CreditTransaction } from '../models/CreditTransaction';
import { generateNextTransactionId } from '../utils/sequence';
import { recalculateStudentLevelAndCache } from '../utils/ledger';
import {
  parseExcelUpload,
  generateErrorReportFile,
  FailedImportRow,
  ERROR_REPORTS_DIR,
} from '../utils/excel';
import { createAuditLog } from '../utils/audit';
import { getCurrentISTDate } from '../utils/timezone';

export async function previewParticipantImport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        error: 'No Excel file was uploaded. Please provide a valid .xlsx file.',
      });
      return;
    }

    const event = await Event.findById(id);
    if (!event) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    // Parse Excel rows
    const parsedRows = await parseExcelUpload(file.path);

    const validRows: Array<{
      rowNumber: number;
      studentId: string;
      student: any;
    }> = [];

    const errors: FailedImportRow[] = [];
    const seenRollNumbersInFile = new Set<string>();
    const seenEmailsInFile = new Set<string>();

    let duplicateCount = 0;
    let unknownStudentCount = 0;
    let missingFieldCount = 0;

    // Fetch existing registrations for this event to detect duplicates
    const existingRegistrations = await EventRegistration.find({
      eventId: event._id,
      status: 'REGISTERED',
    }).select('studentId');
    const existingStudentIdsSet = new Set(existingRegistrations.map((r) => r.studentId.toString()));

    // Process each row
    for (const row of parsedRows) {
      const roll = row.collegeStudentId?.trim();
      const ixId = row.influenceXId?.trim();
      const email = row.collegeEmail?.trim().toLowerCase();

      // Check 1: Missing identification fields
      if (!roll && !ixId && !email) {
        missingFieldCount++;
        errors.push({
          rowNumber: row.rowNumber,
          collegeStudentId: roll,
          fullName: row.fullName,
          collegeEmail: email,
          reason: 'Missing required student identifier (College Roll No, InfluenceX ID, or College Email).',
          rawData: row.rawData,
        });
        continue;
      }

      // Check 2: In-file duplicate check
      const identifierKey = roll || ixId || email!;
      if (seenRollNumbersInFile.has(identifierKey)) {
        duplicateCount++;
        errors.push({
          rowNumber: row.rowNumber,
          collegeStudentId: roll,
          fullName: row.fullName,
          collegeEmail: email,
          reason: `Duplicate row in upload file: '${identifierKey}' appeared multiple times in this spreadsheet.`,
          rawData: row.rawData,
        });
        continue;
      }
      seenRollNumbersInFile.add(identifierKey);

      // Check 3: Lookup Student in database
      const studentQuery: any = { $or: [] };
      if (roll) studentQuery.$or.push({ collegeStudentId: roll });
      if (ixId) studentQuery.$or.push({ influenceXId: ixId });
      if (email) studentQuery.$or.push({ collegeEmail: email });

      const student = await Student.findOne(studentQuery);
      if (!student) {
        unknownStudentCount++;
        errors.push({
          rowNumber: row.rowNumber,
          collegeStudentId: roll,
          fullName: row.fullName,
          collegeEmail: email,
          reason: `Unknown Student: No active student profile found matching '${identifierKey}'.`,
          rawData: row.rawData,
        });
        continue;
      }

      // Check 4: Already registered for this event (system duplicate)
      if (existingStudentIdsSet.has(student._id.toString())) {
        duplicateCount++;
        errors.push({
          rowNumber: row.rowNumber,
          collegeStudentId: roll || student.collegeStudentId,
          fullName: row.fullName || student.fullName,
          collegeEmail: email || student.collegeEmail,
          reason: `Already registered: Student (${student.fullName} - ${student.influenceXId}) is already enrolled in this event.`,
          rawData: row.rawData,
        });
        continue;
      }

      // Valid row
      validRows.push({
        rowNumber: row.rowNumber,
        studentId: student._id.toString(),
        student: {
          id: student._id.toString(),
          influenceXId: student.influenceXId,
          collegeStudentId: student.collegeStudentId,
          fullName: student.fullName,
          collegeEmail: student.collegeEmail,
          branch: student.branch,
          year: student.year,
        },
      });
    }

    // Return PREVIEW without modifying the database
    res.status(200).json({
      success: true,
      preview: {
        tempFilePath: file.path,
        originalFileName: file.originalname,
        fileSize: file.size,
        totalRows: parsedRows.length,
        validCount: validRows.length,
        duplicateCount,
        unknownStudentCount,
        missingFieldCount,
        validRows,
        errors,
      },
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
}

export async function commitParticipantImport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const {
      tempFilePath,
      originalFileName,
      fileSize = 0,
      totalRows = 0,
      validStudentIds = [],
      errors = [],
    } = req.body;

    const event = await Event.findById(id);
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    if (!Array.isArray(validStudentIds) || validStudentIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid student records provided to import.',
      });
      return;
    }

    // 1. Bulk insert EventRegistration documents
    const registrationDocs = validStudentIds.map((studentId) => ({
      eventId: event._id,
      studentId: new Types.ObjectId(studentId),
      registeredAt: getCurrentISTDate(),
      registeredBy: 'ADMIN_IMPORT',
      status: 'REGISTERED',
    }));

    // Use unordered bulk insert with ignore duplicate errors if any edge case
    let importedCount = 0;
    try {
      const insertResult = await EventRegistration.insertMany(registrationDocs, {
        ordered: false,
      });
      importedCount = insertResult.length;
    } catch (bulkErr: any) {
      if (bulkErr.insertedDocs) {
        importedCount = bulkErr.insertedDocs.length;
      }
    }

    // Auto-award default +10 registration credits to all imported students
    for (const studentId of validStudentIds) {
      const sObjId = new Types.ObjectId(studentId);
      const existingRegTx = await CreditTransaction.findOne({
        studentId: sObjId,
        eventId: event._id,
        creditType: 'REGISTRATION',
      });

      if (!existingRegTx) {
        const transactionId = await generateNextTransactionId();
        await CreditTransaction.create({
          transactionId,
          studentId: sObjId,
          eventId: event._id,
          creditType: 'REGISTRATION',
          amount: 10,
          reason: `Default registration credit for workshop: ${event.name} (Batch imported)`,
          awardedBy: req.user!._id,
          status: 'APPROVED',
          createdAt: getCurrentISTDate(),
          approvedAt: getCurrentISTDate(),
        });

        await recalculateStudentLevelAndCache(sObjId);
      }
    }

    // 2. Generate error report file on disk if errors exist
    let errorReportPath: string | null = null;
    if (Array.isArray(errors) && errors.length > 0) {
      const errReport = await generateErrorReportFile(errors, originalFileName || 'import.xlsx');
      errorReportPath = errReport.fileName;
    }

    // 3. Create ExcelImport record
    const importId = `IMP-${Date.now().toString(36).toUpperCase()}`;
    const status =
      errors.length === 0
        ? 'COMPLETED'
        : importedCount > 0
        ? 'PARTIALLY_COMPLETED'
        : 'FAILED';

    const excelImport = await ExcelImport.create({
      importId,
      eventId: event._id,
      fileName: originalFileName || 'uploaded_participants.xlsx',
      fileSize: fileSize || 0,
      uploadedBy: req.user!._id,
      uploadedAt: getCurrentISTDate(),
      totalRows,
      importedCount,
      rejectedCount: errors.length,
      status,
      originalFilePath: tempFilePath || '',
      errorReportPath,
    });

    // 4. Record AuditLog
    await createAuditLog({
      req,
      action: 'EXCEL_PARTICIPANTS_IMPORTED',
      targetType: 'EXCEL_IMPORT',
      targetId: excelImport._id.toString(),
      afterValue: {
        importId,
        eventId: event.eventId,
        fileName: originalFileName,
        totalRows,
        importedCount,
        rejectedCount: errors.length,
        status,
      },
      reason: `Batch imported ${importedCount} participants for event '${event.name}' (${event.eventId}) via Excel`,
    });

    res.status(201).json({
      success: true,
      message: `Successfully imported ${importedCount} participants (${errors.length} rejected).`,
      importRecord: excelImport.toJSON(),
      errorReportAvailable: !!errorReportPath,
    });
  } catch (error) {
    next(error);
  }
}

export async function listEventImports(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const imports = await ExcelImport.find({ eventId: id })
      .populate('uploadedBy', 'name email role')
      .sort({ uploadedAt: -1 });

    res.status(200).json({
      success: true,
      count: imports.length,
      imports: imports.map((imp) => imp.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadErrorReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { importId } = req.params;

    const excelImport = await ExcelImport.findOne({
      $or: [{ _id: Types.ObjectId.isValid(importId) ? importId : null }, { importId }],
    });

    if (!excelImport || !excelImport.errorReportPath) {
      res.status(404).json({
        success: false,
        error: 'Error report not found or no errors occurred during this import.',
      });
      return;
    }

    if (!fs.existsSync(excelImport.errorReportPath)) {
      res.status(404).json({
        success: false,
        error: 'The requested error report file is no longer available on disk.',
      });
      return;
    }

    const downloadName = `ErrorReport_${excelImport.importId}.xlsx`;
    res.download(excelImport.errorReportPath, downloadName);
  } catch (error) {
    next(error);
  }
}
