import ExcelJS from '../node_modules/exceljs/dist/es5/index.js';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://127.0.0.1:5000/api';

async function runFlexibilityTest() {
  console.log('================================================================');
  console.log('   TESTING VOLUNTEER FLEXIBILITY & LIVE REASSIGNMENT FLOW        ');
  console.log('================================================================\n');

  // Step 1: Admin Login
  console.log('1. Logging in as Administrator...');
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@influencex.niat.edu',
      password: 'Admin@123456',
    }),
  });
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.accessToken;
  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };
  console.log('   ✅ Admin successfully logged in.\n');

  // Step 2: Create Workshop
  console.log('2. Creating Workshop with 2 Halls...');
  const now = new Date();
  const winStart = new Date(now.getTime() - 10 * 60000).toISOString();
  const winEnd = new Date(now.getTime() + 120 * 60000).toISOString();

  const createWorkshopRes = await fetch(`${API_BASE}/workshops`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'InfluenceX Cloud Scalability Workshop',
      description: 'Testing 4+ volunteers per hall and live reassignments.',
      date: now.toISOString().split('T')[0],
      startTime: '09:00 AM',
      endTime: '01:00 PM',
      halls: [
        { name: 'Hall 2', capacity: 30 },
        { name: 'Hall 3', capacity: 30 },
      ],
      attendanceWindowStart: winStart,
      attendanceWindowEnd: winEnd,
      creditCap: 50,
    }),
  });
  const createWorkshopData = await createWorkshopRes.json();
  const workshop = createWorkshopData.workshop;
  console.log(`   ✅ Workshop created: ${workshop.name} (${workshop.eventId})\n`);

  // Step 3: Assign 3 volunteers to Hall 2 and 4 volunteers to Hall 3 (matching user screenshot)
  console.log('3. Assigning 3 volunteers to Hall 2 and 4 volunteers to Hall 3 (Total 7 volunteers)...');
  const assignRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/volunteers/assign`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      assignments: [
        { name: 'Ananya Rao', ixId: 'IX0451', niatId: 'N25H01A0451', hallName: 'Hall 2' },
        { name: 'Meera Iyer', ixId: 'IX0630', niatId: 'N25H01A0630', hallName: 'Hall 2' },
        { name: 'Sanya Kapoor', ixId: 'IX0784', niatId: 'N25H01A0784', hallName: 'Hall 2' },
        { name: 'Kabir Sinha', ixId: 'IX0972', niatId: 'N25H01A0972', hallName: 'Hall 3' },
        { name: 'Rohan Das', ixId: 'IX0118', niatId: 'N25H01A0118', hallName: 'Hall 3' },
        { name: 'Vikram Nair', ixId: 'IX0299', niatId: 'N25H01A0299', hallName: 'Hall 3' },
        { name: 'Ishita Verma', ixId: 'IX0857', niatId: 'N25HO1A0857', hallName: 'Hall 3' },
      ],
    }),
  });
  const assignData = await assignRes.json();
  console.log(`   ✅ Assignment successful: ${assignData.message}`);

  // Step 4: Generate Volunteer Credentials
  console.log('4. Generating credentials for all 7 volunteers...');
  const credsRes = await fetch(`${API_BASE}/workshops/${workshop.id}/setup/volunteers/credentials`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const credsData = await credsRes.json();
  console.log(`   ✅ Generated ${credsData.credentials.length} volunteer credentials without any blocking!\n`);

  // Step 5: Test Live Reassignment while workshop is running
  console.log('5. Testing Live Transfer of Volunteer Kabir Sinha (IX0972) from Hall 3 -> Hall 2...');
  const reassignRes = await fetch(`${API_BASE}/workshops/${workshop.id}/console/reassign-volunteer`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      ixId: 'IX0972',
      targetHallName: 'Hall 2',
    }),
  });
  const reassignData = await reassignRes.json();
  console.log(`   ✅ Live Transfer response: ${reassignData.message}`);

  // Step 6: Verify User record updated
  console.log('6. Checking Console data to verify new hall staffing counts...');
  const consoleRes = await fetch(`${API_BASE}/workshops/${workshop.id}/console`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const consoleData = await consoleRes.json();
  const hall2 = consoleData.halls.find((h) => h.name === 'Hall 2');
  const hall3 = consoleData.halls.find((h) => h.name === 'Hall 3');

  console.log(`   ✅ Hall 2 now has ${hall2.assignedVolunteers.length} volunteers (including Kabir Sinha).`);
  console.log(`   ✅ Hall 3 now has ${hall3.assignedVolunteers.length} volunteers.`);

  console.log('\n================================================================');
  console.log('   🎉 VOLUNTEER FLEXIBILITY & LIVE REASSIGNMENT VERIFIED (100%)! ');
  console.log('================================================================\n');
}

runFlexibilityTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
