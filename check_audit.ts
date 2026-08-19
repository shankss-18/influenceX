import dns from 'dns';
import mongoose from 'mongoose';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import { env } from './server/src/config/env';
import { AuditLog } from './server/src/models/AuditLog';

async function checkAuditLogs() {
  await mongoose.connect(env.MONGODB_URI);
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(10);

  console.log('========================================================');
  console.log('            LATEST AUDIT LOG ENTRIES (ATLAS)           ');
  console.log('========================================================');
  logs.forEach((log, index) => {
    console.log(
      `[${index + 1}] Action: ${log.action.padEnd(22)} | Role: ${log.actorRole.padEnd(10)} | Target: ${log.targetType || 'N/A'} | Reason: ${log.reason || 'N/A'}`
    );
  });
  console.log('========================================================\n');
  process.exit(0);
}

checkAuditLogs();
