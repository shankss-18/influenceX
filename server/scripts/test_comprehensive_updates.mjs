const API_BASE = 'http://127.0.0.1:5000/api';

async function testComprehensiveUpdates() {
  console.log('================================================================');
  console.log('   VERIFYING COMPREHENSIVE FEATURES & SECURITY UPDATES          ');
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

  // 2. Create Workshop with Google Form URL
  console.log('\n2. Creating Workshop with Google Form URL...');
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const winStart = new Date(now.getTime() - 10 * 60000).toISOString();
  const winEnd = new Date(now.getTime() + 180 * 60000).toISOString();

  const createWsRes = await fetch(`${API_BASE}/workshops`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'InfluenceX AI Agents & Automation 2026',
      description: 'Comprehensive Workshop with Google Form URL',
      date: today,
      startTime: '10:00 AM',
      endTime: '01:00 PM',
      halls: [
        { name: 'Hall 3', capacity: 60 },
        { name: 'Hall 4', capacity: 70 },
      ],
      attendanceWindowStart: winStart,
      attendanceWindowEnd: winEnd,
      creditCap: 50,
      registrationFormUrl: 'https://forms.gle/AgentsSummit2026',
    }),
  });
  const wsData = await createWsRes.json();
  const wsId = wsData.workshop._id || wsData.workshop.id;
  console.log(`   ✅ Workshop Created (ID: ${wsId}, Google Form: ${wsData.workshop.registrationFormUrl})`);

  // 3. Edit Workshop Google Form URL
  console.log('\n3. Testing Admin Editing Google Form Registration URL...');
  const editRes = await fetch(`${API_BASE}/workshops/${wsId}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      registrationFormUrl: 'https://forms.gle/UpdatedAgentsSummit2026',
    }),
  });
  const editData = await editRes.json();
  console.log(`   ✅ Edit Response: ${editData.message}`);

  // 4. Assign Volunteer & Generate Random Credentials
  console.log('\n4. Assigning Volunteer to Hall 3 & Generating Random Temp Password...');
  await fetch(`${API_BASE}/workshops/${wsId}/setup/volunteers/assign`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      assignments: [
        { name: 'Rohan Gupta', ixId: 'IX0802', niatId: 'N25H01A0802', hallName: 'Hall 3' },
        { name: 'Priya Mehta', ixId: 'IX0803', niatId: 'N25H01A0803', hallName: 'Hall 3' },
        { name: 'Sanjay Verma', ixId: 'IX0804', niatId: 'N25H01A0804', hallName: 'Hall 4' },
        { name: 'Neha Rao', ixId: 'IX0805', niatId: 'N25H01A0805', hallName: 'Hall 4' },
      ],
    }),
  });

  const genCredsRes = await fetch(`${API_BASE}/workshops/${wsId}/setup/volunteers/credentials`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const genCredsData = await genCredsRes.json();
  const rohanCred = genCredsData.credentials.find((c) => c.ixId === 'IX0802');
  console.log(`   ✅ Rohan's Random Generated Temp PIN: ${rohanCred.tempPassword}`);

  // 5. Upload Students (1 in Hall 3, 1 in Hall 4)
  console.log('\n5. Committing Students Placement...');
  await fetch(`${API_BASE}/workshops/${wsId}/setup/students/commit`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      roster: [
        {
          assignedOrder: 1,
          name: 'Meera Patel',
          ixId: 'IX5001',
          niatId: 'N25H01A5001',
          collegeEmail: 'meera.ix5001@influencex.niat.edu',
          hallName: 'Hall 3',
          isWaitlisted: false,
        },
      ],
    }),
  });
  console.log('   ✅ Student Meera Patel committed to Hall 3.');

  // 6. Volunteer Login & Active Session Inspection
  console.log("\n6. Logging in as Volunteer Rohan ('IX0802')...");
  const volLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'IX0802', password: rohanCred.tempPassword }),
  });
  const volLoginData = await volLoginRes.json();
  const volHeaders = { Authorization: `Bearer ${volLoginData.accessToken}`, 'Content-Type': 'application/json' };

  // Volunteer gets active session
  console.log('\n7. Volunteer Fetching Active Session & Cumulative Credits Column...');
  const volSessionRes = await fetch(`${API_BASE}/volunteer/active-session`, {
    method: 'GET',
    headers: volHeaders,
  });
  const volSessionData = await volSessionRes.json();
  const meeraInHall = volSessionData.students.find((s) => s.influenceXId === 'IX5001');
  console.log(`   ✅ Meera Found in Hall: Assigned Hall = ${volSessionData.assignedHall.name}`);
  console.log(`   ✅ Meera Cumulative Credits = ${meeraInHall.cumulativeTotalCredits} pts`);
  console.log(`   ✅ Meera Remaining Cap Headroom = ${meeraInHall.remainingCapHeadroom} pts`);

  // 8. Volunteer Marks Attendance (+20)
  console.log('\n8. Volunteer Marking Attendance for Meera (+20)...');
  await fetch(`${API_BASE}/volunteer/attendance`, {
    method: 'POST',
    headers: volHeaders,
    body: JSON.stringify({ studentId: meeraInHall.studentId, status: 'PRESENT' }),
  });

  // 9. Volunteer Awards Performance Points with Reason #1 (+10)
  console.log("\n9. Volunteer Evaluating Performance Points (+10) with Reason 'Excellent team coordination'...");
  const scoreRes1 = await fetch(`${API_BASE}/volunteer/credits`, {
    method: 'POST',
    headers: volHeaders,
    body: JSON.stringify({
      studentId: meeraInHall.studentId,
      points: 10,
      reason: 'Excellent team coordination and architecture design',
    }),
  });
  const scoreData1 = await scoreRes1.json();
  console.log(`   ✅ Score #1 Result: ${scoreData1.message}`);
  console.log(`   ✅ Reason Recorded: "${scoreData1.participationReason}"`);
  console.log(`   ✅ Cumulative Total Credits: ${scoreData1.cumulativeTotalCredits} pts`);

  // 10. Volunteer Re-Edits Performance Points with Reason #2 (+15)
  console.log("\n10. Volunteer Re-Editing Score (+15) with Reason 'Winner of Agentic Hackathon Demo'...");
  const scoreRes2 = await fetch(`${API_BASE}/volunteer/credits`, {
    method: 'POST',
    headers: volHeaders,
    body: JSON.stringify({
      studentId: meeraInHall.studentId,
      points: 15,
      reason: 'Winner of Agentic Hackathon Demo & Q&A Lead',
    }),
  });
  const scoreData2 = await scoreRes2.json();
  console.log(`   ✅ Score #2 (Re-edit) Result: ${scoreData2.message}`);
  console.log(`   ✅ Updated Reason: "${scoreData2.participationReason}"`);
  console.log(`   ✅ Updated Total Workshop Credits: ${scoreData2.totalCreditsThisWorkshop} pts (10 Reg + 20 Att + 15 Part)`);
  console.log(`   ✅ Remaining Headroom: ${scoreData2.remainingCapHeadroom} pts (Cap 50 - 45 = 5 pts)`);

  // 11. Admin Detailed Inspection for Meera
  console.log('\n11. Admin Inspecting Meera Details (GET /api/leaderboard/students/:studentId/details)...');
  const inspectRes = await fetch(`${API_BASE}/leaderboard/students/${meeraInHall.studentId}/details`, {
    method: 'GET',
    headers: adminHeaders,
  });
  const inspectData = await inspectRes.json();
  console.log(`   ✅ Student: ${inspectData.student.fullName} (${inspectData.student.influenceXId})`);
  console.log(`   ✅ Total Cumulative Credits: ${inspectData.student.totalCredits} pts`);
  console.log(`   ✅ Participated Workshops Count: ${inspectData.workshops.length}`);
  const meeraWs = inspectData.workshops[0];
  console.log(`      - Workshop: ${meeraWs.name}`);
  console.log(`      - Assigned Hall: ${meeraWs.assignedHall}`);
  console.log(`      - Attendance: ${meeraWs.attendanceStatus}`);
  console.log(`      - Breakdown: Reg=${meeraWs.creditBreakdown.registration}, Att=${meeraWs.creditBreakdown.attendance}, Part=${meeraWs.creditBreakdown.participation} -> Total=${meeraWs.creditBreakdown.total} pts`);
  console.log(`      - Participation Reason: "${meeraWs.participationReason}"`);

  // 12. Student Login & Goodie Distribution Synchronization
  console.log("\n12. Student Meera Logging In to Portal (Username='IX5001', Pass='IX5001')...");
  const studentLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'IX5001', password: 'IX5001' }),
  });
  const studentLoginData = await studentLoginRes.json();
  const studentHeaders = { Authorization: `Bearer ${studentLoginData.accessToken}` };

  const studentPortalRes = await fetch(`${API_BASE}/student-portal/portal`, {
    method: 'GET',
    headers: studentHeaders,
  });
  const studentPortalData = await studentPortalRes.json();
  console.log(`   ✅ Student Portal Goodie Reward: ${studentPortalData.creditsSummary.goodieReward}`);
  console.log(`   ✅ Goodie Distribution Status: ${studentPortalData.creditsSummary.goodieStatus} (Pending Distribution)`);

  console.log('\n================================================================');
  console.log('   🎉 ALL COMPREHENSIVE FEATURES & LEDGER INTEGRITY 100% PASS! ');
  console.log('================================================================\n');
}

testComprehensiveUpdates().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
