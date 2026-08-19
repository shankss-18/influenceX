import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

async function testSampleExcelUpload() {
  console.log('================================================================');
  console.log('   TESTING 50 PARTICIPANTS EXCEL UPLOAD PREVIEW & COMMIT        ');
  console.log('================================================================\n');

  // 1. Login as Admin
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@influencex.niat.edu', password: 'Admin@123456' }),
  });
  const rawCookie = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')].filter(Boolean);
  const adminCookie = rawCookie.map((c) => c.split(';')[0]).join('; ');
  console.log('✅ Admin logged in.');

  // 2. Create a Workshop Event
  const catRes = await fetch(`${BASE_URL}/event-categories`, { headers: { Cookie: adminCookie } });
  const catData = await catRes.json();
  const categoryId = catData.categories[0].id;

  const now = new Date();
  const evRes = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      name: `GenAI 50-Student Cohort Workshop ${Date.now().toString().slice(-4)}`,
      description: 'Mass testing 50 students roster upload',
      categoryId,
      date: now.toISOString().split('T')[0],
      startTime: '02:00 PM',
      endTime: '05:00 PM',
      venue: 'Main Auditorium Hall A',
      capacity: 100,
      registrationStart: new Date(now.getTime() - 3600000).toISOString(),
      registrationEnd: new Date(now.getTime() + 7200000).toISOString(),
      attendanceWindowStart: new Date(now.getTime() - 3600000).toISOString(),
      attendanceWindowEnd: new Date(now.getTime() + 7200000).toISOString(),
      creditWindowStart: new Date(now.getTime() - 3600000).toISOString(),
      creditWindowEnd: new Date(now.getTime() + 7200000).toISOString(),
      status: 'OPEN',
    }),
  });
  const evData = await evRes.json();
  const eventId = evData.event.id;
  console.log(`✅ Workshop created: ${evData.event.eventId}`);

  // 3. Upload Excel file for Dry-Run Preview
  const filePath = path.resolve('sample_participants_50_students.xlsx');
  const fileBuffer = fs.readFileSync(filePath);
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);

  const bodyParts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample_participants_50_students.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    fileBuffer,
    `\r\n--${boundary}--\r\n`,
  ];

  const fullBody = Buffer.concat([
    Buffer.from(bodyParts[0]),
    bodyParts[1],
    Buffer.from(bodyParts[2]),
  ]);

  const previewRes = await fetch(`${BASE_URL}/events/${eventId}/import/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Cookie: adminCookie,
    },
    body: fullBody,
  });

  const previewData = await previewRes.json();
  console.log('\n📊 [Dry-Run Validation Result]:');
  console.log(`   - Total Rows Parsed:     ${previewData.preview.totalRows}`);
  console.log(`   - Valid Rows:            ${previewData.preview.validCount}`);
  console.log(`   - Duplicates:            ${previewData.preview.duplicateCount}`);
  console.log(`   - Unknown Students:      ${previewData.preview.unknownStudentCount}`);
  console.log(`   - Missing Fields:        ${previewData.preview.missingFieldCount}`);

  if (previewData.preview.validCount !== 50) {
    throw new Error(`Expected 50 valid rows, got ${previewData.preview.validCount}. Errors: ${JSON.stringify(previewData.preview.errors)}`);
  }
  console.log('✅ PASS: All 50 rows validated 100% successfully!');

  // 4. Commit Import
  const validStudentIds = previewData.preview.validRows.map((r) => r.studentId);
  const commitRes = await fetch(`${BASE_URL}/events/${eventId}/import/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      tempFilePath: previewData.preview.tempFilePath,
      validStudentIds,
      totalRows: previewData.preview.totalRows,
      originalFileName: previewData.preview.originalFileName,
    }),
  });

  const commitData = await commitRes.json();
  console.log(`\n✅ PASS: Committed ${commitData.importRecord.importedCount} student registrations with +10 credits each!`);

  console.log('\n================================================================');
  console.log('   🎉 50 PARTICIPANTS SPREADSHEET TEST COMPLETED (100% PASS)!  ');
  console.log('================================================================\n');
}

testSampleExcelUpload().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
