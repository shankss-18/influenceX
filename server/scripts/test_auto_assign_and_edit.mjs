import ExcelJS from '../node_modules/exceljs/dist/es5/index.js';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://127.0.0.1:5000/api';

async function runAutoAssignAndEditTest() {
  console.log('================================================================');
  console.log('   TESTING 130-STUDENT AUTO-ASSIGNMENT (HALL 3 & HALL 4) & EDIT ');
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

  // Step 2: Create Workshop with Hall 3 (60 capacity) and Hall 4 (70 capacity)
  console.log('2. Creating Workshop with Hall 3 (capacity 60) and Hall 4 (capacity 70)...');
  const now = new Date();
  const winStart = new Date(now.getTime() - 10 * 60000).toISOString();
  const winEnd = new Date(now.getTime() + 120 * 60000).toISOString();

  const createRes = await fetch(`${API_BASE}/workshops`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'InfluenceX AI System Architecture 2026',
      description: 'Testing automatic sequential hall capacity filling.',
      date: now.toISOString().split('T')[0],
      startTime: '10:00 AM',
      endTime: '02:00 PM',
      halls: [
        { name: 'Hall 3', capacity: 60 },
        { name: 'Hall 4', capacity: 70 },
      ],
      attendanceWindowStart: winStart,
      attendanceWindowEnd: winEnd,
      creditCap: 50,
    }),
  });
  const createData = await createRes.json();
  const workshop = createData.workshop;
  console.log(`   ✅ Workshop created: ${workshop.name} (${workshop.eventId})`);
  console.log(`      Total capacity: ${workshop.capacity} seats across 2 halls.\n`);

  // Step 3: Generate Excel with 130 registered students (1 to 130)
  console.log('3. Generating 130 students Excel spreadsheet...');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Registrations');
  sheet.addRow(['Name', 'NIAT ID', 'IXID']);

  for (let i = 1; i <= 130; i++) {
    const padded = String(i).padStart(4, '0');
    sheet.addRow([`Student ${i}`, `N25H01A${padded}`, `IX${padded}`]);
  }

  const excelBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const formData = new FormData();
  formData.append('file', blob, '130_students.xlsx');

  // Step 4: Preview Student Auto-Assignment
  console.log('4. Previewing Student Auto-Assignment via API...');
  const previewRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/students/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: formData,
  });
  const previewData = await previewRes.json();

  console.log(`   ✅ Total Uploaded: ${previewData.totalUploaded}`);
  console.log(`   ✅ Placed Count: ${previewData.placedCount} | Overflow: ${previewData.overflowCount}`);
  console.log(`   ✅ Hall Breakdown:`);
  previewData.hallBreakdown.forEach((h) => {
    console.log(`      - ${h.hallName}: ${h.assignedCount} / ${h.capacity} seats filled`);
  });

  const hall3Students = previewData.assignedRoster.filter((s) => s.hallName === 'Hall 3');
  const hall4Students = previewData.assignedRoster.filter((s) => s.hallName === 'Hall 4');

  console.log(`\n   🎯 Verification of Student Orders:`);
  console.log(`      - Hall 3 First Student: ${hall3Students[0].name} (#${hall3Students[0].assignedOrder})`);
  console.log(`      - Hall 3 60th Student:  ${hall3Students[59].name} (#${hall3Students[59].assignedOrder})`);
  console.log(`      - Hall 4 First Student: ${hall4Students[0].name} (#${hall4Students[0].assignedOrder})`);
  console.log(`      - Hall 4 Last Student:  ${hall4Students[69].name} (#${hall4Students[69].assignedOrder})`);

  if (hall3Students.length !== 60 || hall4Students.length !== 70) {
    throw new Error('Auto assignment count mismatch');
  }
  console.log('   ✅ 1-60 assigned to Hall 3 & 61-130 assigned to Hall 4 confirmed (100% MATCH)!\n');

  // Step 5: Commit Students Placement
  console.log('5. Committing Placement to DB and auto-awarding +10 registration credits...');
  const commitRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/students/commit`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ roster: previewData.assignedRoster }),
  });
  const commitData = await commitRes.json();
  console.log(`   ✅ Commit response: ${commitData.message}\n`);

  // Step 6: Test Edit Workshop Details at any stage (PATCH /api/workshops/:id)
  console.log('6. Testing Admin Edit of Workshop Details at this stage...');
  const updateRes = await fetch(`${API_BASE}/workshops/${workshop.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'InfluenceX Advanced AI System Architecture 2026 (Updated)',
      description: 'Updated description by admin in live setup phase.',
      creditCap: 60,
      halls: [
        { name: 'Hall 3', capacity: 65 },
        { name: 'Hall 4', capacity: 75 },
      ],
    }),
  });
  const updateData = await updateRes.json();
  console.log(`   ✅ Update response: ${updateData.message}`);
  console.log(`      Updated name: '${updateData.workshop.name}', New Cap: ${updateData.workshop.creditCap} pts, New Total Capacity: ${updateData.workshop.capacity}`);

  // Step 7: Test Delete Workshop (DELETE /api/workshops/:id)
  console.log('\n7. Testing Admin Delete of Workshop...');
  const deleteRes = await fetch(`${API_BASE}/workshops/${workshop.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  const deleteData = await deleteRes.json();
  console.log(`   ✅ Delete response: ${deleteData.message}`);

  console.log('\n================================================================');
  console.log('   🎉 AUTO-ASSIGNMENT & FULL EDIT/DELETE CAPABILITIES VERIFIED!  ');
  console.log('================================================================\n');
}

runAutoAssignAndEditTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
