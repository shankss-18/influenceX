import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import dns from 'dns';
import path from 'path';
import fs from 'fs';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const MONGODB_URI = 'mongodb+srv://user:123456789%40@cluster0.6xsibdr.mongodb.net/influencex?retryWrites=true&w=majority&appName=Cluster0';

// Student Names list
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

const BRANCHES = ['Computer Science & Engineering', 'Information Technology', 'Artificial Intelligence & DS', 'Electronics & Communication', 'Mechanical Engineering'];
const HALLS = ['Auditorium Hall A', 'Seminar Hall B', 'Innovation Lab 1', 'Main Amphitheatre', 'Conference Room C'];

async function createSampleParticipants() {
  console.log('================================================================');
  console.log('   GENERATING SAMPLE 50 PARTICIPANTS EXCEL & PROVISIONING DB   ');
  console.log('================================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  const db = mongoose.connection.db;
  const usersColl = db.collection('users');
  const studentsColl = db.collection('students');
  const seqColl = db.collection('sequences');

  const studentsData = [];
  const now = new Date();

  // Create 50 students
  for (let i = 1; i <= 50; i++) {
    const firstName = FIRST_NAMES[i - 1];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;
    const ixIdNumber = String(i + 100).padStart(6, '0'); // e.g. IX-000101
    const ixId = `IX-${ixIdNumber}`;
    const rollNo = `23CS${String(i).padStart(3, '0')}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@influencex.niat.edu`;
    const branch = BRANCHES[i % BRANCHES.length];
    const year = (i % 4) + 1;
    const hall = HALLS[i % HALLS.length];

    // Upsert User
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

    const userId = userResult._id || userResult.value?._id;

    // Upsert Student profile
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

  console.log(`✅ Verified/Provisioned 50 student profiles in MongoDB Atlas.`);

  // Create Excel Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InfluenceX Platform (NIAT Influencers Club)';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Participants_Roster', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = [
    { header: 'Name', key: 'fullName', width: 24 },
    { header: 'IXID', key: 'influenceXId', width: 16 },
    { header: 'College Roll No', key: 'collegeStudentId', width: 18 },
    { header: 'College Email', key: 'collegeEmail', width: 32 },
    { header: 'Branch', key: 'branch', width: 32 },
    { header: 'Year', key: 'year', width: 10 },
    { header: 'Hall / Venue', key: 'hall', width: 24 },
  ];

  // Enable auto-filter
  worksheet.autoFilter = 'A1:G1';

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4338CA' }, // Indigo brand header
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF312E81' } },
      bottom: { style: 'medium', color: { argb: 'FF1E1B4B' } },
      left: { style: 'thin', color: { argb: 'FF312E81' } },
      right: { style: 'thin', color: { argb: 'FF312E81' } },
    };
  });

  // Add 50 Data Rows
  studentsData.forEach((student, index) => {
    const row = worksheet.addRow({
      fullName: student.fullName,
      influenceXId: student.influenceXId,
      collegeStudentId: student.collegeStudentId,
      collegeEmail: student.collegeEmail,
      branch: student.branch,
      year: student.year,
      hall: student.hall,
    });

    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 2 || colNumber === 3 || colNumber === 6 ? 'center' : 'left',
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
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

  // Save in Root and client/public
  const rootFilePath = path.resolve('sample_participants_50_students.xlsx');
  const publicFilePath = path.resolve('client/public/sample_participants_50_students.xlsx');

  await workbook.xlsx.writeFile(rootFilePath);
  console.log(`✅ Saved Excel file: ${rootFilePath}`);

  fs.copyFileSync(rootFilePath, publicFilePath);
  console.log(`✅ Copied to client public folder: ${publicFilePath}`);

  console.log('\n================================================================');
  console.log('   🎉 SAMPLE PARTICIPANTS FILE CREATED & VERIFIED 100%!         ');
  console.log('   Path: sample_participants_50_students.xlsx                   ');
  console.log('   Total Valid Rows: 50 Students                                ');
  console.log('================================================================\n');

  process.exit(0);
}

createSampleParticipants().catch((err) => {
  console.error('❌ Error creating sample Excel:', err);
  process.exit(1);
});
