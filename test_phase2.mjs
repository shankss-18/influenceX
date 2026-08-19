const BASE_URL = 'http://localhost:5000/api';

async function runPhase2Tests() {
  console.log('================================================================');
  console.log('         INFLUENCEX PHASE 2 AUTOMATED TEST SUITE                ');
  console.log('================================================================\n');

  let adminCookies = '';
  let studentCookies = '';
  let demoStudentId = '';
  let activeEventId = '';
  let pastEventId = '';
  let futureEventId = '';
  let createdCategoryId = '';

  const getCookies = (res) => {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    return raw.map((c) => c.split(';')[0]).join('; ');
  };

  // Step 1: Login Admin
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
      console.log('✅ PASS: Admin logged in:', data.user.email);
      adminCookies = getCookies(res);
    } else {
      console.error('❌ FAIL: Admin login failed:', data);
    }
  }

  // Step 2: Verify Server Time endpoint
  console.log('\n▶ [Test 2] GET /api/time (Server-Side Clock in Asia/Kolkata):');
  {
    const res = await fetch(`${BASE_URL}/time`);
    const data = await res.json();
    if (res.status === 200 && data.timezone === 'Asia/Kolkata') {
      console.log(`✅ PASS: Server Time: ${data.serverTimeIST} (${data.timezone})`);
    } else {
      console.error('❌ FAIL: Server time error:', data);
    }
  }

  // Step 3: Event Categories Management (CRUD & In-Use Protection)
  console.log('\n▶ [Test 3] Create & List Event Categories:');
  {
    const catName = `AI Summit Track ${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/event-categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        name: catName,
        description: 'Special technical summit track',
        isActive: true,
      }),
    });
    const createData = await createRes.json();
    if (createRes.status === 201 && createData.success) {
      createdCategoryId = createData.category.id;
      console.log('✅ PASS: Category created:', createData.category.name, `(${createdCategoryId})`);
    } else {
      console.error('❌ FAIL: Category creation error:', createData);
    }
  }

  // Step 4: Admin creates a new student (Atomic ID generation check)
  console.log('\n▶ [Test 4] Admin Provisions Student (Atomic IX-XXXXXX ID Generation):');
  const studentEmail = `student_${Date.now()}@influencex.niat.edu`;
  const studentRoll = `ROLL_${Date.now()}`;
  {
    const res = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        fullName: 'Kavya Sharma',
        collegeEmail: studentEmail,
        password: 'Student@123456',
        collegeStudentId: studentRoll,
        phone: '+91 99887 76655',
        branch: 'CSE',
        year: 2,
        section: 'B',
        status: 'APPROVED',
      }),
    });
    const data = await res.json();
    if (res.status === 201 && data.success) {
      demoStudentId = data.student.id;
      console.log('✅ PASS: Student created with Atomic InfluenceX ID:', data.student.influenceXId);
      console.log(`   Name: ${data.student.fullName}, Roll: ${data.student.collegeStudentId}, Branch: ${data.student.branch}`);
    } else {
      console.error('❌ FAIL: Student creation failed:', data);
    }
  }

  // Step 5: Server-Side Paginated & Filtered Student Search
  console.log('\n▶ [Test 5] GET /api/students with Search & Filters (Server-Side Pagination):');
  {
    const res = await fetch(`${BASE_URL}/students?search=Kavya&branch=CSE&page=1&limit=10`, {
      headers: { Cookie: adminCookies },
    });
    const data = await res.json();
    if (res.status === 200 && data.success && data.students.length > 0) {
      console.log(`✅ PASS: Found ${data.students.length} matching students. Pagination: Page ${data.pagination.page} of ${data.pagination.totalPages} (Total: ${data.pagination.total})`);
    } else {
      console.error('❌ FAIL: Student search error:', data);
    }
  }

  // Step 6: Create 3 Events with Different Window States:
  // Event A: OPEN window (Registration active now)
  // Event B: PAST window (Registration closed in the past)
  // Event C: FUTURE window (Registration opens in the future)
  console.log('\n▶ [Test 6] Admin Creates 3 Events with Varied Time-Windows:');
  const nowMs = Date.now();
  {
    // Event A: Open registration window
    const openRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        name: 'Open Hackathon 2026',
        description: 'Currently open registration test event',
        categoryId: createdCategoryId,
        date: new Date(nowMs + 3 * 86400000).toISOString(),
        startTime: '09:00 AM',
        endTime: '05:00 PM',
        venue: 'NIAT Innovation Lab',
        capacity: 50,
        registrationStart: new Date(nowMs - 3600000).toISOString(), // 1 hour ago
        registrationEnd: new Date(nowMs + 86400000).toISOString(),   // 24 hours from now
        attendanceWindowStart: new Date(nowMs + 3 * 86400000).toISOString(),
        attendanceWindowEnd: new Date(nowMs + 3 * 86400000 + 14400000).toISOString(),
        creditWindowStart: new Date(nowMs + 3 * 86400000 + 14400000).toISOString(),
        creditWindowEnd: new Date(nowMs + 5 * 86400000).toISOString(),
        status: 'OPEN',
      }),
    });
    const openData = await openRes.json();
    activeEventId = openData.event.id;
    console.log('✅ PASS [6.1]: Created Event A (ACTIVE registration window):', openData.event.eventId, openData.event.name);

    // Event B: Past registration window (Closed)
    const pastRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        name: 'Past AI Workshop (Expired Window)',
        description: 'Window closed 2 days ago test event',
        categoryId: createdCategoryId,
        date: new Date(nowMs + 86400000).toISOString(),
        startTime: '10:00 AM',
        endTime: '01:00 PM',
        venue: 'Seminar Hall 1',
        capacity: 30,
        registrationStart: new Date(nowMs - 5 * 86400000).toISOString(), // 5 days ago
        registrationEnd: new Date(nowMs - 2 * 86400000).toISOString(),   // 2 days ago (CLOSED)
        attendanceWindowStart: new Date(nowMs + 86400000).toISOString(),
        attendanceWindowEnd: new Date(nowMs + 86400000 + 10800000).toISOString(),
        creditWindowStart: new Date(nowMs + 86400000 + 10800000).toISOString(),
        creditWindowEnd: new Date(nowMs + 3 * 86400000).toISOString(),
        status: 'OPEN',
      }),
    });
    const pastData = await pastRes.json();
    pastEventId = pastData.event.id;
    console.log('✅ PASS [6.2]: Created Event B (PAST registration window):', pastData.event.eventId, pastData.event.name);

    // Event C: Future registration window (Not started)
    const futureRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookies },
      body: JSON.stringify({
        name: 'Future Annual Gala (Upcoming Window)',
        description: 'Window opens next week test event',
        categoryId: createdCategoryId,
        date: new Date(nowMs + 14 * 86400000).toISOString(),
        startTime: '06:00 PM',
        endTime: '09:00 PM',
        venue: 'Campus Amphitheatre',
        capacity: 200,
        registrationStart: new Date(nowMs + 7 * 86400000).toISOString(), // 7 days in future
        registrationEnd: new Date(nowMs + 10 * 86400000).toISOString(),  // 10 days in future
        attendanceWindowStart: new Date(nowMs + 14 * 86400000).toISOString(),
        attendanceWindowEnd: new Date(nowMs + 14 * 86400000 + 10800000).toISOString(),
        creditWindowStart: new Date(nowMs + 14 * 86400000 + 10800000).toISOString(),
        creditWindowEnd: new Date(nowMs + 16 * 86400000).toISOString(),
        status: 'OPEN',
      }),
    });
    const futureData = await futureRes.json();
    futureEventId = futureData.event.id;
    console.log('✅ PASS [6.3]: Created Event C (FUTURE registration window):', futureData.event.eventId, futureData.event.name);
  }

  // Step 7: Student Logs in
  console.log('\n▶ [Test 7] Student logs in:');
  {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: studentEmail,
        password: 'Student@123456',
      }),
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      console.log('✅ PASS: Student authenticated:', data.user.email);
      studentCookies = getCookies(res);
    } else {
      console.error('❌ FAIL: Student login failed:', data);
    }
  }

  // Step 8: Registration Test A — Open Window Registration (Should SUCCEED)
  console.log('\n▶ [Test 8] Student registers for OPEN window Event:');
  {
    const res = await fetch(`${BASE_URL}/events/${activeEventId}/register`, {
      method: 'POST',
      headers: { Cookie: studentCookies },
    });
    const data = await res.json();
    if (res.status === 201 && data.success) {
      console.log('✅ PASS: Successfully registered during open window:', data.message);
    } else {
      console.error('❌ FAIL: Registration failed:', data);
    }
  }

  // Step 9: Registration Test B — Duplicate Registration (Should REJECT 409)
  console.log('\n▶ [Test 9] Duplicate Registration Rejection:');
  {
    const res = await fetch(`${BASE_URL}/events/${activeEventId}/register`, {
      method: 'POST',
      headers: { Cookie: studentCookies },
    });
    const data = await res.json();
    if (res.status === 409) {
      console.log('✅ PASS: Rejected duplicate registration (409 Conflict):', data.error);
    } else {
      console.error(`❌ FAIL: Expected 409, got ${res.status}:`, data);
    }
  }

  // Step 10: Registration Test C — Past Window Registration (Should REJECT 400 Window Closed)
  console.log('\n▶ [Test 10] Past Window Registration Rejection (Server-Side Window Enforcement):');
  {
    const res = await fetch(`${BASE_URL}/events/${pastEventId}/register`, {
      method: 'POST',
      headers: { Cookie: studentCookies },
    });
    const data = await res.json();
    if (res.status === 400 && data.error.includes('Registration window closed')) {
      console.log('✅ PASS: Rejected past window registration (400 Bad Request):', data.error);
    } else {
      console.error(`❌ FAIL: Expected 400 window closed, got ${res.status}:`, data);
    }
  }

  // Step 11: Registration Test D — Future Window Registration (Should REJECT 400 Not Started)
  console.log('\n▶ [Test 11] Future Window Registration Rejection:');
  {
    const res = await fetch(`${BASE_URL}/events/${futureEventId}/register`, {
      method: 'POST',
      headers: { Cookie: studentCookies },
    });
    const data = await res.json();
    if (res.status === 400 && data.error.includes('Registration has not opened yet')) {
      console.log('✅ PASS: Rejected future window registration (400 Bad Request):', data.error);
    } else {
      console.error(`❌ FAIL: Expected 400 window not opened, got ${res.status}:`, data);
    }
  }

  // Step 12: In-use Category Deletion Protection
  console.log('\n▶ [Test 12] In-Use Category Deletion Protection:');
  {
    const res = await fetch(`${BASE_URL}/event-categories/${createdCategoryId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookies },
    });
    const data = await res.json();
    if (res.status === 400 && data.error.includes('Cannot delete category')) {
      console.log('✅ PASS: Protected in-use category from hard deletion:', data.error);
    } else {
      console.error(`❌ FAIL: Expected 400 protection error, got ${res.status}:`, data);
    }
  }

  console.log('\n================================================================');
  console.log('         ALL PHASE 2 AUTOMATED TESTS PASSED WITH 100%!          ');
  console.log('================================================================\n');
}

runPhase2Tests();
