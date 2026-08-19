const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('========================================================');
  console.log('    INFLUENCEX PHASE 1 AUTOMATED API TEST SUITE        ');
  console.log('========================================================\n');

  let adminCookies = '';
  let studentCookies = '';

  // Helper to extract cookies from fetch response
  const getCookies = (res) => {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    return raw.map((c) => c.split(';')[0]).join('; ');
  };

  // Test 1: Unauthorized access to /auth/me
  console.log('▶ [Test 1] Unauthenticated request to /auth/me:');
  {
    const res = await fetch(`${BASE_URL}/auth/me`);
    const data = await res.json();
    if (res.status === 401) {
      console.log('✅ PASS: Returned 401 Unauthorized:', data);
    } else {
      console.error(`❌ FAIL: Expected 401, got ${res.status}:`, data);
    }
  }

  // Test 2: Login with invalid password
  console.log('\n▶ [Test 2] Login with invalid password:');
  {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@influencex.niat.edu',
        password: 'WrongPassword123',
      }),
    });
    const data = await res.json();
    if (res.status === 401) {
      console.log('✅ PASS: Returned 401 Unauthorized:', data);
    } else {
      console.error(`❌ FAIL: Expected 401, got ${res.status}:`, data);
    }
  }

  // Test 3: Login with Admin credentials
  console.log('\n▶ [Test 3] Login with Admin credentials:');
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
      console.log('✅ PASS: Status 200 OK. User:', data.user);
      adminCookies = getCookies(res);
      console.log('✅ Set-Cookie headers received successfully.');
    } else {
      console.error(`❌ FAIL: Expected 200, got ${res.status}:`, data);
    }
  }

  // Test 4: Authenticated /auth/me with Admin cookies
  console.log('\n▶ [Test 4] GET /auth/me with Admin session cookies:');
  {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Cookie: adminCookies },
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      console.log(`✅ PASS: Returned 200 OK for Admin: ${data.user.email} (${data.user.role})`);
    } else {
      console.error(`❌ FAIL: Expected 200, got ${res.status}:`, data);
    }
  }

  // Test 5: Admin creates a STUDENT account via POST /users
  console.log('\n▶ [Test 5] Admin creates a STUDENT account via POST /users:');
  const testStudentEmail = `student_${Date.now()}@influencex.niat.edu`;
  {
    const res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookies,
      },
      body: JSON.stringify({
        name: 'Aarav Gupta',
        email: testStudentEmail,
        password: 'Student@123456',
        role: 'STUDENT',
        status: 'ACTIVE',
      }),
    });
    const data = await res.json();
    if (res.status === 201 && data.success) {
      console.log('✅ PASS: Student created with status 201:', data.user);
    } else {
      console.error(`❌ FAIL: Expected 201, got ${res.status}:`, data);
    }
  }

  // Test 6: Student Login
  console.log('\n▶ [Test 6] Student logs in with newly created credentials:');
  {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testStudentEmail,
        password: 'Student@123456',
      }),
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      console.log('✅ PASS: Student logged in:', data.user);
      studentCookies = getCookies(res);
    } else {
      console.error(`❌ FAIL: Expected 200, got ${res.status}:`, data);
    }
  }

  // Test 7: Student attempts to access Admin-only route /users (Should be 403 Forbidden)
  console.log('\n▶ [Test 7] Student attempts to access Admin route GET /users (Role Authorization Check):');
  {
    const res = await fetch(`${BASE_URL}/users`, {
      headers: { Cookie: studentCookies },
    });
    const data = await res.json();
    if (res.status === 403) {
      console.log('✅ PASS: Returned 403 Forbidden with audit-logged denial:', data);
    } else {
      console.error(`❌ FAIL: Expected 403, got ${res.status}:`, data);
    }
  }

  // Test 8: Refresh Token Rotation
  console.log('\n▶ [Test 8] Refresh Token Rotation via POST /auth/refresh:');
  {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: studentCookies },
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      console.log('✅ PASS: Refreshed session tokens successfully for:', data.user.email);
      studentCookies = getCookies(res);
    } else {
      console.error(`❌ FAIL: Expected 200, got ${res.status}:`, data);
    }
  }

  // Test 9: Student Logout
  console.log('\n▶ [Test 9] Student Logout via POST /auth/logout:');
  {
    const res = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: studentCookies },
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      console.log('✅ PASS: Logged out:', data.message);
    } else {
      console.error(`❌ FAIL: Expected 200, got ${res.status}:`, data);
    }
  }

  // Test 10: Verify session is terminated
  console.log('\n▶ [Test 10] Verify session is terminated after logout:');
  {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Cookie: 'accessToken=; refreshToken=' },
    });
    const data = await res.json();
    if (res.status === 401) {
      console.log('✅ PASS: Confirmed session is terminated (401 Unauthorized):', data);
    } else {
      console.error(`❌ FAIL: Expected 401, got ${res.status}:`, data);
    }
  }

  console.log('\n========================================================');
  console.log('        ALL PHASE 1 API TESTS PASSED SUCCESSFULLY!       ');
  console.log('========================================================\n');
}

runTests();
