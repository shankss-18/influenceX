import dns from 'dns';
import mongoose from 'mongoose';

// Fix Node.js SRV lookup on Windows networks
dns.setServers(['8.8.8.8', '1.1.1.1']);
import { env } from './config/env';
import { User } from './models/User';
import { AuditLog } from './models/AuditLog';
import { EventCategory } from './models/EventCategory';
import { Student } from './models/Student';
import { Event } from './models/Event';
import { CreditRule, CreditRuleType } from './models/CreditRule';
import { LevelThreshold } from './models/LevelThreshold';
import { Reward } from './models/Reward';
import { hashPassword } from './utils/jwt';
import { generateNextInfluenceXId, generateNextEventId } from './utils/sequence';
import { getCurrentISTDate, dayjs, DEFAULT_TIMEZONE } from './utils/timezone';

const INITIAL_CATEGORIES = [
  { name: 'Workshop', description: 'Hands-on technical and soft-skill workshops.' },
  { name: 'Challenge', description: 'Weekly and monthly club problem challenges.' },
  { name: 'Competition', description: 'Hackathons, coding contests, and creative challenges.' },
  { name: 'Networking', description: 'Industry connection sessions and alumni meetups.' },
  { name: 'Volunteering', description: 'Community outreach and technical volunteer initiatives.' },
  { name: 'Campus Initiative', description: 'On-campus tech awareness and student-led clubs.' },
  { name: 'Community Activity', description: 'Interactive community forums and study groups.' },
  { name: 'Leadership', description: 'Executive leadership training and cohort mentorship.' },
  { name: 'Personal Branding', description: 'Resume clinics, LinkedIn workshops, and portfolio reviews.' },
  { name: 'Communication', description: 'Public speaking, pitch decks, and technical writing.' },
  { name: 'Special Event', description: 'Annual summit, keynote addresses, and club galas.' },
];

const INITIAL_CREDIT_RULES: Array<{
  type: CreditRuleType;
  name: string;
  defaultAmount: number;
  description: string;
  requiresSecondApproval: boolean;
}> = [
  { type: 'REGISTRATION', name: 'Event Registration Credit', defaultAmount: 10, description: 'Default points awarded upon verified registration or roster upload.', requiresSecondApproval: false },
  { type: 'ATTENDANCE', name: 'Event Physical Attendance', defaultAmount: 20, description: 'Verified presence at an authorized club event (+20 credits).', requiresSecondApproval: false },
  { type: 'PARTICIPATION', name: 'Active Workshop Interaction', defaultAmount: 15, description: 'Active engagement, Q&A, and live project work.', requiresSecondApproval: false },
  { type: 'INTERACTION', name: 'Live Variable Interaction Points', defaultAmount: 10, description: 'Variable interaction credits awarded during active workshop.', requiresSecondApproval: false },
  { type: 'WINNER', name: 'Competition 1st Place Winner', defaultAmount: 50, description: 'Top ranking champion in hackathon or competition.', requiresSecondApproval: false },
  { type: 'RUNNER_UP', name: 'Competition Runner Up', defaultAmount: 30, description: '2nd/3rd place podium in club competition.', requiresSecondApproval: false },
  { type: 'FINALIST', name: 'Competition Finalist', defaultAmount: 20, description: 'Shortlisted finalist in club project track.', requiresSecondApproval: false },
  { type: 'VOLUNTEER', name: 'Event Volunteer Contribution', defaultAmount: 25, description: 'Operations and logistical support during events.', requiresSecondApproval: false },
  { type: 'TEAM_MEMBER', name: 'Core Team Contribution', defaultAmount: 30, description: 'Semester core executive committee delivery.', requiresSecondApproval: false },
  { type: 'TEAM_LEAD', name: 'Initiative Team Lead', defaultAmount: 50, description: 'Leadership and management of club initiatives.', requiresSecondApproval: false },
  { type: 'COMMUNITY_CONTRIBUTION', name: 'Campus Community Contribution', defaultAmount: 20, description: 'Mentorship, code reviews, and study circles.', requiresSecondApproval: false },
  { type: 'SPECIAL_RECOGNITION', name: 'Faculty Special Recognition', defaultAmount: 40, description: 'Outstanding achievement commended by faculty.', requiresSecondApproval: false },
  { type: 'MANUAL_ADJUSTMENT', name: 'Administrative Manual Adjustment', defaultAmount: 10, description: 'Exceptional point adjustment by authorized staff.', requiresSecondApproval: true },
  { type: 'CORRECTION', name: 'Post-Window Mistake Correction', defaultAmount: 0, description: 'Correction referencing an earlier transaction.', requiresSecondApproval: true },
  { type: 'REVERSAL', name: 'Credit Transaction Reversal', defaultAmount: 0, description: 'Reversal of an erroneously awarded transaction.', requiresSecondApproval: true },
];

const INITIAL_LEVEL_THRESHOLDS = [
  { name: 'Explorer', minCredits: 0, order: 1, badgeColor: '#6B7280', icon: '🌱', goodieName: '🌱 Explorer Welcome Badge & Club Kit' },
  { name: 'Rising', minCredits: 100, order: 2, badgeColor: '#3B82F6', icon: '🚀', goodieName: '🚀 Rising Star Metal Lapel Pin' },
  { name: 'Creator', minCredits: 250, order: 3, badgeColor: '#10B981', icon: '🔥', goodieName: '🔥 Creator Club Thermal Bottle' },
  { name: 'Leader', minCredits: 500, order: 4, badgeColor: '#8B5CF6', icon: '💎', goodieName: '💎 Leader Executive Club Hoodie' },
  { name: 'Icon', minCredits: 1000, order: 5, badgeColor: '#F59E0B', icon: '👑', goodieName: '👑 Icon VIP Pass & Tech Conclave Kit' },
];

const INITIAL_REWARDS = [
  {
    name: 'NIAT Influencers Club Official Hoodie',
    description: 'Premium heavyweight cotton hoodie with custom embroidered InfluenceX crest.',
    category: 'Club Gear',
    requiredCredits: 300,
    totalQuantity: 25,
    availableQuantity: 25,
    status: 'ACTIVE',
  },
  {
    name: 'InfluenceX Pro Matte Metal Water Bottle',
    description: 'Double-walled insulated thermal water bottle with laser-etched club logo.',
    category: 'Goodies',
    requiredCredits: 150,
    totalQuantity: 50,
    availableQuantity: 50,
    status: 'ACTIVE',
  },
  {
    name: 'VIP Front-Row Access to Annual Tech Conclave',
    description: 'Reserved executive seating and speaker lounge networking pass.',
    category: 'Access Pass',
    requiredCredits: 500,
    totalQuantity: 10,
    availableQuantity: 10,
    status: 'ACTIVE',
  },
  {
    name: 'Club Ambassador Lapel Pin & Certificate',
    description: 'Official gold-finished lapel pin and faculty-signed certificate of engagement.',
    category: 'Certificates',
    requiredCredits: 100,
    totalQuantity: 100,
    availableQuantity: 100,
    status: 'ACTIVE',
  },
];

async function seed(): Promise<void> {
  console.log('[Seed] Connecting to MongoDB Atlas...');
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('[Seed] Database connected.');

    // 1. Seed Admin, Volunteer, and Student accounts
    const adminEmail = 'admin@influencex.niat.edu';
    const volEmail = 'volunteer@influencex.niat.edu';
    const stuEmail = 'student@influencex.niat.edu';

    // 1.1 Admin
    const adminPassHash = await hashPassword('Admin@123456');
    await User.findOneAndUpdate(
      { email: adminEmail },
      {
        name: 'System Administrator',
        email: adminEmail,
        passwordHash: adminPassHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      { upsert: true, new: true }
    );
    console.log('[Seed] Admin account ready: admin@influencex.niat.edu / Admin@123456');

    // 1.2 Volunteer
    const volPassHash = await hashPassword('Volunteer@123456');
    await User.findOneAndUpdate(
      { email: volEmail },
      {
        name: 'Pooja Volunteer',
        email: volEmail,
        passwordHash: volPassHash,
        role: 'VOLUNTEER',
        status: 'ACTIVE',
      },
      { upsert: true, new: true }
    );
    console.log('[Seed] Volunteer account ready: volunteer@influencex.niat.edu / Volunteer@123456');

    // 1.3 Student Demo Account
    const stuPassHash = await hashPassword('Student@123456');
    const stuUser = await User.findOneAndUpdate(
      { email: stuEmail },
      {
        name: 'Aditya Sharma',
        email: stuEmail,
        passwordHash: stuPassHash,
        role: 'STUDENT',
        status: 'ACTIVE',
      },
      { upsert: true, new: true }
    );

    let stuProfile = await Student.findOne({ userId: stuUser._id });
    if (!stuProfile) {
      const ixId = await generateNextInfluenceXId();
      stuProfile = await Student.create({
        userId: stuUser._id,
        influenceXId: ixId,
        collegeStudentId: '21CS042',
        fullName: 'Aditya Sharma',
        collegeEmail: stuEmail,
        branch: 'Computer Science & Engineering',
        year: 3,
        section: 'A',
        status: 'APPROVED',
        cachedTotalCredits: 45,
        currentLevel: 'Explorer',
        profileFields: {
          bio: 'AI enthusiast and full-stack developer.',
          linkedinUrl: 'https://linkedin.com/in/aditya-sharma',
          githubUrl: 'https://github.com/aditya-sharma',
        },
        joiningDate: getCurrentISTDate(),
        createdAt: getCurrentISTDate(),
        updatedAt: getCurrentISTDate(),
      });
      console.log(`[Seed] Student profile created for Aditya Sharma (${ixId}).`);
    } else {
      console.log(`[Seed] Student profile ready: ${stuProfile.fullName} (${stuProfile.influenceXId})`);
    }

    // 2. Seed Event Categories
    for (const cat of INITIAL_CATEGORIES) {
      const exists = await EventCategory.findOne({ name: cat.name });
      if (!exists) {
        await EventCategory.create({
          name: cat.name,
          description: cat.description,
          isActive: true,
          createdAt: getCurrentISTDate(),
          updatedAt: getCurrentISTDate(),
        });
      }
    }
    console.log('[Seed] Event categories verified.');

    // 3. Seed Credit Rules
    for (const rule of INITIAL_CREDIT_RULES) {
      await CreditRule.findOneAndUpdate(
        { type: rule.type },
        {
          type: rule.type,
          name: rule.name,
          description: rule.description,
          defaultAmount: rule.defaultAmount,
          requiresSecondApproval: rule.requiresSecondApproval,
          isActive: true,
        },
        { upsert: true, new: true }
      );
    }
    console.log('[Seed] Credit rules verified (15 standard rules).');

    // 4. Seed Level Thresholds
    for (const lvl of INITIAL_LEVEL_THRESHOLDS) {
      await LevelThreshold.findOneAndUpdate(
        { name: lvl.name },
        {
          name: lvl.name,
          minCredits: lvl.minCredits,
          order: lvl.order,
          badgeColor: lvl.badgeColor,
          icon: lvl.icon,
          goodieName: lvl.goodieName,
        },
        { upsert: true, new: true }
      );
    }
    console.log('[Seed] Level thresholds verified (Explorer to Icon).');

    // 5. Seed Rewards Catalog
    for (const rew of INITIAL_REWARDS) {
      const exists = await Reward.findOne({ name: rew.name });
      if (!exists) {
        await Reward.create({
          ...rew,
          status: 'ACTIVE',
        });
      }
    }
    console.log('[Seed] Rewards catalogue verified.');

    console.log('====================================================');
    console.log(' InfluenceX Phase 4 Database Seeding Complete!');
    console.log(' Credit Rules:     13 rules seeded');
    console.log(' Level Thresholds: 5 tiers (Explorer -> Icon)');
    console.log(' Rewards:          4 catalog items seeded');
    console.log(' Admin:            admin@influencex.niat.edu / Admin@123456');
    console.log(' Student Demo:     student.demo@influencex.niat.edu / Student@123456');
    console.log('====================================================');

    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
    process.exit(1);
  }
}

seed();
