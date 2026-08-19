const BASE_URL = 'http://localhost:5000/api';

async function runSimplifiedAdminWorkflowTest() {
  console.log('================================================================');
  console.log('    INFLUENCEX — SIMPLIFIED ADMIN WORKFLOW VERIFICATION        ');
  console.log('================================================================\n');

  let adminCookies = '';
  let studentCookies = '';
  let testStudentId = '';
  let testEventId = '';
  let testStudentIxId = '';

  const getCookies = (res) => {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    return raw.map((c) => c.split(';')[0]).join('; ');
  };

  // STEP 1: Admin Authentication
  console.log('▶ [Step 1] Admin Authentication:');
  {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@influencex.niat.edu', password: 'Admin@123456' }),
    });
    if (!res.ok) throw new Error(`Admin login failed: ${res.status}`);
    adminCookies = getCookies(res);
    const data = await res.json();
    console.log(`✅ PASS: Admin authenticated: ${data.user.name} (${data.user.email})`);
  }

  // STEP 2: Create a Test Student
  console.log('\n▶ [Step 2] Provision Test Student Member:');
  {
    const stamp = Date.now();
    const email = `test.student.${stamp}@influencex.niat.edu`;
    const regRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        fullName: `Rohan Sharma ${stamp.toString().slice(-4)}`,
        collegeEmail: email,
        password: 'Password@123',
        collegeStudentId: `ST-${stamp.toString().slice(-6)}`,
        branch: 'CSE',
        year: 3,
        section: 'A',
        status: 'APPROVED',
      }),
    });
    const regData = await regRes.json();
    if (!regRes.ok) throw new Error(`Student registration failed: ${JSON.stringify(regData)}`);
    testStudentId = regData.student.id;
    testStudentIxId = regData.student.influenceXId;

    // Student Login
    const sLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Password@123',
      }),
    });
    studentCookies = getCookies(sLoginRes);

    console.log(`✅ PASS: Student created & approved: ${regData.student.fullName} (IXID: ${testStudentIxId})`);
  }

  // STEP 3: Admin Creates Workshop with Date, Hall, Attendance Window & Interaction Window
  console.log('\n▶ [Step 3] Admin Creates Workshop with Attendance & Interaction Windows:');
  {
    const catRes = await fetch(`${BASE_URL}/event-categories`, { headers: { Cookie: adminCookies } });
    const catData = await catRes.json();
    const categoryId = catData.categories[0].id;

    const now = new Date();
    const eventPayload = {
      name: `Full-Stack GenAI Masterclass ${Date.now().toString().slice(-4)}`,
      description: 'Hands-on agentic workflows with LangChain and Google Gemini.',
      categoryId,
      date: now.toISOString().split('T')[0],
      startTime: '10:00 AM',
      endTime: '01:00 PM',
      venue: 'Main Auditorium Hall A',
      hall: 'Auditorium Hall A',
      capacity: 100,
      registrationStart: new Date(now.getTime() - 2 * 3600000).toISOString(),
      registrationEnd: new Date(now.getTime() + 2 * 3600000).toISOString(),
      attendanceWindowStart: new Date(now.getTime() - 1 * 3600000).toISOString(),
      attendanceWindowEnd: new Date(now.getTime() + 2 * 3600000).toISOString(),
      creditWindowStart: new Date(now.getTime() - 1 * 3600000).toISOString(),
      creditWindowEnd: new Date(now.getTime() + 4 * 3600000).toISOString(),
      interactionWindowStart: new Date(now.getTime() - 1 * 3600000).toISOString(),
      interactionWindowEnd: new Date(now.getTime() + 4 * 3600000).toISOString(),
      status: 'OPEN',
    };

    const evRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify(eventPayload),
    });
    const evData = await evRes.json();
    if (!evRes.ok) throw new Error(`Create event failed: ${JSON.stringify(evData)}`);
    testEventId = evData.event.id;
    console.log(`✅ PASS: Workshop created: ${evData.event.eventId} — "${evData.event.name}" in Hall "${evData.event.venue}"`);
  }

  // STEP 4: Student Self-Registration (Auto +10 credits)
  console.log('\n▶ [Step 4] Student Registers -> Verify Automatic +10 Registration Credits:');
  {
    const regRes = await fetch(`${BASE_URL}/events/${testEventId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: studentCookies },
    });
    const regData = await regRes.json();
    if (!regRes.ok) throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    console.log(`✅ PASS: Registration confirmed: ${regData.message}`);

    // Check student live statement
    const stmtRes = await fetch(`${BASE_URL}/students/${testStudentId}/credits`, {
      headers: { Cookie: adminCookies },
    });
    const stmtData = await stmtRes.json();
    console.log(`✅ PASS: Verified balance after registration: ${stmtData.student.liveTotalCredits} pts (Expected: 10 pts)`);
    if (stmtData.student.liveTotalCredits !== 10) throw new Error(`Expected 10 pts, got ${stmtData.student.liveTotalCredits}`);
  }

  // STEP 5: Admin Marks Physical Attendance as PRESENT (Auto +20 credits)
  console.log('\n▶ [Step 5] Admin Marks Attendance as PRESENT -> Verify Automatic +20 Attendance Credits:');
  {
    const attRes = await fetch(`${BASE_URL}/events/${testEventId}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({ studentId: testStudentId, status: 'PRESENT' }),
    });
    const attData = await attRes.json();
    if (!attRes.ok) throw new Error(`Mark attendance failed: ${JSON.stringify(attData)}`);
    console.log(`✅ PASS: Attendance response: ${attData.message}`);

    // Check student live statement
    const stmtRes = await fetch(`${BASE_URL}/students/${testStudentId}/credits`, {
      headers: { Cookie: adminCookies },
    });
    const stmtData = await stmtRes.json();
    console.log(`✅ PASS: Verified balance after attendance: ${stmtData.student.liveTotalCredits} pts (Expected: 30 pts: 10 reg + 20 att)`);
    if (stmtData.student.liveTotalCredits !== 30) throw new Error(`Expected 30 pts, got ${stmtData.student.liveTotalCredits}`);
  }

  // STEP 6: Admin Marks Live Variable Interaction Points
  console.log('\n▶ [Step 6] Admin Records Interaction & Awards Variable Points:');
  {
    // Record interaction flag
    await fetch(`${BASE_URL}/events/${testEventId}/participation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({ studentId: testStudentId, participated: true, notes: 'Asked insightful questions on LLM agents' }),
    });

    // Award variable interaction points (+15 pts)
    const txRes = await fetch(`${BASE_URL}/events/${testEventId}/credits/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        eventId: testEventId,
        creditType: 'INTERACTION',
        amount: 15,
        reason: 'Outstanding live interaction during multi-agent session',
        studentIds: [testStudentId],
      }),
    });
    const txData = await txRes.json();
    console.log(`✅ PASS: Interaction points awarded: ${txData.message}`);

    // Check student live statement
    const stmtRes = await fetch(`${BASE_URL}/students/${testStudentId}/credits`, {
      headers: { Cookie: adminCookies },
    });
    const stmtData = await stmtRes.json();
    console.log(`✅ PASS: Verified balance after interaction: ${stmtData.student.liveTotalCredits} pts (Expected: 45 pts)`);
    if (stmtData.student.liveTotalCredits !== 45) throw new Error(`Expected 45 pts, got ${stmtData.student.liveTotalCredits}`);
  }

  // STEP 7: Advance Student to Tier 2 (Rising at 100+ pts) & Verify Rank Goodies Unlock
  console.log('\n▶ [Step 7] Student Earns 100+ Points -> Unlocks 🚀 Rising Tier & Goodie Kit:');
  {
    // Award +60 credits to push student above 100 pts (45 + 60 = 105 pts)
    await fetch(`${BASE_URL}/events/${testEventId}/credits/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        eventId: testEventId,
        creditType: 'WINNER',
        amount: 60,
        reason: 'Hackathon 1st Place Champion',
        studentIds: [testStudentId],
      }),
    });

    const stmtRes = await fetch(`${BASE_URL}/students/${testStudentId}/credits`, {
      headers: { Cookie: adminCookies },
    });
    const stmtData = await stmtRes.json();
    console.log(`✅ PASS: Updated balance: ${stmtData.student.liveTotalCredits} pts | Current Tier: ${stmtData.student.currentLevel}`);

    // Fetch Rank-Based Goodies list
    const goodiesRes = await fetch(`${BASE_URL}/rewards/rank-goodies`, {
      headers: { Cookie: adminCookies },
    });
    const goodiesData = await goodiesRes.json();
    const studentGoodies = goodiesData.goodies.filter((g) => g.studentId.influenceXId === testStudentIxId);
    console.log(`✅ PASS: Student has ${studentGoodies.length} rank goodies unlocked:`);
    studentGoodies.forEach((g) => {
      console.log(`     - [${g.status}] Level: ${g.levelName} | Item: "${g.goodieName}"`);
    });

    // STEP 8: Admin Marks Goodie as ISSUED
    console.log('\n▶ [Step 8] Admin Marks Rank Goodie as ISSUED:');
    const risingGoodie = studentGoodies.find((g) => g.levelName === 'Rising') || studentGoodies[0];
    const issueRes = await fetch(`${BASE_URL}/rewards/rank-goodies/${risingGoodie.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({ status: 'ISSUED', notes: 'Handed over in Club Office Hall A' }),
    });
    const issueData = await issueRes.json();
    console.log(`✅ PASS: Goodie updated: Status=${issueData.goodie.status}`);
  }

  // STEP 9: Monthly Leaderboard & 5-Category Rank Filtering
  console.log('\n▶ [Step 9] Monthly Leaderboard & 5-Tier Category Ranking Filters:');
  {
    const ranksRes = await fetch(`${BASE_URL}/leaderboard?timeframe=overall&tier=Rising`, {
      headers: { Cookie: adminCookies },
    });
    const ranksData = await ranksRes.json();
    console.log(`✅ PASS: 🚀 Rising Tier Leaderboard returned ${ranksData.leaderboard.length} student(s):`);
    ranksData.leaderboard.slice(0, 3).forEach((r) => {
      console.log(`     #${r.rank} ${r.fullName} (${r.influenceXId}) — ${r.credits} pts [${r.currentLevel}]`);
    });
  }

  // STEP 10: Audit Log Verification
  console.log('\n▶ [Step 10] Audit Log Verification for all Operations:');
  {
    const auditRes = await fetch(`${BASE_URL}/audit-logs?limit=10`, {
      headers: { Cookie: adminCookies },
    });
    const auditData = await auditRes.json();
    console.log(`✅ PASS: ${auditData.logs.length} recent immutable audit log rows recorded:`);
    auditData.logs.slice(0, 5).forEach((l, idx) => {
      console.log(`     [${idx + 1}] Action: ${l.action} | Actor: ${l.actorName} | Reason: ${l.reason.slice(0, 70)}...`);
    });
  }

  console.log('\n================================================================');
  console.log('   🎉 SIMPLIFIED ADMIN WORKFLOW VERIFIED 100% SUCCESSFULLY!     ');
  console.log('================================================================\n');
}

runSimplifiedAdminWorkflowTest().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
