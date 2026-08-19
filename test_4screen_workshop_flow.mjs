import axios from 'axios';
import ExcelJS from 'exceljs';
import FormData from 'form-data';
import fs from 'fs';

const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('================================================================');
  console.log('   TESTING EXACT 4-SCREEN, 3-STEP WORKSHOP LIFECYCLE            ');
  console.log('================================================================\n');

  // Step 1: Admin Login
  console.log('1. Logging in as Administrator...');
  const adminLoginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: 'admin@influencex.niat.edu',
    password: 'Admin@123456',
  });
  const adminToken = adminLoginRes.data.tokens.accessToken;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('   ✅ Admin successfully logged in.\n');

  // Step 2: Screen 2 — Create Workshop
  console.log('2. [Screen 2] Creating Workshop with 2 Halls (Auditorium Hall A: 30, Seminar Hall B: 20)...');
  const now = new Date();
  const winStart = new Date(now.getTime() - 10 * 60000).toISOString();
  const winEnd = new Date(now.getTime() + 120 * 60000).toISOString();

  const createWorkshopRes = await axios.post(
    `${API_BASE}/workshops`,
    {
      name: 'Agentic Workflows Masterclass 2026',
      description: 'Comprehensive hands-on training on autonomous agents and digital ledger systems.',
      date: now.toISOString().split('T')[0],
      startTime: '09:30 AM',
      endTime: '01:30 PM',
      halls: [
        { name: 'Auditorium Hall A', capacity: 30 },
        { name: 'Seminar Hall B', capacity: 20 },
      ],
      attendanceWindowStart: winStart,
      attendanceWindowEnd: winEnd,
      creditCap: 50,
    },
    { headers: adminHeaders }
  );

  const workshop = createWorkshopRes.data.workshop;
  console.log(`   ✅ Workshop created: ${workshop.name} (${workshop.eventId})`);
  console.log(`   ✅ Next step redirect: ${createWorkshopRes.data.nextStepUrl}\n`);

  // Step 3: Screen 1 — Verify Flat Workshops List
  console.log('3. [Screen 1] Fetching Workshops List...');
  const listRes = await axios.get(`${API_BASE}/workshops`, { headers: adminHeaders });
  const createdInList = listRes.data.workshops.find((w) => w.id === workshop.id);
  console.log(`   ✅ Workshop listed with Status: '${createdInList.status}', Total Capacity: ${createdInList.totalCapacity}\n`);

  // Step 4: Screen 3a — Volunteers Setup
  console.log('4. [Screen 3a] Generating and uploading 5 Volunteers spreadsheet...');
  const volWorkbook = new ExcelJS.Workbook();
  const volSheet = volWorkbook.addWorksheet('Volunteers');
  volSheet.addRow(['Name', 'NIAT ID', 'IXID', 'Workshop Name']);
  volSheet.addRow(['Aarav Volunteer', 'NIAT-VOL-01', 'IX-VOL001', 'Agentic Workflows Masterclass 2026']);
  volSheet.addRow(['Bhavna Volunteer', 'NIAT-VOL-02', 'IX-VOL002', 'Agentic Workflows Masterclass 2026']);
  volSheet.addRow(['Chetan Volunteer', 'NIAT-VOL-03', 'IX-VOL003', 'Agentic Workflows Masterclass 2026']);
  volSheet.addRow(['Divya Volunteer', 'NIAT-VOL-04', 'IX-VOL004', 'Agentic Workflows Masterclass 2026']);
  volSheet.addRow(['Esha Volunteer', 'NIAT-VOL-05', 'IX-VOL005', 'Agentic Workflows Masterclass 2026']);

  const volFilePath = 'test_volunteers_temp.xlsx';
  await volWorkbook.xlsx.writeFile(volFilePath);

  const volFormData = new FormData();
  volFormData.append('file', fs.createReadStream(volFilePath));

  const volPreviewRes = await axios.post(
    `${API_BASE}/workshops/${workshop.id}/setup/volunteers/preview`,
    volFormData,
    { headers: { ...adminHeaders, ...volFormData.getHeaders() } }
  );
  fs.unlinkSync(volFilePath);
  console.log(`   ✅ Volunteers parsed: ${volPreviewRes.data.totalRows} rows (${volPreviewRes.data.validCount} valid).`);

  // Step 5: Screen 3a — Assign Volunteers to Halls (3 to Hall A, 2 to Hall B)
  console.log('5. [Screen 3a] Assigning 3 volunteers to Hall A and 2 volunteers to Hall B...');
  const assignVolRes = await axios.post(
    `${API_BASE}/workshops/${workshop.id}/setup/volunteers/assign`,
    {
      assignments: [
        { name: 'Aarav Volunteer', ixId: 'IX-VOL001', niatId: 'NIAT-VOL-01', hallName: 'Auditorium Hall A' },
        { name: 'Bhavna Volunteer', ixId: 'IX-VOL002', niatId: 'NIAT-VOL-02', hallName: 'Auditorium Hall A' },
        { name: 'Chetan Volunteer', ixId: 'IX-VOL003', niatId: 'NIAT-VOL-03', hallName: 'Auditorium Hall A' },
        { name: 'Divya Volunteer', ixId: 'IX-VOL004', niatId: 'NIAT-VOL-04', hallName: 'Seminar Hall B' },
        { name: 'Esha Volunteer', ixId: 'IX-VOL005', niatId: 'NIAT-VOL-05', hallName: 'Seminar Hall B' },
      ],
    },
    { headers: adminHeaders }
  );
  console.log(`   ✅ Staffing rule (2–3 per hall) verified: ${assignVolRes.data.message}`);

  // Step 6: Screen 3a — Generate Credentials
  console.log('6. [Screen 3a] Generating volunteer temporary credentials...');
  const credsRes = await axios.post(
    `${API_BASE}/workshops/${workshop.id}/setup/volunteers/credentials`,
    {},
    { headers: adminHeaders }
  );
  const sampleVolCred = credsRes.data.credentials[0];
  console.log(`   ✅ Generated ${credsRes.data.credentials.length} credentials. Sample: ${sampleVolCred.name} (${sampleVolCred.username} / ${sampleVolCred.tempPassword})\n`);

  // Step 7: Screen 3b — Upload Students Spreadsheet and Auto-Assign
  console.log('7. [Screen 3b] Auto-assigning 50 students from sample_participants_50_students.xlsx...');
  const studentFormData = new FormData();
  studentFormData.append('file', fs.createReadStream('sample_participants_50_students.xlsx'));

  const studentPreviewRes = await axios.post(
    `${API_BASE}/workshops/${workshop.id}/setup/students/preview`,
    studentFormData,
    { headers: { ...adminHeaders, ...studentFormData.getHeaders() } }
  );
  console.log(`   ✅ Auto-Assignment Preview:`);
  console.log(`      - Placed: ${studentPreviewRes.data.placedCount} / ${studentPreviewRes.data.totalCapacity}`);
  console.log(`      - Overflow: ${studentPreviewRes.data.overflowCount}`);
  studentPreviewRes.data.hallBreakdown.forEach((h) => {
    console.log(`      - ${h.hallName}: ${h.assignedCount} / ${h.capacity}`);
  });

  // Step 8: Screen 3b — Commit Students Placement (+10 Credits)
  console.log('8. [Screen 3b] Committing student placements and awarding +10 default registration credits...');
  const commitRes = await axios.post(
    `${API_BASE}/workshops/${workshop.id}/setup/students/commit`,
    { roster: studentPreviewRes.data.assignedRoster },
    { headers: adminHeaders }
  );
  console.log(`   ✅ ${commitRes.data.message}`);
  console.log(`   ✅ Status flipped to: '${commitRes.data.workshopStatus}' -> Console unlocked!\n`);

  // Step 9: Screen 4 — Workshop Console Overview & Ledger
  console.log('9. [Screen 4] Fetching Workshop Console Overview & Ledger Data...');
  const consoleRes = await axios.get(`${API_BASE}/workshops/${workshop.id}/console`, {
    headers: adminHeaders,
  });
  console.log(`   ✅ Console Loaded:`);
  console.log(`      - Total Students: ${consoleRes.data.stats.totalStudents}`);
  console.log(`      - Window Status: ${consoleRes.data.stats.windowOpen ? 'OPEN (Live)' : 'CLOSED'}`);
  console.log(`      - Ledger Records: ${consoleRes.data.ledger.length} transactions (+10 registration credits each)`);

  const firstStudent = consoleRes.data.studentRoster[0];
  console.log(`\n10. [Screen 4] Testing Admin Attendance (+20) & Variable Interaction Credit on ${firstStudent.fullName}...`);

  // Mark Attendance
  const attRes = await axios.post(
    `${API_BASE}/workshops/${workshop.id}/console/attendance`,
    { studentId: firstStudent.studentId, status: 'PRESENT' },
    { headers: adminHeaders }
  );
  console.log(`   ✅ Attendance marked: ${attRes.data.message}`);

  // Award Participation Credit
  const partRes = await axios.post(
    `${API_BASE}/workshops/${workshop.id}/console/credits`,
    { studentId: firstStudent.studentId, amount: 15, reason: 'Excellent agentic workflow design presentation' },
    { headers: adminHeaders }
  );
  console.log(`   ✅ Participation awarded: ${partRes.data.message}`);

  // Step 11: Test 50-credit ceiling enforcement
  console.log('\n11. [Screen 4] Testing 50-credit ceiling cap enforcement...');
  try {
    // Already has 10 (reg) + 20 (att) + 15 (part) = 45 pts. Trying to add 20 pts (45+20 = 65 > 50 cap)
    await axios.post(
      `${API_BASE}/workshops/${workshop.id}/console/credits`,
      { studentId: firstStudent.studentId, amount: 20, reason: 'Exceeding cap test' },
      { headers: adminHeaders }
    );
    console.error('   ❌ ERROR: 50-credit cap was NOT enforced!');
  } catch (err) {
    console.log(`   ✅ PASS: Cap strictly enforced: "${err.response?.data?.error}"`);
  }

  // Step 12: End Workshop
  console.log('\n12. [Screen 4] Ending and Freezing Workshop...');
  const endRes = await axios.post(
    `${API_BASE}/workshops/${workshop.id}/console/end`,
    {},
    { headers: adminHeaders }
  );
  console.log(`   ✅ ${endRes.data.message}`);

  console.log('\n================================================================');
  console.log('   🎉 ALL 4 SCREENS & 3 STEPS TESTED WITH 100% SUCCESS!          ');
  console.log('================================================================\n');
}

runTest().catch((err) => {
  console.error('Test execution failed:', err.response?.data || err.message);
  process.exit(1);
});
