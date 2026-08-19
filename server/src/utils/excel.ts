import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { Response } from 'express';
import { dayjs, DEFAULT_TIMEZONE } from '../config/timezone';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportOptions {
  res: Response;
  fileName: string;
  sheetName: string;
  columns: ExcelColumn[];
  rows: Record<string, any>[];
  title?: string;
}

// Ensure upload directories exist
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const ERROR_REPORTS_DIR = path.resolve(__dirname, '../../uploads/error_reports');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(ERROR_REPORTS_DIR)) {
  fs.mkdirSync(ERROR_REPORTS_DIR, { recursive: true });
}

export { UPLOADS_DIR, ERROR_REPORTS_DIR };

/**
 * Reusable server-side export to .xlsx with frozen headers, auto-filters, and styling
 */
export async function exportToExcel({
  res,
  fileName,
  sheetName,
  columns,
  rows,
}: ExportOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InfluenceX Platform (NIAT Influencers Club)';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }], // Frozen header row
  });

  // Assign columns
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(col.header.length + 6, 16),
  }));

  // Enable auto-filter on the header row
  const lastColLetter = String.fromCharCode(64 + columns.length);
  worksheet.autoFilter = `A1:${lastColLetter}1`;

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Dark slate header
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    };
  });

  // Add data rows
  rows.forEach((rowData, index) => {
    const row = worksheet.addRow(rowData);
    row.height = 22;
    row.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (index % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }, // Subtle zebra striping
        };
      }
    });
  });

  // Set response headers for direct .xlsx download
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fileName}_${dayjs().tz(DEFAULT_TIMEZONE).format('YYYYMMDD_HHmmss')}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
}

export interface ParsedRow {
  rowNumber: number;
  collegeStudentId?: string;
  influenceXId?: string;
  collegeEmail?: string;
  fullName?: string;
  rawData: Record<string, any>;
}

/**
 * Robust Excel (.xlsx) file parser for participant & volunteer rosters
 */
export async function parseExcelUpload(filePath: string): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel workbook contains no valid worksheets.');
  }

  const rows: ParsedRow[] = [];
  const headerMap: { [colIndex: number]: string } = {};

  // First identify header row (row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    let val = '';
    if (cell.text && typeof cell.text === 'string') {
      val = cell.text.trim();
    } else if (cell.value !== null && cell.value !== undefined) {
      if (typeof cell.value === 'object' && 'result' in cell.value) {
        val = String((cell.value as any).result || '').trim();
      } else {
        val = String(cell.value).trim();
      }
    }
    headerMap[colNumber] = val.toLowerCase().replace(/[^a-z0-9]/g, '');
  });

  const totalRows = Math.max(worksheet.rowCount, worksheet.actualRowCount);

  for (let rowNumber = 2; rowNumber <= totalRows; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const rawData: Record<string, any> = {};
    let collegeStudentId: string | undefined;
    let influenceXId: string | undefined;
    let collegeEmail: string | undefined;
    let fullName: string | undefined;

    let hasAnyData = false;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const headerKey = headerMap[colNumber] || `col${colNumber}`;
      let cellValue = '';

      if (cell.text && typeof cell.text === 'string') {
        cellValue = cell.text.trim();
      } else if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object' && 'result' in cell.value) {
          cellValue = String((cell.value as any).result || '').trim();
        } else if (typeof cell.value === 'object' && 'richText' in cell.value && Array.isArray((cell.value as any).richText)) {
          cellValue = (cell.value as any).richText.map((t: any) => t.text || '').join('').trim();
        } else {
          cellValue = String(cell.value).trim();
        }
      }

      if (cellValue) {
        hasAnyData = true;
      }

      rawData[headerKey] = cellValue;

      const upperVal = cellValue.toUpperCase();

      // Detect college student ID / Roll No / NIAT ID (e.g. N25HO1A0451, N25H01A0451)
      if (
        headerKey.includes('niat') ||
        headerKey.includes('roll') ||
        headerKey.includes('collegestudentid') ||
        headerKey.includes('studentid') ||
        headerKey.includes('collegeid') ||
        headerKey === 'id' ||
        upperVal.startsWith('N25') ||
        upperVal.startsWith('NIAT')
      ) {
        if (!collegeStudentId && cellValue) collegeStudentId = cellValue.trim();
      }

      // Detect InfluenceX ID (e.g. IX0451, IX0972, IX-000101)
      if (
        headerKey.includes('influencex') ||
        headerKey.includes('ixid') ||
        headerKey === 'ix' ||
        upperVal.startsWith('IX')
      ) {
        if (!influenceXId && cellValue) influenceXId = upperVal.trim();
      }

      // Detect Email
      if (headerKey.includes('email') || headerKey.includes('mail') || cellValue.includes('@')) {
        if (!collegeEmail && cellValue && cellValue.includes('@')) collegeEmail = cellValue.toLowerCase().trim();
      }

      // Detect Full Name
      if (
        headerKey === 'name' ||
        headerKey.includes('fullname') ||
        headerKey.includes('studentname') ||
        headerKey.includes('participantname') ||
        (headerKey.includes('name') && !headerKey.includes('hall') && !headerKey.includes('workshop'))
      ) {
        if (!fullName && cellValue) fullName = cellValue.trim();
      }
    });

    if (hasAnyData) {
      rows.push({
        rowNumber,
        collegeStudentId,
        influenceXId,
        collegeEmail,
        fullName,
        rawData,
      });
    }
  }

  return rows;
}

export interface FailedImportRow {
  rowNumber: number;
  collegeStudentId?: string;
  fullName?: string;
  collegeEmail?: string;
  reason: string;
  rawData: Record<string, any>;
}

/**
 * Generates an error report .xlsx file on disk for rejected rows
 */
export async function generateErrorReportFile(
  failedRows: FailedImportRow[],
  originalFileName: string
): Promise<{ fileName: string; filePath: string }> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Import_Errors');

  worksheet.columns = [
    { header: 'Row #', key: 'rowNumber', width: 10 },
    { header: 'College Student ID', key: 'collegeStudentId', width: 22 },
    { header: 'Full Name', key: 'fullName', width: 26 },
    { header: 'College Email', key: 'collegeEmail', width: 30 },
    { header: 'Failure Reason', key: 'reason', width: 45 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDC2626' }, // Red header for error file
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  failedRows.forEach((item) => {
    worksheet.addRow({
      rowNumber: item.rowNumber,
      collegeStudentId: item.collegeStudentId || 'N/A',
      fullName: item.fullName || 'N/A',
      collegeEmail: item.collegeEmail || 'N/A',
      reason: item.reason,
    });
  });

  const timestamp = dayjs().tz(DEFAULT_TIMEZONE).format('YYYYMMDD_HHmmss');
  const safeBaseName = path.basename(originalFileName, path.extname(originalFileName));
  const reportFileName = `errors_${safeBaseName}_${timestamp}.xlsx`;
  const reportFilePath = path.join(ERROR_REPORTS_DIR, reportFileName);

  await workbook.xlsx.writeFile(reportFilePath);
  return { fileName: reportFileName, filePath: reportFilePath };
}
