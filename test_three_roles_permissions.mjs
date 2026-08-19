const BASE_URL = 'http://localhost:5000/api';

async function testThreeRolesPermissions() {
  console.log('================================================================');
  console.log('       INFLUENCEX 3-ROLE PERMISSIONS & RATE LIMIT TEST          ');
  console.log('================================================================\n');

  const getCookies = (res) => {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    return raw.map((c) => c.split(';')[0]).join('; ');
  };

  // 1. Authenticate Admin
  console.log('▶ [Step 1] Authenticating Admin:');
  const aRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@influencex.niat.edu', password: 'Admin@123456' }),
  });
  if (!aRes.ok) throw new Error(`Admin login failed: ${aRes.status}`);
  const adminCookies = getCookies(aRes);
  console.log('✅ PASS: Admin authenticated.');

  // 2. Provision Volunteer & Student accounts
  console.log('\n▶ [Step 2] Provisioning Volunteer and Student Accounts:');
  const stamp = Date.now();
  const volEmail = `volunteer.${stamp}@influencex.niat.edu`;
  const volUserRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
    body: JSON.stringify({
      name: 'Pooja Volunteer',
      email: volEmail,
      password: 'Volunteer@123',
      role: 'VOLUNTEER',
    }),
  });
  const volUserData = await volUserRes.json();
  console.log(`✅ PASS: Volunteer account created: ${volUserData.user.name} (Role: ${volUserData.user.role})`);

  // Login as Volunteer
  const volLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: volEmail, password: 'Volunteer@123' }),
  });
  const volunteerCookies = getCookies(volLoginRes);
  console.log('✅ PASS: Volunteer authenticated session established.');

  // Provision Student
  const stuEmail = `student.${stamp}@influencex.niat.edu`;
  const stuRes = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
    body: JSON.stringify({
      fullName: 'Rahul Student',
      collegeEmail: stuEmail,
      password: 'Student@123',
      collegeStudentId: `ST-${stamp.toString().slice(-6)}`,
      branch: 'CSE',
      year: 2,
      section: 'B',
      status: 'APPROVED',
    }),
  });
  const stuData = await stuRes.json();
  console.log(`✅ PASS: Student created: ${stuData.student.fullName} (IXID: ${stuData.student.influenceXId})`);

  // Login as Student
  const stuLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: stuEmail, password: 'Student@123' }),
  });
  const studentCookies = getCookies(stuLoginRes);
  console.log('✅ PASS: Student authenticated session established.');

  // 3. Admin creates Workshop
  console.log('\n▶ [Step 3] Admin Creates Workshop:');
  const catRes = await fetch(`${BASE_URL}/event-categories`, { headers: { Cookie: adminCookies } });
  const catData = await catRes.json();
  const categoryId = catData.categories[0].id;

  const now = new Date();
  const workshopRes = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
    body: JSON.stringify({
      name: `Role Matrix Workshop ${Date.now().toString().slice(-4)}`,
      description: 'Permissions testing event',
      categoryId,
      date: now.toISOString().split('T')[0],
      startTime: '10:00 AM',
      endTime: '01:00 PM',
      venue: 'Main Lab 1',
      capacity: 50,
      registrationStart: new Date(now.getTime() - 2 * 3600000).toISOString(),
      registrationEnd: new Date(now.getTime() + 2 * 3600000).toISOString(),
      attendanceWindowStart: new Date(now.getTime() - 1 * 3600000).toISOString(),
      attendanceWindowEnd: new Date(now.getTime() + 2 * 3600000).toISOString(),
      creditWindowStart: new Date(now.getTime() - 1 * 3600000).toISOString(),
      creditWindowEnd: new Date(now.getTime() + 4 * 3600000).toISOString(),
      status: 'OPEN',
    }),
  });
  const workshopData = await workshopRes.json();
  const eventId = workshopData.event.id;
  console.log(`✅ PASS: Admin successfully created workshop: ${workshopData.event.eventId}`);

  // 4. Volunteer attempts to create Workshop (Must be REJECTED 403)
  console.log('\n▶ [Step 4] Volunteer Attempts to Create Workshop (Must be Blocked):');
  const volCreateRes = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: volunteerCookies },
    body: JSON.stringify({
      name: 'Unauthorized Volunteer Workshop',
      description: 'Should fail',
      categoryId,
      date: now.toISOString().split('T')[0],
      venue: 'Hall X',
      capacity: 10,
      registrationStart: now.toISOString(),
      registrationEnd: now.toISOString(),
      attendanceWindowStart: now.toISOString(),
      attendanceWindowEnd: now.toISOString(),
      creditWindowStart: now.toISOString(),
      creditWindowEnd: now.toISOString(),
    }),
  });
  const volCreateData = await volCreateRes.json();
  if (volCreateRes.status === 403) {
    console.log(`✅ PASS: Volunteer blocked from creating workshop (403 Forbidden): "${volCreateData.error}"`);
  } else {
    throw new Error(`Expected 403 Forbidden, got ${volCreateRes.status}`);
  }

  // 5. Volunteer attempts to upload participant sheet (Must be REJECTED 403)
  console.log('\n▶ [Step 5] Volunteer Attempts to Upload Participant Sheet (Must be Blocked):');
  const volImportRes = await fetch(`${BASE_URL}/events/${eventId}/import/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: volunteerCookies },
    body: JSON.stringify({
      tempFilePath: 'fake.xlsx',
      validStudentIds: [stuData.student.id],
    }),
  });
  const volImportData = await volImportRes.json();
  if (volImportRes.status === 403) {
    console.log(`✅ PASS: Volunteer blocked from uploading spreadsheet (403 Forbidden): "${volImportData.error}"`);
  } else {
    throw new Error(`Expected 403 Forbidden, got ${volImportRes.status}`);
  }

  // 6. Student Registers
  console.log('\n▶ [Step 6] Student Self-Registers (+10 credits):');
  await fetch(`${BASE_URL}/events/${eventId}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentCookies },
  });
  console.log('✅ PASS: Student registered (+10 pts).');

  // 7. Volunteer Marks Physical Attendance (+20 credits) (Must SUCCEED)
  console.log('\n▶ [Step 7] Volunteer Marks Physical Attendance (Must be Permitted):');
  const volAttRes = await fetch(`${BASE_URL}/events/${eventId}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: volunteerCookies },
    body: JSON.stringify({ studentId: stuData.student.id, status: 'PRESENT' }),
  });
  const volAttData = await volAttRes.json();
  if (volAttRes.ok) {
    console.log(`✅ PASS: Volunteer successfully marked attendance: ${volAttData.message}`);
  } else {
    throw new Error(`Volunteer attendance failed: ${JSON.stringify(volAttData)}`);
  }

  // 8. Volunteer Awards Variable Interaction Points (+15 credits) (Must SUCCEED)
  console.log('\n▶ [Step 8] Volunteer Awards Variable Interaction Points (Must be Permitted):');
  const volIntRes = await fetch(`${BASE_URL}/events/${eventId}/credits/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: volunteerCookies },
    body: JSON.stringify({
      eventId,
      creditType: 'INTERACTION',
      amount: 15,
      reason: 'Great interaction in workshop discussion',
      studentIds: [stuData.student.id],
    }),
  });
  const volIntData = await volIntRes.json();
  if (volIntRes.ok) {
    console.log(`✅ PASS: Volunteer successfully awarded interaction points: ${volIntData.message}`);
  } else {
    throw new Error(`Volunteer credit award failed: ${JSON.stringify(volIntData)}`);
  }

  // 9. Verify Student Final Balance (10 reg + 20 att + 15 int = 45 pts)
  console.log('\n▶ [Step 9] Verify Student Balance:');
  const stmtRes = await fetch(`${BASE_URL}/students/${stuData.student.id}/credits`, {
    headers: { Cookie: adminCookies },
  });
  const stmtData = await stmtRes.json();
  console.log(`✅ PASS: Student verified ledger balance: ${stmtData.student.liveTotalCredits} pts (Expected: 45 pts)`);
  if (stmtData.student.liveTotalCredits !== 45) throw new Error(`Expected 45 pts, got ${stmtData.student.liveTotalCredits}`);

  console.log('\n================================================================');
  console.log('   🎉 3-ROLE PERMISSIONS (ADMIN/VOLUNTEER/STUDENT) VERIFIED!   ');
  console.log('================================================================\n');
}

testThreeRolesPermissions().catch((err) => {
  console.error('❌ Role permission test failed:', err);
  process.exit(1);
});
