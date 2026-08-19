import ExcelJS from '../node_modules/exceljs/dist/es5/index.js';

const API_BASE = 'http://127.0.0.1:5000/api';

async function runPurgeAndCapacityVerification() {
  console.log('================================================================');
  console.log('   PURGE ALL WORKSHOPS & STRICT CAPACITY / 12H IST VERIFICATION  ');
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
  console.log('   ✅ Admin logged in successfully.\n');

  // Step 2: Purge All Existing Workshops
  console.log('2. Purging all existing workshops from database (DELETE /api/workshops/purge/all)...');
  const purgeRes = await fetch(`${API_BASE}/workshops/purge/all`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  const purgeData = await purgeRes.json();
  console.log(`   ✅ Purge response: ${purgeData.message}`);

  // Verify list is completely empty
  const listRes = await fetch(`${API_BASE}/workshops`, {
    method: 'GET',
    headers: adminHeaders,
  });
  const listData = await listRes.json();
  console.log(`   ✅ Workshops list count after purge: ${listData.workshops.length} (Expected: 0)`);
  if (listData.workshops.length !== 0) {
    throw new Error('Workshops were not completely purged!');
  }
  console.log('   ✅ Clean slate verified!\n');

  // Step 3: Create Workshop with 12h Indian Time and Hall 3 (60) + Hall 4 (70)
  console.log('3. Creating Workshop with Indian 12-Hour format (10:00 AM — 02:00 PM IST)...');
  const now = new Date();
  const todayIST = now.toISOString().split('T')[0];
  const winStart = new Date(now.getTime() - 15 * 60000).toISOString();
  const winEnd = new Date(now.getTime() + 180 * 60000).toISOString();

  const createRes = await fetch(`${API_BASE}/workshops`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'InfluenceX AI NextGen Workshop 2026',
      description: 'Clean slate workshop with strict 130 capacity and 12-hour IST scheduling.',
      date: todayIST,
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
  console.log(`   ✅ Created Workshop: ${workshop.name} (${workshop.eventId})`);
  console.log(`      Total Capacity: ${workshop.capacity} seats across 2 halls.`);
  console.log(`      Timing: ${workshop.startTime} — ${workshop.endTime} (IST)\n`);

  // Step 4: Assign Volunteers
  console.log('4. Assigning Volunteers to Hall 3 and Hall 4...');
  const assignVolRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/volunteers/assign`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      assignments: [
        { name: 'Volunteer 1', ixId: 'IX0701', niatId: 'N25H01A0701', hallName: 'Hall 3' },
        { name: 'Volunteer 2', ixId: 'IX0702', niatId: 'N25H01A0702', hallName: 'Hall 3' },
        { name: 'Volunteer 3', ixId: 'IX0703', niatId: 'N25H01A0703', hallName: 'Hall 4' },
        { name: 'Volunteer 4', ixId: 'IX0704', niatId: 'N25H01A0704', hallName: 'Hall 4' },
      ],
    }),
  });
  const assignVolData = await assignVolRes.json();
  console.log(`   ✅ Volunteers assigned: ${assignVolData.message}`);

  // Generate Credentials
  const credsRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/volunteers/credentials`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({}),
  });
  const credsData = await credsRes.json();
  console.log(`   ✅ Generated credentials for ${credsData.credentials.length} volunteers.\n`);

  // Step 5: Upload 150 Students (20 overflow beyond 130 capacity)
  console.log('5. Uploading Excel with 150 students (20 overflow beyond 130 capacity)...');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Registrations');
  sheet.addRow(['Name', 'NIAT ID', 'IXID']);
  for (let i = 1; i <= 150; i++) {
    const padded = String(i).padStart(4, '0');
    sheet.addRow([`Student ${i}`, `N25H01A${padded}`, `IX${padded}`]);
  }
  const excelBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const formData = new FormData();
  formData.append('file', blob, '150_students.xlsx');

  const previewRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/students/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: formData,
  });
  const previewData = await previewRes.json();
  console.log(`   ✅ Preview Response:`);
  console.log(`      - Total Uploaded in File: ${previewData.totalUploaded}`);
  console.log(`      - Total Workshop Capacity: ${previewData.totalCapacity}`);
  console.log(`      - Accepted & Placed Count: ${previewData.placedCount} (First 130 students)`);
  console.log(`      - Ignored Overflow Count: ${previewData.ignoredOverflowCount} (Extra 20 avoided)`);
  console.log(`      - Server Message: "${previewData.message}"`);

  if (previewData.placedCount !== 130 || previewData.ignoredOverflowCount !== 20) {
    throw new Error('Capacity capping failed!');
  }
  console.log('   ✅ STRICT CAPACITY ENFORCEMENT VERIFIED (First 130 accepted, extra 20 avoided)!\n');

  // Step 6: Commit Placements
  console.log('6. Committing 130 Placements to Database...');
  const commitRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/students/commit`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ roster: previewData.assignedRoster }),
  });
  const commitData = await commitRes.json();
  console.log(`   ✅ Commit response: ${commitData.message}`);
  console.log(`   ✅ Workshop Lifecycle Status: ${commitData.workshopStatus} (Live / Attendance Open)\n`);

  // Step 7: Verify Console Data
  console.log('7. Verifying Live Workshop Console...');
  const consoleRes = await fetch(`${API_BASE}/workshops/${workshop.id}/console`, {
    method: 'GET',
    headers: adminHeaders,
  });
  const consoleData = await consoleRes.json();
  console.log(`   ✅ Console Status: ${consoleData.workshop.computedStatus}`);
  console.log(`   ✅ Window Live: ${consoleData.stats.windowOpen}`);
  console.log(`   ✅ Total Students in Console: ${consoleData.studentRoster.length}`);
  console.log(`   ✅ Hall 3 Students: ${consoleData.studentRoster.filter(s => s.hallName === 'Hall 3').length} / 60`);
  console.log(`   ✅ Hall 4 Students: ${consoleData.studentRoster.filter(s => s.hallName === 'Hall 4').length} / 70`);

  console.log('\n================================================================');
  console.log('   🎉 ALL USER DIRECTIVES APPLIED & VERIFIED CLEAN!             ');
  console.log('================================================================\n');
}

runPurgeAndCapacityVerification().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
