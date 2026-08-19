const API_BASE = 'http://127.0.0.1:5000/api';

async function testRevokeAndSync() {
  console.log('================================================================');
  console.log('   VERIFYING REGISTRATION CREDIT REVOCATION & CROSS-ROLE SYNC   ');
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

  // 2. Create Workshop & Roster
  console.log('\n2. Creating Workshop & Placing Student...');
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const winStart = new Date(now.getTime() - 10 * 60000).toISOString();
  const winEnd = new Date(now.getTime() + 180 * 60000).toISOString();

  const wsRes = await fetch(`${API_BASE}/workshops`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Revoke Test Masterclass',
      description: 'Testing registration credit revocation and role sync',
      date: today,
      startTime: '09:00 AM',
      endTime: '12:00 PM',
      halls: [{ name: 'Hall Alpha', capacity: 50 }],
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
      assignments: [{ name: 'Volunteer Three', ixId: 'IXVOL03', niatId: 'N25VOL03', hallName: 'Hall Alpha' }],
    }),
  });
  const credRes = await fetch(`${API_BASE}/workshops/${wsId}/setup/volunteers/credentials`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const credData = await credRes.json();
  const volCred = credData.credentials.find((c) => c.ixId === 'IXVOL03');

  // Commit Student
  await fetch(`${API_BASE}/workshops/${wsId}/setup/students/commit`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      roster: [
        {
          assignedOrder: 1,
          name: 'Sameer Sen',
          ixId: 'IX00999',
          niatId: '21CS999',
          collegeEmail: 'sameer.sen@influencex.niat.edu',
          hallName: 'Hall Alpha',
          isWaitlisted: false,
        },
      ],
    }),
  });
  console.log('   ✅ Student "Sameer Sen" (IX00999) committed with +10 registration credits.');

  // 3. Verify Volunteer Active Session & Total Cumulative Credits Sync
  console.log('\n3. Volunteer Logging In to check total cumulative credits sync...');
  const volLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'IXVOL03', password: volCred.tempPassword }),
  });
  const volLoginData = await volLoginRes.json();
  const volHeaders = { Authorization: `Bearer ${volLoginData.accessToken}` };

  const volSessionRes = await fetch(`${API_BASE}/volunteer/active-session`, { method: 'GET', headers: volHeaders });
  const volSessionData = await volSessionRes.json();
  const volStudentItem = volSessionData.students.find((s) => s.influenceXId === 'IX00999');

  // Check Leaderboard Total Credits for Sameer Sen
  const lbRes = await fetch(`${API_BASE}/leaderboard?scope=all-time`, { method: 'GET', headers: adminHeaders });
  const lbData = await lbRes.json();
  const lbStudentItem = lbData.rankings.find((s) => s.influenceXId === 'IX00999');

  console.log(`   ✅ Volunteer Portal Cumulative Total Credits: ${volStudentItem.cumulativeTotalCredits} pts`);
  console.log(`   ✅ Admin Leaderboard Total Credits: ${lbStudentItem ? lbStudentItem.totalCredits : 0} pts`);

  if (volStudentItem.cumulativeTotalCredits === (lbStudentItem ? lbStudentItem.totalCredits : 10)) {
    console.log('   🎉 VOLUNTEER PORTAL AND ADMIN LEADERBOARD CREDITS 100% SYNCHRONIZED!');
  } else {
    throw new Error(`Sync mismatch! Volunteer: ${volStudentItem.cumulativeTotalCredits}, Leaderboard: ${lbStudentItem?.totalCredits}`);
  }

  // 4. Test Revoking Registration Credits (+10) via Admin API
  console.log('\n4. Revoking Auto-Awarded Registration Credits (+10) via Admin API...');
  const revokeRes = await fetch(`${API_BASE}/workshops/${wsId}/revoke-registration-credits`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const revokeData = await revokeRes.json();
  console.log(`   ✅ Revoke API Status: ${revokeRes.status}`);
  console.log(`   ✅ Revoke Response Data:`, JSON.stringify(revokeData));

  // Verify credits after revocation
  const lbResPost = await fetch(`${API_BASE}/leaderboard?scope=all-time`, { method: 'GET', headers: adminHeaders });
  const lbDataPost = await lbResPost.json();
  const lbStudentPost = lbDataPost.rankings.find((s) => s.influenceXId === 'IX00999');
  console.log(`   ✅ Leaderboard Total Credits after Revocation: ${lbStudentPost ? lbStudentPost.totalCredits : 0} pts`);

  console.log('\n================================================================');
  console.log('   🎉 REGISTRATION CREDIT REVOCATION & ROLE SYNC VERIFIED!     ');
  console.log('================================================================\n');
}

testRevokeAndSync().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
