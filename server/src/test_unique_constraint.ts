import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './config/env';
import { Attendance } from './models/Attendance';
import { Event } from './models/Event';
import { Student } from './models/Student';
import { User } from './models/User';

dns.setServers(['8.8.8.8', '1.1.1.1']);

async function testUniqueConstraint() {
  await mongoose.connect(env.MONGODB_URI, { dbName: 'influencex' });
  console.log('Connected to MongoDB Atlas');

  const event = await Event.findOne();
  const student = await Student.findOne();
  const user = await User.findOne();

  if (!event || !student || !user) {
    console.error('Missing seed records');
    process.exit(1);
  }

  console.log(`Testing unique compound index on Attendance (eventId: ${event._id}, studentId: ${student._id})`);

  // Clean up any existing attendance record for this test pair
  await Attendance.deleteMany({ eventId: event._id, studentId: student._id });

  // 1. First Insert (Should Succeed)
  const firstDoc = await Attendance.create({
    eventId: event._id,
    studentId: student._id,
    status: 'PRESENT',
    markedBy: user._id,
    markedAt: new Date(),
  });
  console.log('✅ First record created successfully:', firstDoc._id.toString());

  // 2. Duplicate Insert (Must be rejected at MongoDB level)
  try {
    const duplicateDoc = new Attendance({
      eventId: event._id,
      studentId: student._id,
      status: 'ABSENT',
      markedBy: user._id,
      markedAt: new Date(),
    });
    await duplicateDoc.save();
    console.error('❌ FAIL: Duplicate insert should have thrown MongoDB E11000 error!');
  } catch (error: any) {
    if (error.code === 11000) {
      console.log('✅ PASS: DB-Level Unique Index Enforced!');
      console.log('   MongoDB Error Code:', error.code);
      console.log('   Error Name:', error.name);
      console.log('   Key Pattern:', JSON.stringify(error.keyPattern));
      console.log('   Duplicate Key Values:', JSON.stringify(error.keyValue));
    } else {
      console.error('Unexpected error:', error);
    }
  }

  await mongoose.disconnect();
}

testUniqueConstraint();
