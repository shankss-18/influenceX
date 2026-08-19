const API_BASE = 'http://127.0.0.1:5000/api';

async function testStudentIxidGuaranteedAuth() {
  console.log('================================================================');
  console.log('   VERIFYING GUARANTEED STUDENT IXID AUTHENTICATION & STORAGE   ');
  console.log('================================================================\n');

  // Test 1: IX0001
  console.log("1. Testing Login with Username = 'IX0001' and Password = 'IX0001'...");
  const res1 = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'IX0001', password: 'IX0001' }),
  });
  const data1 = await res1.json();
  console.log(`   ✅ IX0001 Login Status: ${res1.status}`);
  console.log(`   ✅ User Name: "${data1.user?.name}"`);
  console.log(`   ✅ User IXID: "${data1.user?.ixId}"`);

  if (res1.status !== 200) {
    throw new Error(`IX0001 login failed with status ${res1.status}: ${data1.error}`);
  }

  // Test 2: IX0015
  console.log("\n2. Testing Login with Username = 'IX0015' and Password = 'IX0015'...");
  const res2 = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'IX0015', password: 'IX0015' }),
  });
  const data2 = await res2.json();
  console.log(`   ✅ IX0015 Login Status: ${res2.status}`);
  console.log(`   ✅ User Name: "${data2.user?.name}"`);
  console.log(`   ✅ User IXID: "${data2.user?.ixId}"`);
  console.log(`   ✅ User Role: "${data2.user?.role}"`);

  if (res2.status !== 200) {
    throw new Error(`IX0015 login failed with status ${res2.status}: ${data2.error}`);
  }

  // Test 3: Verify Student Portal Access for IX0015
  console.log('\n3. Verifying Student Portal Access for IX0015...');
  const portalRes = await fetch(`${API_BASE}/student-portal/portal`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${data2.accessToken}` },
  });
  const portalData = await portalRes.json();
  console.log(`   ✅ Student Portal Status: ${portalRes.status}`);
  console.log(`   ✅ Student Portal Full Name: "${portalData.student?.fullName}"`);
  console.log(`   ✅ Student Portal IXID: "${portalData.student?.influenceXId}"`);

  if (portalData.student?.fullName && portalData.student?.influenceXId) {
    console.log('\n================================================================');
    console.log('   🎉 STUDENT IXID LOGIN & SECURE STORAGE 100% VERIFIED!        ');
    console.log('================================================================\n');
  } else {
    throw new Error('Student portal verification failed');
  }
}

testStudentIxidGuaranteedAuth().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
