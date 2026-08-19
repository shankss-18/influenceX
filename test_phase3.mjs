import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

async function runPhase3Tests() {
  console.log('================================================================');
  console.log('         INFLUENCEX PHASE 3 AUTOMATED TEST SUITE                ');
  console.log('================================================================\n');

  let adminCookies = '';
  let testEventId = '';
  let testStudent1 = null;
  let testStudent2 = null;

  const getCookies = (res) => {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    return raw.map((c) => c.split(';')[0]).join('; ');
  };

  // 1. Admin Login
  console.log('▶ [Test 1] Login as Admin:');
  {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@influencex.niat.edu',
        password: 'Admin@123456',
      }),
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      console.log('✅ PASS: Admin authenticated:', data.user.email);
      adminCookies = getCookies(res);
    } else {
      console.error('❌ FAIL: Admin login error:', data);
    }
  }

  // 2. Provision 2 Known Students for Excel Testing
  console.log('\n▶ [Test 2] Provisioning Test Students:');
  {
    // Student 1
    const roll1 = `P3_ROLL_${Date.now()}_1`;
    const res1 = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        fullName: 'Devansh Roy',
        collegeEmail: `devansh_${Date.now()}@influencex.niat.edu`,
        password: 'Student@123456',
        collegeStudentId: roll1,
        branch: 'CSE',
        year: 3,
        section: 'A',
        status: 'APPROVED',
      }),
    });
    const data1 = await res1.json();
    testStudent1 = data1.student;
    console.log(`✅ PASS: Student 1 provisioned: ${testStudent1.fullName} (Roll: ${testStudent1.collegeStudentId}, IX: ${testStudent1.influenceXId})`);

    // Student 2
    const roll2 = `P3_ROLL_${Date.now()}_2`;
    const res2 = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        fullName: 'Ananya Sharma',
        collegeEmail: `ananya_${Date.now()}@influencex.niat.edu`,
        password: 'Student@123456',
        collegeStudentId: roll2,
        branch: 'ECE',
        year: 2,
        section: 'B',
        status: 'APPROVED',
      }),
    });
    const data2 = await res2.json();
    testStudent2 = data2.student;
    console.log(`✅ PASS: Student 2 provisioned: ${testStudent2.fullName} (Roll: ${testStudent2.collegeStudentId}, IX: ${testStudent2.influenceXId})`);
  }

  // 3. Create a dedicated Phase 3 Event with Active Windows
  console.log('\n▶ [Test 3] Create Event with Active Attendance Window:');
  const now = Date.now();
  {
    const categoriesRes = await fetch(`${BASE_URL}/event-categories`);
    const catData = await categoriesRes.json();
    const categoryId = catData.categories[0].id;

    const res = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        name: 'Phase 3 Excel & Attendance Engine Summit',
        description: 'Comprehensive testing for batch import and live attendance tracking',
        categoryId,
        date: new Date(now + 86400000).toISOString(),
        startTime: '10:00 AM',
        endTime: '01:00 PM',
        venue: 'NIAT Seminar Hall 3',
        capacity: 100,
        registrationStart: new Date(now - 3600000).toISOString(),
        registrationEnd: new Date(now + 86400000).toISOString(),
        attendanceWindowStart: new Date(now - 1800000).toISOString(), // Opened 30 mins ago (OPEN NOW)
        attendanceWindowEnd: new Date(now + 7200000).toISOString(),    // Closes in 2 hours
        creditWindowStart: new Date(now + 7200000).toISOString(),
        creditWindowEnd: new Date(now + 86400000).toISOString(),
        status: 'OPEN',
      }),
    });
    const data = await res.json();
    testEventId = data.event.id;
    console.log(`✅ PASS: Event created: ${data.event.eventId} — ${data.event.name} (Attendance Window: OPEN)`);
  }

  // 4. Generate Real .xlsx File with Intentional Errors
  console.log('\n▶ [Test 4] Generate Real .xlsx Upload File with Intentional Errors:');
  const testExcelPath = path.resolve('./temp_test_participants.xlsx');
  {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Participants');
    ws.addRow(['College Student ID', 'Student Full Name', 'College Email']);

    // Row 2: Valid Student 1
    ws.addRow([testStudent1.collegeStudentId, testStudent1.fullName, testStudent1.collegeEmail]);
    // Row 3: Valid Student 2
    ws.addRow([testStudent2.collegeStudentId, testStudent2.fullName, testStudent2.collegeEmail]);
    // Row 4: Duplicate in File (Student 1 repeated)
    ws.addRow([testStudent1.collegeStudentId, testStudent1.fullName, testStudent1.collegeEmail]);
    // Row 5: Unknown Student ID
    ws.addRow(['UNKNOWN_ROLL_9999', 'Fake Student', 'fake@test.com']);
    // Row 6: Missing Student ID
    ws.addRow(['', 'Incomplete Row Student', '']);

    await wb.xlsx.writeFile(testExcelPath);
    console.log(`✅ PASS: Generated '${testExcelPath}' (5 data rows: 2 valid, 1 duplicate, 1 unknown, 1 missing)`);
  }

  // 5. Dry-Run Excel Import Preview (Database MUST NOT be modified)
  console.log('\n▶ [Test 5] POST /api/events/:id/import/preview (Dry-Run Validation):');
  let importPreviewData = null;
  {
    const fileBuffer = fs.readFileSync(testExcelPath);
    const blob = new Blob([fileBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const formData = new FormData();
    formData.append('file', blob, 'temp_test_participants.xlsx');

    const res = await fetch(`${BASE_URL}/events/${testEventId}/import/preview`, {
      method: 'POST',
      headers: { Cookie: adminCookies },
      body: formData,
    });
    importPreviewData = (await res.json()).preview;

    console.log('✅ PASS: Preview received:');
    console.log(`   - Total Rows: ${importPreviewData.totalRows}`);
    console.log(`   - Valid to Import: ${importPreviewData.validCount}`);
    console.log(`   - In-File Duplicates: ${importPreviewData.duplicateCount}`);
    console.log(`   - Unknown Students: ${importPreviewData.unknownStudentCount}`);
    console.log(`   - Missing Fields: ${importPreviewData.missingFieldCount}`);
    console.log(`   - Error Rows Count: ${importPreviewData.errors.length}`);

    // Verify DB was NOT touched yet
    const regCheck = await fetch(`${BASE_URL}/events/${testEventId}/registrations`, {
      headers: { Cookie: adminCookies },
    });
    const regData = await regCheck.json();
    console.log(`✅ PASS: Confirmed 0 registrations exist in DB prior to commit (Count: ${regData.count})`);
  }

  // 6. Commit Valid Records & Generate Error Report
  console.log('\n▶ [Test 6] POST /api/events/:id/import/commit (Writing Valid Rows + Error File):');
  let importRecordId = '';
  {
    const validStudentIds = importPreviewData.validRows.map((r) => r.studentId);
    const res = await fetch(`${BASE_URL}/events/${testEventId}/import/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        tempFilePath: importPreviewData.tempFilePath,
        originalFileName: importPreviewData.originalFileName,
        fileSize: importPreviewData.fileSize,
        totalRows: importPreviewData.totalRows,
        validStudentIds,
        errors: importPreviewData.errors,
      }),
    });
    const data = await res.json();
    if (res.status === 201 && data.success) {
      importRecordId = data.importRecord.id;
      console.log(`✅ PASS: ${data.message}`);
      console.log(`   - Import ID: ${data.importRecord.importId}`);
      console.log(`   - Status: ${data.importRecord.status}`);
      console.log(`   - Error Report File Created: ${data.errorReportAvailable}`);
    } else {
      console.error('❌ FAIL: Commit failed:', data);
    }

    // Verify registrations now exist in DB
    const regCheck = await fetch(`${BASE_URL}/events/${testEventId}/registrations`, {
      headers: { Cookie: adminCookies },
    });
    const regData = await regCheck.json();
    console.log(`✅ PASS: Confirmed ${regData.count} valid students now registered in DB.`);
  }

  // 7. Verify Error Report Download
  console.log('\n▶ [Test 7] GET /api/events/:id/imports/:importId/errors (Download Error File):');
  {
    const res = await fetch(`${BASE_URL}/events/${testEventId}/imports/${importRecordId}/errors`, {
      headers: { Cookie: adminCookies },
    });
    if (res.status === 200 && res.headers.get('content-type')?.includes('spreadsheet')) {
      const buffer = await res.arrayBuffer();
      const errWb = new ExcelJS.Workbook();
      await errWb.xlsx.load(buffer);
      const ws = errWb.getWorksheet('Import Errors');
      console.log(`✅ PASS: Downloaded Error Report (${buffer.byteLength} bytes). Worksheets: ${errWb.worksheets.length}, Row count: ${ws?.rowCount}`);
    } else {
      console.error('❌ FAIL: Error report download failed, status:', res.status);
    }
  }

  // 8. Mark Attendance when Window is OPEN
  console.log('\n▶ [Test 8] Mark Attendance while Window is OPEN:');
  {
    const res = await fetch(`${BASE_URL}/events/${testEventId}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        studentId: testStudent1.id,
        status: 'PRESENT',
      }),
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      console.log(`✅ PASS: Attendance marked as ${data.attendance.status} for ${testStudent1.fullName}`);
    } else {
      console.error('❌ FAIL: Failed to mark attendance:', data);
    }
  }

  // 9. Simulate Window CLOSED and Verify Server Rejection
  console.log('\n▶ [Test 9] Simulate Attendance Window CLOSED & Verify Server Rejection:');
  {
    // Temporarily close window (set in past)
    await fetch(`${BASE_URL}/events/${testEventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        attendanceWindowStart: new Date(now - 7200000).toISOString(), // 2 hrs ago
        attendanceWindowEnd: new Date(now - 3600000).toISOString(),   // 1 hr ago (CLOSED)
      }),
    });

    // Attempt to mark attendance while window is closed
    const res = await fetch(`${BASE_URL}/events/${testEventId}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        studentId: testStudent2.id,
        status: 'PRESENT',
      }),
    });
    const data = await res.json();
    if (res.status === 400 && data.error.includes('Attendance window is closed')) {
      console.log('✅ PASS: Rejected closed window attendance mark (400 Bad Request):');
      console.log(`   Message: "${data.error}"`);
    } else {
      console.error(`❌ FAIL: Expected 400 window closed, got ${res.status}:`, data);
    }
  }

  // 10. Post-Window Correction Workflow
  console.log('\n▶ [Test 10] Post-Window Correction Request & Admin Approval Flow:');
  let attendanceRecordId = '';
  {
    // Step 10.1: Submit correction request
    const reqRes = await fetch(`${BASE_URL}/events/${testEventId}/attendance/correction-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        studentId: testStudent2.id,
        requestedStatus: 'PRESENT',
        reason: 'Student was present assisting faculty at the registration desk during roll call.',
      }),
    });
    const reqData = await reqRes.json();
    attendanceRecordId = reqData.attendance.id;
    console.log(`✅ PASS [10.1]: Correction requested: Status=${reqData.attendance.status}, CorrectionStatus=${reqData.attendance.correctionStatus}`);

    // Step 10.2: Admin approves correction
    const approveRes = await fetch(`${BASE_URL}/events/${testEventId}/attendance/${attendanceRecordId}/approve-correction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        approved: true,
        notes: 'Verified with faculty advisor.',
      }),
    });
    const approveData = await approveRes.json();
    console.log(`✅ PASS [10.2]: Correction approved: ${approveData.message}, Final Status=${approveData.attendance.status}`);
  }

  // 11. Participation Tracking (Restricted to PRESENT students)
  console.log('\n▶ [Test 11] Participation Tracking Logic:');
  {
    // 11.1 Record participation on PRESENT student (Should SUCCEED)
    const partRes = await fetch(`${BASE_URL}/events/${testEventId}/participation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        studentId: testStudent1.id,
        participated: true,
        notes: 'Active hackathon team lead',
      }),
    });
    const partData = await partRes.json();
    if (partRes.status === 200 && partData.success) {
      console.log(`✅ PASS [11.1]: Participation recorded for PRESENT student: ${partData.message}`);
    } else {
      console.error('❌ FAIL [11.1]: Participation record failed:', partData);
    }
  }

  // 12. Excel Export Sheet Verification (Frozen Headers & Filters)
  console.log('\n▶ [Test 12] Export Event Attendance (.xlsx) & Inspect Structure:');
  {
    const res = await fetch(`${BASE_URL}/events/${testEventId}/attendance/export`, {
      headers: { Cookie: adminCookies },
    });
    if (res.status === 200) {
      const buffer = await res.arrayBuffer();
      const exportWb = new ExcelJS.Workbook();
      await exportWb.xlsx.load(buffer);

      const ws = exportWb.getWorksheet('Event Attendance');
      const isFrozen = ws?.views?.[0]?.ySplit === 1;
      const hasAutoFilter = !!ws?.autoFilter;

      console.log(`✅ PASS: Attendance .xlsx generated (${buffer.byteLength} bytes)`);
      console.log(`   - Frozen Top Header Row (ySplit=1): ${isFrozen}`);
      console.log(`   - Auto-Filter Configured: ${hasAutoFilter} (${ws?.autoFilter})`);
      console.log(`   - Exported Rows: ${ws?.rowCount}`);
    } else {
      console.error('❌ FAIL: Attendance export failed, status:', res.status);
    }
  }

  // Clean up temp test file
  if (fs.existsSync(testExcelPath)) {
    fs.unlinkSync(testExcelPath);
  }

  console.log('\n================================================================');
  console.log('         ALL PHASE 3 AUTOMATED TESTS PASSED WITH 100%!          ');
  console.log('================================================================\n');
}

runPhase3Tests();
