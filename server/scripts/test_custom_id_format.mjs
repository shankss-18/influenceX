import ExcelJS from '../node_modules/exceljs/dist/es5/index.js';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://127.0.0.1:5000/api';

async function runFormatTest() {
  console.log('================================================================');
  console.log('   TESTING CUSTOM ID FORMATS: IX**** and N25HO1A**** / N25H01A****');
  console.log('================================================================\n');

  // Step 1: Admin Login
  console.log('1. Logging in as Administrator...');
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@influencex.niat.edu',
      password: 'Admin@123456',
    }),
  });
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.accessToken;
  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };
  console.log('   ✅ Admin successfully logged in.\n');

  // Step 2: Create Workshop
  console.log('2. Creating Workshop for Volunteer Upload Test...');
  const now = new Date();
  const winStart = new Date(now.getTime() - 10 * 60000).toISOString();
  const winEnd = new Date(now.getTime() + 120 * 60000).toISOString();

  const createWorkshopRes = await fetch(`${API_BASE}/workshops`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'InfluenceX AI Leadership Workshop',
      description: 'Workshop testing custom IX**** and N25HO1A**** formats.',
      date: now.toISOString().split('T')[0],
      startTime: '10:00 AM',
      endTime: '01:00 PM',
      halls: [
        { name: 'Auditorium Hall A', capacity: 30 },
        { name: 'Seminar Hall B', capacity: 20 },
      ],
      attendanceWindowStart: winStart,
      attendanceWindowEnd: winEnd,
      creditCap: 50,
    }),
  });
  const createWorkshopData = await createWorkshopRes.json();
  const workshop = createWorkshopData.workshop;
  console.log(`   ✅ Workshop created: ${workshop.name} (${workshop.eventId})\n`);

  // Step 3: Generate Excel matching the user's exact uploaded format
  console.log('3. Generating Volunteers Excel matching exact user screenshot formats (IX0451, N25H01A0451, etc.)...');
  const volWorkbook = new ExcelJS.Workbook();
  const volSheet = volWorkbook.addWorksheet('Volunteers');
  volSheet.addRow(['Name', 'IXID', 'NIAT ID', 'Workshop Name']);
  volSheet.addRow(['Ananya Rao', 'IX0451', 'N25H01A0451', 'InfluenceX AI Leadership Workshop']);
  volSheet.addRow(['Kabir Sinha', 'IX0972', 'N25H01A0972', 'InfluenceX AI Leadership Workshop']);
  volSheet.addRow(['Meera Iyer', 'IX0630', 'N25H01A0630', 'InfluenceX AI Leadership Workshop']);
  volSheet.addRow(['Rohan Das', 'IX0118', 'N25H01A0118', 'InfluenceX AI Leadership Workshop']);
  volSheet.addRow(['Sanya Kapoor', 'IX0784', 'N25H01A0784', 'InfluenceX AI Leadership Workshop']);
  volSheet.addRow(['Vikram Nair', 'IX0299', 'N25H01A0299', 'InfluenceX AI Leadership Workshop']);
  volSheet.addRow(['Ishita Verma', 'IX0857', 'N25HO1A0857', 'InfluenceX AI Leadership Workshop']);

  const volBuffer = await volWorkbook.xlsx.writeBuffer();
  const volBlob = new Blob([volBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const volFormData = new FormData();
  volFormData.append('file', volBlob, 'volunteers_test.xlsx');

  // Step 4: Preview Upload
  console.log('4. Previewing volunteer upload against API...');
  const volPreviewRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/volunteers/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: volFormData,
  });
  const volPreviewData = await volPreviewRes.json();
  console.log(`   ✅ Result: Total Rows: ${volPreviewData.totalRows} | Valid: ${volPreviewData.validCount} | Issues: ${volPreviewData.issueCount}`);

  volPreviewData.volunteers.forEach((v) => {
    console.log(`      - Row #${v.rowNumber}: ${v.name} | IXID: ${v.ixId} | NIAT ID: ${v.niatId} -> ${v.isValid ? '✅ VALID' : `❌ ISSUE: ${v.issue}`}`);
  });

  if (volPreviewData.validCount === 7 && volPreviewData.issueCount === 0) {
    console.log('\n================================================================');
    console.log('   🎉 SUCCESS: ALL 7 ROWS WITH IX**** AND N25HO1A**** PASSED!   ');
    console.log('================================================================\n');
  } else {
    throw new Error('Some rows failed validation');
  }
}

runFormatTest().catch((err) => {
  console.error('Format test failed:', err);
  process.exit(1);
});
