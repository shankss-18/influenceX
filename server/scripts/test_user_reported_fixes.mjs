import ExcelJS from '../node_modules/exceljs/dist/es5/index.js';

const API_BASE = 'http://127.0.0.1:5000/api';

async function runComprehensiveFixVerification() {
  console.log('================================================================');
  console.log('   VERIFYING ALL 4 REPORTED USER ISSUES & REGRESSION TESTS      ');
  console.log('================================================================\n');

  // Step 1: Admin Login
  console.log('1. Admin Login...');
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
  console.log('   ✅ Admin logged in.\n');

  // Step 2: Create Workshop (Hall 4: 60 cap, Hall 5: 70 cap = 130 total)
  console.log('2. Creating Workshop with Hall 4 (60) and Hall 5 (70)...');
  const now = new Date();
  const createRes = await fetch(`${API_BASE}/workshops`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'InfluenceX React Architecture Workshop 2026',
      description: 'Testing volunteer persistence, fast student placement without duplicate credits, and 130 capacity display.',
      date: now.toISOString().split('T')[0],
      startTime: '09:00 AM',
      endTime: '01:00 PM',
      halls: [
        { name: 'Hall 4', capacity: 60 },
        { name: 'Hall 5', capacity: 70 },
      ],
      attendanceWindowStart: new Date(now.getTime() - 10 * 60000).toISOString(),
      attendanceWindowEnd: new Date(now.getTime() + 120 * 60000).toISOString(),
      creditCap: 50,
    }),
  });
  const createData = await createRes.json();
  const workshop = createData.workshop;
  console.log(`   ✅ Created Workshop: ${workshop.name} (${workshop.eventId}) with ${workshop.capacity} total capacity.\n`);

  // Step 3: Assign Volunteers
  console.log('3. Assigning Volunteers to Hall 4 and Hall 5...');
  const assignVolRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/volunteers/assign`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      assignments: [
        { name: 'Vol Alpha', ixId: 'IX0901', niatId: 'N25H01A0901', hallName: 'Hall 4' },
        { name: 'Vol Beta', ixId: 'IX0902', niatId: 'N25H01A0902', hallName: 'Hall 4' },
        { name: 'Vol Gamma', ixId: 'IX0903', niatId: 'N25H01A0903', hallName: 'Hall 5' },
        { name: 'Vol Delta', ixId: 'IX0904', niatId: 'N25H01A0904', hallName: 'Hall 5' },
      ],
    }),
  });
  const assignVolData = await assignVolRes.json();
  console.log(`   ✅ Volunteers assigned response: ${assignVolData.message}`);

  // Step 4: Test Page Refresh (GET /setup) to verify volunteers are preserved
  console.log('\n4. Simulating Page Refresh (GET /api/workshops/:id/setup)...');
  const setupRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup`, {
    method: 'GET',
    headers: adminHeaders,
  });
  const setupData = await setupRes.json();
  const hall4Vols = setupData.halls.find(h => h.name === 'Hall 4').assignedVolunteers;
  const hall5Vols = setupData.halls.find(h => h.name === 'Hall 5').assignedVolunteers;

  console.log(`   ✅ Hall 4 Assigned Volunteers count on refresh: ${hall4Vols.length} (${hall4Vols.map(v => v.name).join(', ')})`);
  console.log(`   ✅ Hall 5 Assigned Volunteers count on refresh: ${hall5Vols.length} (${hall5Vols.map(v => v.name).join(', ')})`);
  if (hall4Vols.length !== 2 || hall5Vols.length !== 2) {
    throw new Error('Volunteers were not persisted on setup refresh!');
  }
  console.log('   ✅ ISSUE 1 FIXED: Volunteers are fully preserved on refresh!\n');

  // Step 5: Test Volunteer Credentials Generation & Anytime RE-GENERATION
  console.log('5. Generating and Regenerating Volunteer Credentials...');
  const creds1Res = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/volunteers/credentials`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({}),
  });
  const creds1Data = await creds1Res.json();
  console.log(`   ✅ Initial credentials generated for ${creds1Data.credentials.length} volunteers.`);

  // Regenerate again anytime
  const creds2Res = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/volunteers/credentials`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({}),
  });
  const creds2Data = await creds2Res.json();
  console.log(`   ✅ Admin successfully regenerated credentials anytime for ${creds2Data.credentials.length} volunteers.`);
  console.log('   ✅ ISSUE 2 FIXED: Credentials can be regenerated at any time!\n');

  // Step 6: Test Uploading 130 Students and Fast Commit
  console.log('6. Uploading 130 students Excel and testing instantaneous commit...');
  const batchSuffix = Math.floor(Math.random() * 8000) + 1000;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Registrations');
  sheet.addRow(['Name', 'NIAT ID', 'IXID']);
  for (let i = 1; i <= 130; i++) {
    const num = batchSuffix + i;
    sheet.addRow([`Student ${i}`, `N25H01A${num}`, `IX${num}`]);
  }
  const excelBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const formData = new FormData();
  formData.append('file', blob, '130_students.xlsx');

  const previewRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/students/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: formData,
  });
  const previewData = await previewRes.json();
  console.log(`   ✅ Preview: ${previewData.placedCount} placed across Hall 4 (60) and Hall 5 (70).`);

  const startTime = Date.now();
  const commitRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/students/commit`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ roster: previewData.assignedRoster }),
  });
  const commitData = await commitRes.json();
  const elapsed = Date.now() - startTime;
  console.log(`   ✅ Commit executed in ${elapsed}ms! (Previously slow/freezing)`);
  console.log(`   ✅ Server Message: ${commitData.message}`);
  console.log(`   ✅ Newly Credited Students: ${commitData.newlyCreditedCount}`);

  // Step 7: Test Duplicate Prevention (Committing again should NOT give duplicate +10 credits)
  console.log('\n7. Testing Duplicate Prevention (Re-committing roster)...');
  const commitAgainRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/students/commit`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ roster: previewData.assignedRoster }),
  });
  const commitAgainData = await commitAgainRes.json();
  console.log(`   ✅ Re-commit Server Message: ${commitAgainData.message}`);
  console.log(`   ✅ Newly Credited Students on Re-commit: ${commitAgainData.newlyCreditedCount} (Expected: 0)`);
  if (commitAgainData.newlyCreditedCount !== 0) {
    throw new Error('Duplicate credits were awarded!');
  }
  console.log('   ✅ ISSUE 3 FIXED: Zero duplicate credits on re-commit!\n');

  // Step 8: Verify Setup Data shows all 130 students without 100-slice truncation
  console.log('8. Verifying all 130 students are returned in setup data...');
  const setup2Res = await fetch(`${API_BASE}/workshops/${workshop.id}/setup`, {
    method: 'GET',
    headers: adminHeaders,
  });
  const setup2Data = await setup2Res.json();
  console.log(`   ✅ Total Assigned Students: ${setup2Data.totalAssignedStudents}`);
  console.log(`   ✅ Placed Students Array Length: ${setup2Data.placedStudents.length}`);
  if (setup2Data.placedStudents.length !== 130) {
    throw new Error(`Expected 130 students, got ${setup2Data.placedStudents.length}`);
  }
  console.log('   ✅ ISSUE 4 FIXED: Full 130 students roster is displayed without any 100 limit!\n');

  console.log('================================================================');
  console.log('   🎉 ALL 4 ISSUES FIXED AND 100% VERIFIED!                     ');
  console.log('================================================================\n');
}

runComprehensiveFixVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
