import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import dns from 'dns';
import path from 'path';
import fs from 'fs';
import { env } from '../src/config/env';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Akash', 'Ananya', 'Aryan', 'Bhavya', 'Chetan', 'Deepika', 'Dev', 'Diya',
  'Eshan', 'Gaurav', 'Harini', 'Ishaan', 'Jaya', 'Kabir', 'Kavya', 'Karan', 'Khushi', 'Laksh',
  'Manish', 'Meera', 'Mohit', 'Neha', 'Nikhil', 'Nisha', 'Omkar', 'Pooja', 'Pranav', 'Priya',
  'Rahul', 'Rhea', 'Rohan', 'Roshni', 'Sahil', 'Sakshi', 'Sameer', 'Sanvi', 'Siddharth', 'Simran',
  'Sparsh', 'Tanvi', 'Tarun', 'Trisha', 'Utkarsh', 'Varun', 'Vidya', 'Vivek', 'Yash', 'Zoya'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Rao', 'Nair', 'Mehta', 'Gupta', 'Singh', 'Chauhan',
  'Joshi', 'Bose', 'Iyer', 'Deshmukh', 'Mishra', 'Agarwal', 'Kapoor', 'Malhotra', 'Bhatia', 'Saxena'
];

const BRANCHES = [
  'Computer Science & Engineering',
  'Information Technology',
  'Artificial Intelligence & DS',
  'Electronics & Communication',
  'Mechanical Engineering'
];

const HALLS = [
  'Auditorium Hall A',
  'Seminar Hall B',
  'Innovation Lab 1',
  'Main Amphitheatre',
  'Conference Room C'
];

async function createSampleParticipants() {
  console.log('================================================================');
  console.log('   GENERATING SAMPLE 50 PARTICIPANTS EXCEL & PROVISIONING DB   ');
  console.log('================================================================\n');

  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  const db = mongoose.connection.db!;
  const usersColl = db.collection('users');
  const studentsColl = db.collection('students');

  const studentsData: Array<{
    fullName: string;
    influenceXId: string;
    collegeStudentId: string;
    collegeEmail: string;
    branch: string;
    year: number;
    hall: string;
  }> = [];

  const now = new Date();

  for (let i = 1; i <= 50; i++) {
    const firstName = FIRST_NAMES[i - 1];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;
    const ixIdNumber = String(i + 100).padStart(6, '0');
    const ixId = `IX-${ixIdNumber}`;
    const rollNo = `23CS${String(i).padStart(3, '0')}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@influencex.niat.edu`;
    const branch = BRANCHES[i % BRANCHES.length];
    const year = (i % 4) + 1;
    const hall = HALLS[i % HALLS.length];

    const userResult = await usersColl.findOneAndUpdate(
      { email },
      {
        $set: {
          name: fullName,
          email,
          role: 'STUDENT',
          status: 'ACTIVE',
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const userId = userResult?._id || userResult?.value?._id;

    await studentsColl.findOneAndUpdate(
      { influenceXId: ixId },
      {
        $set: {
          userId,
          influenceXId: ixId,
          collegeStudentId: rollNo,
          fullName,
          collegeEmail: email,
          branch,
          year,
          section: i % 2 === 0 ? 'A' : 'B',
          status: 'APPROVED',
          cachedTotalCredits: 0,
          currentLevel: 'Explorer',
          joiningDate: now,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    studentsData.push({
      fullName,
      influenceXId: ixId,
      collegeStudentId: rollNo,
      collegeEmail: email,
      branch,
      year,
      hall,
    });
  }

  console.log(`✅ Verified and provisioned 50 sample student profiles in MongoDB.`);

  // Create Excel file
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InfluenceX Platform (NIAT Influencers Club)';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Participants_Roster', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = [
    { header: 'Name', key: 'fullName', width: 26 },
    { header: 'IXID', key: 'influenceXId', width: 16 },
    { header: 'College Roll No', key: 'collegeStudentId', width: 18 },
    { header: 'College Email', key: 'collegeEmail', width: 34 },
    { header: 'Branch', key: 'branch', width: 34 },
    { header: 'Year', key: 'year', width: 10 },
    { header: 'Hall / Venue', key: 'hall', width: 24 },
  ];

  worksheet.autoFilter = 'A1:G1';

  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4338CA' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  studentsData.forEach((student, index) => {
    const row = worksheet.addRow(student);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 2 || colNumber === 3 || colNumber === 6 ? 'center' : 'left',
      };
      if (index % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
    });
  });

  const rootFilePath = path.resolve('../sample_participants_50_students.xlsx');
  const clientPublicPath = path.resolve('../client/public/sample_participants_50_students.xlsx');

  await workbook.xlsx.writeFile(rootFilePath);
  console.log(`✅ Saved root Excel file: ${rootFilePath}`);

  if (!fs.existsSync(path.dirname(clientPublicPath))) {
    fs.mkdirSync(path.dirname(clientPublicPath), { recursive: true });
  }
  fs.copyFileSync(rootFilePath, clientPublicPath);
  console.log(`✅ Copied to client public assets: ${clientPublicPath}`);

  console.log('\n================================================================');
  console.log('   🎉 50 PARTICIPANTS EXCEL SPREADSHEET READY FOR UPLOAD!       ');
  console.log('================================================================\n');

  process.exit(0);
}

createSampleParticipants().catch((err) => {
  console.error('❌ Error generating sample Excel:', err);
  process.exit(1);
});
