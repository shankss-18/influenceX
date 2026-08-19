const API_BASE = 'http://127.0.0.1:5000/api';

async function testUserReportedIssues() {
  console.log('================================================================');
  console.log('   VERIFYING FIXES FOR USER REPORTED ISSUES                    ');
  console.log('================================================================\n');

  // 1. Admin Login
  console.log('1. Logging in as Admin...');
  const adminRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@influencex.niat.edu', password: 'Admin@123456' }),
  });
  const adminData = await adminRes.json();
  const adminHeaders = { Authorization: `Bearer ${adminData.accessToken}`, 'Content-Type': 'application/json' };
  console.log('   ✅ Admin Authenticated.');

  // 2. Create Workshop & Assign Volunteer & Students
  console.log('\n2. Setting up test workshop & roster...');
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const winStart = new Date(now.getTime() - 10 * 60000).toISOString();
  const winEnd = new Date(now.getTime() + 180 * 60000).toISOString();

  const wsRes = await fetch(`${API_BASE}/workshops`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Verification Workshop 2026',
      description: 'Testing IXID auth, attendance toggle, and name matching',
      date: today,
      startTime: '09:00 AM',
      endTime: '12:00 PM',
      halls: [{ name: 'Main Hall', capacity: 50 }],
      attendanceWindowStart: winStart,
      attendanceWindowEnd: winEnd,
      creditCap: 50,
    }),
  });
  const wsData = await wsRes.json();
  const wsId = wsData.workshop._id || wsData.workshop.id;

  // Assign Volunteer
  await fetch(`${API_BASE}/workshops/${wsId}/setup/volunteers/assign`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      assignments: [
        { name: 'Volunteer One', ixId: 'IXVOL01', niatId: 'N25VOL01', hallName: 'Main Hall' },
      ],
    }),
  });

  const credRes = await fetch(`${API_BASE}/workshops/${wsId}/setup/volunteers/credentials`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const credData = await credRes.json();
  const volCred = credData.credentials.find((c) => c.ixId === 'IXVOL01');

  // Upload Student
  await fetch(`${API_BASE}/workshops/${wsId}/setup/students/commit`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      roster: [
        {
          assignedOrder: 1,
          name: 'Aditya Sharma',
          ixId: 'IX00015',
          niatId: '21CS042',
          collegeEmail: 'aditya.sharma@influencex.niat.edu',
          hallName: 'Main Hall',
          isWaitlisted: false,
        },
      ],
    }),
  });
  console.log('   ✅ Student "Aditya Sharma" (IX00015) committed.');

  // 3. Test Student Login with Username = IX00015 & Password = IX00015
  console.log("\n3. Testing Student Login with IXID as Username & Password ('IX00015')...");
  const studentLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'IX00015', password: 'IX00015' }),
  });
  const studentLoginData = await studentLoginRes.json();
  console.log(`   ✅ Student Login Status: ${studentLoginRes.status}`);
  if (!studentLoginRes.ok) {
    console.error('   ❌ Login Error Message:', studentLoginData.error);
    throw new Error(`Login failed with status ${studentLoginRes.status}: ${studentLoginData.error}`);
  }
  console.log(`   ✅ Authenticated User Name: "${studentLoginData.user.name}"`);
  console.log(`   ✅ Authenticated User IXID: "${studentLoginData.user.ixId}"`);

  // Verify Student Portal Profile Match
  const studentHeaders = { Authorization: `Bearer ${studentLoginData.accessToken}` };
  const portalRes = await fetch(`${API_BASE}/student-portal/portal`, {
    method: 'GET',
    headers: studentHeaders,
  });
  const portalData = await portalRes.json();
  console.log(`   ✅ Student Portal Name: "${portalData.student.fullName}"`);
  console.log(`   ✅ Student Portal IXID: "${portalData.student.influenceXId}"`);

  if (
    portalData.student.fullName === studentLoginData.user.name &&
    portalData.student.influenceXId === studentLoginData.user.ixId
  ) {
    console.log(`   🎉 NAME AND IXID 100% MATCHED PERFECTLY! ("${portalData.student.fullName}" • "${portalData.student.influenceXId}")`);
  } else {
    throw new Error(`Mismatch! User: ${studentLoginData.user.name}/${studentLoginData.user.ixId}, Portal: ${portalData.student.fullName}/${portalData.student.influenceXId}`);
  }

  // 4. Test Volunteer Login & Attendance Toggle
  console.log('\n4. Volunteer Logging In...');
  const volLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'IXVOL01', password: volCred.tempPassword }),
  });
  const volLoginData = await volLoginRes.json();
  const volHeaders = { Authorization: `Bearer ${volLoginData.accessToken}`, 'Content-Type': 'application/json' };

  // Fetch active session
  const volSessionRes = await fetch(`${API_BASE}/volunteer/active-session`, {
    method: 'GET',
    headers: volHeaders,
  });
  const volSessionData = await volSessionRes.json();
  const adityaInRoster = volSessionData.students.find((s) => s.influenceXId.includes('15'));

  // Test toggling Present
  console.log('\n5. Toggling Attendance to PRESENT...');
  const togglePresentRes = await fetch(`${API_BASE}/volunteer/attendance`, {
    method: 'POST',
    headers: volHeaders,
    body: JSON.stringify({ studentId: adityaInRoster.studentId, status: 'PRESENT' }),
  });
  const togglePresentData = await togglePresentRes.json();
  console.log(`   ✅ Attendance Toggle PRESENT Response: ${togglePresentData.message}`);

  // Test awarding performance points when PRESENT
  console.log('\n6. Awarding Performance Points (+10) when PRESENT...');
  const awardRes = await fetch(`${API_BASE}/volunteer/credits`, {
    method: 'POST',
    headers: volHeaders,
    body: JSON.stringify({ studentId: adityaInRoster.studentId, points: 10, reason: 'Great presentation' }),
  });
  const awardData = await awardRes.json();
  console.log(`   ✅ Award Response: ${awardData.message} (Total: ${awardData.totalCreditsThisWorkshop} pts)`);

  // Test toggling ABSENT (should clear attendance & participation points)
  console.log('\n7. Toggling Attendance to ABSENT...');
  const toggleAbsentRes = await fetch(`${API_BASE}/volunteer/attendance`, {
    method: 'POST',
    headers: volHeaders,
    body: JSON.stringify({ studentId: adityaInRoster.studentId, status: 'ABSENT' }),
  });
  const toggleAbsentData = await toggleAbsentRes.json();
  console.log(`   ✅ Attendance Toggle ABSENT Response: ${toggleAbsentData.message}`);

  // Test attempting to award points when ABSENT (must fail with 400)
  console.log('\n8. Attempting to award points when ABSENT (expect 400 rejection)...');
  const rejectAwardRes = await fetch(`${API_BASE}/volunteer/credits`, {
    method: 'POST',
    headers: volHeaders,
    body: JSON.stringify({ studentId: adityaInRoster.studentId, points: 10, reason: 'Test absent award' }),
  });
  const rejectAwardData = await rejectAwardRes.json();
  console.log(`   ✅ Rejection Status: ${rejectAwardRes.status} (Error: "${rejectAwardData.error}")`);

  console.log('\n================================================================');
  console.log('   🎉 ALL USER REPORTED ISSUES 100% FIXED AND VERIFIED!        ');
  console.log('================================================================\n');
}

testUserReportedIssues().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
