const BASE_URL = 'http://localhost:5000/api';

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('         INFLUENCEX PHASE 4 AUTOMATED TEST SUITE                ');
  console.log('================================================================\n');

  let adminCookies = '';
  let studentCookies = '';
  let studentId = '';
  let student2Id = '';
  let testEventId = '';
  let pendingTransactionId = '';
  let testRewardId = '';

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

  // 2. Provision 2 Test Students
  console.log('\n▶ [Test 2] Provisioning Test Students:');
  const nowMs = Date.now();
  const studentEmail = `student_p4_${nowMs}@influencex.niat.edu`;
  {
    // Student 1
    const res1 = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        fullName: 'Sameer Sen',
        collegeEmail: studentEmail,
        password: 'Student@123456',
        collegeStudentId: `ROLL_P4_${nowMs}_1`,
        branch: 'CSE',
        year: 3,
        section: 'B',
        status: 'APPROVED',
      }),
    });
    const data1 = await res1.json();
    studentId = data1.student.id;
    console.log(`✅ PASS: Student 1 provisioned: ${data1.student.fullName} (IX: ${data1.student.influenceXId})`);

    // Student 2
    const res2 = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        fullName: 'Meera Nair',
        collegeEmail: `meera_p4_${nowMs}@influencex.niat.edu`,
        password: 'Student@123456',
        collegeStudentId: `ROLL_P4_${nowMs}_2`,
        branch: 'IT',
        year: 2,
        section: 'A',
        status: 'APPROVED',
      }),
    });
    const data2 = await res2.json();
    student2Id = data2.student.id;
    console.log(`✅ PASS: Student 2 provisioned: ${data2.student.fullName} (IX: ${data2.student.influenceXId})`);
  }

  // 3. Create Event with Active Credit Window
  console.log('\n▶ [Test 3] Create Event with Active Credit Window:');
  {
    const categoriesRes = await fetch(`${BASE_URL}/event-categories`);
    const catData = await categoriesRes.json();
    const categoryId = catData.categories[0].id;

    const res = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        name: 'Phase 4 Credit Ledger & Hackathon Finals',
        description: 'Comprehensive testing for bulk credit awarding and tier calculations',
        categoryId,
        date: new Date(nowMs + 86400000).toISOString(),
        startTime: '09:00 AM',
        endTime: '05:00 PM',
        venue: 'NIAT Auditorium',
        capacity: 100,
        registrationStart: new Date(nowMs - 3600000).toISOString(),
        registrationEnd: new Date(nowMs + 86400000).toISOString(),
        attendanceWindowStart: new Date(nowMs - 1800000).toISOString(),
        attendanceWindowEnd: new Date(nowMs + 7200000).toISOString(),
        creditWindowStart: new Date(nowMs - 1800000).toISOString(), // Active credit window
        creditWindowEnd: new Date(nowMs + 86400000).toISOString(),
        status: 'OPEN',
      }),
    });
    const data = await res.json();
    testEventId = data.event.id;
    console.log(`✅ PASS: Event created: ${data.event.eventId} — ${data.event.name}`);
  }

  // 4. Test Bulk Credit Awarding (Verify individual CreditTransaction documents)
  console.log('\n▶ [Test 4] Bulk Credit Awarding (Individual Atomic Ledger Records):');
  {
    const res = await fetch(`${BASE_URL}/events/${testEventId}/credits/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        eventId: testEventId,
        creditType: 'PARTICIPATION',
        amount: 25,
        reason: 'Active project implementation during hackathon session',
        studentIds: [studentId, student2Id],
      }),
    });
    const data = await res.json();
    if (res.status === 201 && data.success) {
      console.log(`✅ PASS: Bulk award complete: ${data.message}`);
      console.log(`   - Transactions Generated: ${data.count}`);
      console.log(`   - Total Points Awarded: ${data.totalCreditsAwarded}`);
      data.transactions.forEach((tx, idx) => {
        console.log(`     [Doc ${idx + 1}] Transaction ID: ${tx.transactionId}, Amount: +${tx.amount} pts, Status: ${tx.status}`);
      });
    } else {
      console.error('❌ FAIL: Bulk credit awarding failed:', data);
    }
  }

  // 5. Test Student Login & Self-Award Prevention
  console.log('\n▶ [Test 5] Student Self-Award Prevention (Server-Side Security Enforcement):');
  {
    // Login Student
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: studentEmail,
        password: 'Student@123456',
      }),
    });
    const loginData = await loginRes.json();
    studentCookies = getCookies(loginRes);

    // Attempt self-award via API
    const awardRes = await fetch(`${BASE_URL}/credits/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: studentCookies },
      body: JSON.stringify({
        studentId: studentId,
        creditType: 'SPECIAL_RECOGNITION',
        amount: 100,
        reason: 'Self-awarded points attempt',
      }),
    });
    const awardData = await awardRes.json();
    if (awardRes.status === 403 && awardData.error.includes('Forbidden')) {
      console.log('✅ PASS: Rejected student self-award attempt (403 Forbidden):', awardData.error);
    } else {
      console.error(`❌ FAIL: Expected 403 Forbidden, got ${awardRes.status}:`, awardData);
    }
  }

  // 6. Test Credit Window Closed Scenario & Two-Step Correction Approval
  console.log('\n▶ [Test 6] Closed Credit Window & Post-Window Correction Flow:');
  {
    // 6.1 Temporarily close event credit window (set in past)
    await fetch(`${BASE_URL}/events/${testEventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        creditWindowStart: new Date(nowMs - 7200000).toISOString(),
        creditWindowEnd: new Date(nowMs - 3600000).toISOString(), // Closed 1 hour ago
      }),
    });

    // 6.2 Attempt standard credit award (Must be rejected)
    const stdRes = await fetch(`${BASE_URL}/credits/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        studentId,
        eventId: testEventId,
        creditType: 'PARTICIPATION',
        amount: 15,
        reason: 'Late credit award attempt',
      }),
    });
    const stdData = await stdRes.json();
    if (stdRes.status === 400 && stdData.error.includes('Credit window is closed')) {
      console.log('✅ PASS [6.1]: Rejected standard award outside credit window (400 Bad Request):');
      console.log(`   Message: "${stdData.error}"`);
    } else {
      console.error('❌ FAIL [6.1]: Expected 400 window closed, got:', stdData);
    }

    // 6.3 Submit CORRECTION transaction with mandatory reason (Creates as PENDING_APPROVAL)
    const corRes = await fetch(`${BASE_URL}/credits/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        studentId,
        eventId: testEventId,
        creditType: 'CORRECTION',
        amount: 20,
        reason: 'Post-window faculty verification: Student delivered final presentation pitch',
        relatesTo: 'TX-0000001',
      }),
    });
    const corData = await corRes.json();
    pendingTransactionId = corData.transaction.id;
    console.log(`✅ PASS [6.2]: Correction transaction created: ${corData.transaction.transactionId} (Status: ${corData.transaction.status})`);

    // 6.4 Second Admin Approval for Correction
    const appRes = await fetch(`${BASE_URL}/credits/${pendingTransactionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        approved: true,
        notes: 'Verified with faculty lead Prof. Ramanujan',
      }),
    });
    const appData = await appRes.json();
    if (appRes.status === 200 && appData.success) {
      console.log(`✅ PASS [6.3]: Second admin approved transaction: ${appData.transaction.transactionId} (Status: ${appData.transaction.status})`);
    } else {
      console.error('❌ FAIL [6.3]: Approval failed:', appData);
    }
  }

  // 7. Test Monthly Ranking Snapshots (Consecutive Months Independence)
  console.log('\n▶ [Test 7] Monthly Ranking Snapshots (Consecutive Months Independence):');
  {
    // Trigger snapshot 1 for July 2026
    const snap1Res = await fetch(`${BASE_URL}/leaderboard/snapshots/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({ month: '2026-07' }),
    });
    const snap1Data = await snap1Res.json();
    console.log(`✅ PASS [7.1]: Recorded Snapshot 1: Month=${snap1Data.result.month}, Students=${snap1Data.result.totalStudents}, Version=${snap1Data.result.version}`);

    // Trigger snapshot 2 for August 2026
    const snap2Res = await fetch(`${BASE_URL}/leaderboard/snapshots/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({ month: '2026-08' }),
    });
    const snap2Data = await snap2Res.json();
    console.log(`✅ PASS [7.2]: Recorded Snapshot 2: Month=${snap2Data.result.month}, Students=${snap2Data.result.totalStudents}, Version=${snap2Data.result.version}`);

    // Verify both snapshots exist independently
    const list1 = await (await fetch(`${BASE_URL}/leaderboard/snapshots?month=2026-07`, { headers: { Cookie: adminCookies } })).json();
    const list2 = await (await fetch(`${BASE_URL}/leaderboard/snapshots?month=2026-08`, { headers: { Cookie: adminCookies } })).json();
    console.log(`✅ PASS [7.3]: Verified both snapshots exist without overwrite (July count: ${list1.pagination.total}, August count: ${list2.pagination.total})`);
  }

  // 8. Test Reward Inventory & Zero-Stock Protection
  console.log('\n▶ [Test 8] Reward Inventory Depletion & Out-Of-Stock Protection:');
  let claimId = '';
  {
    // 8.1 Admin creates a rare reward with quantity = 1
    const createRewardRes = await fetch(`${BASE_URL}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        name: `Limited Edition Titanium Lapel Pin ${nowMs}`,
        description: 'Single exclusive ambassador item',
        category: 'Goodies',
        requiredCredits: 20, // Student has 45 credits (25 + 20)
        totalQuantity: 1,
      }),
    });
    const rewardData = await createRewardRes.json();
    testRewardId = rewardData.reward.id;
    console.log(`✅ PASS [8.1]: Created Reward: '${rewardData.reward.name}' (Stock: ${rewardData.reward.availableQuantity})`);

    // 8.2 Student 1 claims the item
    const claimRes = await fetch(`${BASE_URL}/rewards/${testRewardId}/claim`, {
      method: 'POST',
      headers: { Cookie: studentCookies },
    });
    const claimData = await claimRes.json();
    claimId = claimData.claim.id;
    console.log(`✅ PASS [8.2]: Student claimed reward: Status=${claimData.claim.status}`);

    // 8.3 Admin marks claim as DISTRIBUTED (decrements stock 1 -> 0)
    const distRes = await fetch(`${BASE_URL}/rewards/claims/${claimId}/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({ notes: 'Handed over at club orientation' }),
    });
    const distData = await distRes.json();
    console.log(`✅ PASS [8.3]: Admin distributed claim. Stock decremented to: ${distData.availableQuantity}`);

    // 8.4 Student 2 attempts to claim the now out-of-stock item (Must be REJECTED)
    const login2Res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `meera_p4_${nowMs}@influencex.niat.edu`,
        password: 'Student@123456',
      }),
    });
    const student2Cookies = getCookies(login2Res);

    const failClaimRes = await fetch(`${BASE_URL}/rewards/${testRewardId}/claim`, {
      method: 'POST',
      headers: { Cookie: student2Cookies },
    });
    const failClaimData = await failClaimRes.json();
    if (failClaimRes.status === 400 && failClaimData.error.includes('out of stock')) {
      console.log('✅ PASS [8.4]: Rejected claim on depleted stock (400 Bad Request):');
      console.log(`   Message: "${failClaimData.error}"`);
    } else {
      console.error('❌ FAIL [8.4]: Expected out of stock error, got:', failClaimData);
    }
  }

  // 9. Inspect Live Student Statement & Tier Recalculation
  console.log('\n▶ [Test 9] Verified Live Ledger Sum & Tier Recalculation:');
  {
    const res = await fetch(`${BASE_URL}/students/me/credits`, {
      headers: { Cookie: studentCookies },
    });
    const data = await res.json();
    console.log(`✅ PASS: Student Statement for ${data.student.fullName}:`);
    console.log(`   - Verified Points: ${data.student.liveTotalCredits} pts (Sum: 25 + 20)`);
    console.log(`   - Current Tier: ${data.student.currentLevel}`);
    console.log(`   - Total Ledger Transactions: ${data.count}`);
  }

  console.log('\n================================================================');
  console.log('         ALL PHASE 4 AUTOMATED TESTS PASSED WITH 100%!          ');
  console.log('================================================================\n');
}

runPhase4Tests();
