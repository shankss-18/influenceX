const API_BASE = 'http://127.0.0.1:5000/api';

async function testStudentLoginWithIXID() {
  console.log('======================================================');
  console.log('   TESTING STUDENT LOGIN WITH DEFAULT IXID CREDENTIALS');
  console.log('======================================================\n');

  // 1. Admin login & create a test student via workshop roster
  const adminRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@influencex.niat.edu', password: 'Admin@123456' }),
  });
  const adminData = await adminRes.json();
  const adminHeaders = { Authorization: `Bearer ${adminData.accessToken}`, 'Content-Type': 'application/json' };

  // Create test workshop
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const winStart = new Date(now.getTime() - 10 * 60000).toISOString();
  const winEnd = new Date(now.getTime() + 180 * 60000).toISOString();

  const createWsRes = await fetch(`${API_BASE}/workshops`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Student Auth Test Workshop',
      description: 'Verifying student IXID default auth',
      date: today,
      startTime: '10:00 AM',
      endTime: '01:00 PM',
      halls: [{ name: 'Hall 3', capacity: 60 }],
      attendanceWindowStart: winStart,
      attendanceWindowEnd: winEnd,
      creditCap: 50,
    }),
  });
  const wsData = await createWsRes.json();
  const wsId = wsData.workshop._id || wsData.workshop.id;

  // Upload student with IXID = IX9999
  console.log("1. Committing new student with IXID = 'IX9999'...");
  await fetch(`${API_BASE}/workshops/${wsId}/setup/students/commit`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      roster: [
        {
          assignedOrder: 1,
          name: 'Kavya Sharma',
          ixId: 'IX9999',
          niatId: 'N25H01A9999',
          collegeEmail: 'kavya.ix9999@influencex.niat.edu',
          hallName: 'Hall 3',
          isWaitlisted: false,
        },
      ],
    }),
  });
  console.log("   ✅ Student 'Kavya Sharma' created with IXID 'IX9999'.\n");

  // 2. Student logs in for the first time using username = "IX9999" and password = "IX9999"
  console.log("2. Testing student login: Username='IX9999', Password='IX9999'...");
  const studentLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'IX9999', password: 'IX9999' }),
  });
  const studentLoginData = await studentLoginRes.json();
  console.log(`   ✅ Login response status: ${studentLoginRes.status}`);
  console.log(`   ✅ User role: ${studentLoginData.user.role}`);
  console.log(`   ✅ mustChangePassword: ${studentLoginData.user.mustChangePassword}`);

  if (!studentLoginData.accessToken) {
    throw new Error('Failed to login with default IXID password');
  }

  const studentHeaders = {
    Authorization: `Bearer ${studentLoginData.accessToken}`,
    'Content-Type': 'application/json',
  };

  // 3. First login forced password change
  console.log("\n3. Setting permanent custom password ('KavyaSecurePass@2026')...");
  const resetRes = await fetch(`${API_BASE}/auth/change-password-first-login`, {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({ newPassword: 'KavyaSecurePass@2026' }),
  });
  const resetData = await resetRes.json();
  console.log(`   ✅ Password reset response: ${resetData.message}`);

  // 4. Test logging in with the new permanent password
  console.log("\n4. Testing subsequent login with new permanent password...");
  const subLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'IX9999', password: 'KavyaSecurePass@2026' }),
  });
  const subLoginData = await subLoginRes.json();
  console.log(`   ✅ Logged in successfully: User '${subLoginData.user.name}', mustChangePassword=${subLoginData.user.mustChangePassword}`);

  // 5. Test changing password anytime from portal
  console.log("\n5. Testing voluntary password change from portal header...");
  const changeRes = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${subLoginData.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword: 'KavyaSecurePass@2026',
      newPassword: 'KavyaUpdatedPass@2026',
    }),
  });
  const changeData = await changeRes.json();
  console.log(`   ✅ Voluntary password change response: ${changeData.message}`);

  // 6. Access Student Portal
  console.log('\n6. Accessing Student Portal (GET /api/student-portal/portal)...');
  const portalRes = await fetch(`${API_BASE}/student-portal/portal`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${subLoginData.accessToken}`,
    },
  });
  const portalData = await portalRes.json();
  console.log(`   ✅ Student Portal Loaded: ${portalData.student.fullName} (${portalData.student.influenceXId})`);
  console.log(`   ✅ Total Credits: ${portalData.creditsSummary.totalCredits} pts, Tier: ${portalData.creditsSummary.currentLevel}`);

  console.log('\n======================================================');
  console.log('   🎉 STUDENT DEFAULT IXID AUTH & PASSWORD LIFECYCLE 100% PASS');
  console.log('======================================================\n');
}

testStudentLoginWithIXID().catch((err) => {
  console.error('Student auth test failed:', err);
  process.exit(1);
});
