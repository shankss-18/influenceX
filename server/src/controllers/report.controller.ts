import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { Student } from '../models/Student';
import { Event } from '../models/Event';
import { Attendance } from '../models/Attendance';
import { CreditTransaction } from '../models/CreditTransaction';
import { RewardClaim } from '../models/RewardClaim';
import { MonthlyRankingSnapshot } from '../models/MonthlyRankingSnapshot';
import { dayjs, DEFAULT_TIMEZONE, formatToIST } from '../utils/timezone';

export async function getMonthlyReportData(req: Request, res: Response): Promise<void> {
  try {
    const month = (req.query.month as string) || dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM');
    const startOfMonth = dayjs.tz(month, 'YYYY-MM', DEFAULT_TIMEZONE).startOf('month').toDate();
    const endOfMonth = dayjs.tz(month, 'YYYY-MM', DEFAULT_TIMEZONE).endOf('month').toDate();

    const [events, creditTxs, attendanceList, claims, snapshots, totalStudents] = await Promise.all([
      Event.find({ date: { $gte: startOfMonth, $lte: endOfMonth } })
        .populate('categoryId', 'name')
        .lean(),
      CreditTransaction.find({
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        status: 'APPROVED',
      })
        .populate('studentId', 'fullName influenceXId branch')
        .populate('awardedBy', 'name')
        .lean(),
      Attendance.find({ markedAt: { $gte: startOfMonth, $lte: endOfMonth } })
        .populate('studentId', 'fullName influenceXId')
        .populate('eventId', 'name eventId')
        .lean(),
      RewardClaim.find({ requestedAt: { $gte: startOfMonth, $lte: endOfMonth } })
        .populate('studentId', 'fullName influenceXId')
        .populate('rewardId', 'name requiredCredits')
        .lean(),
      MonthlyRankingSnapshot.find({ month })
        .populate('studentId', 'fullName influenceXId branch currentLevel')
        .sort({ rank: 1 })
        .limit(10)
        .lean(),
      Student.countDocuments({ status: { $ne: 'DISABLED' } }),
    ]);

    const totalCreditsDistributed = creditTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const presentCount = attendanceList.filter((a) => a.status === 'PRESENT').length;
    const attendanceRate = attendanceList.length > 0 ? ((presentCount / attendanceList.length) * 100).toFixed(1) : '100.0';

    res.status(200).json({
      success: true,
      month,
      summary: {
        totalEvents: events.length,
        totalCreditsDistributed,
        totalAttendanceMarked: attendanceList.length,
        presentCount,
        attendanceRate: `${attendanceRate}%`,
        rewardsClaimed: claims.length,
        totalStudents,
      },
      topRankings: snapshots.map((snap) => ({
        rank: snap.rank,
        student: snap.studentId,
        creditsThisMonth: snap.creditsThisMonth,
        totalCreditsAtSnapshot: snap.totalCreditsAtSnapshot,
      })),
      eventsCount: events.length,
      creditTransactionsCount: creditTxs.length,
    });
  } catch (error) {
    console.error('[Report] Error generating monthly report:', error);
    res.status(500).json({ error: 'Failed to generate monthly report data.' });
  }
}

export async function exportMonthlyReportExcel(req: Request, res: Response): Promise<void> {
  try {
    const month = (req.query.month as string) || dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM');
    const startOfMonth = dayjs.tz(month, 'YYYY-MM', DEFAULT_TIMEZONE).startOf('month').toDate();
    const endOfMonth = dayjs.tz(month, 'YYYY-MM', DEFAULT_TIMEZONE).endOf('month').toDate();

    const [allStudents, events, creditTxs, attendanceList, claims, snapshots] = await Promise.all([
      Student.find({ status: { $ne: 'DISABLED' } }).sort({ cachedTotalCredits: -1 }).lean(),
      Event.find({ date: { $gte: startOfMonth, $lte: endOfMonth } }).populate('categoryId', 'name').lean(),
      CreditTransaction.find({ createdAt: { $gte: startOfMonth, $lte: endOfMonth } })
        .populate('studentId', 'fullName influenceXId collegeStudentId branch')
        .populate('eventId', 'name eventId')
        .populate('awardedBy', 'name')
        .populate('approvedBy', 'name')
        .sort({ createdAt: -1 })
        .lean(),
      Attendance.find({ markedAt: { $gte: startOfMonth, $lte: endOfMonth } })
        .populate('studentId', 'fullName influenceXId collegeStudentId')
        .populate('eventId', 'name eventId')
        .populate('markedBy', 'name')
        .lean(),
      RewardClaim.find({ requestedAt: { $gte: startOfMonth, $lte: endOfMonth } })
        .populate('studentId', 'fullName influenceXId')
        .populate('rewardId', 'name requiredCredits')
        .populate('distributedBy', 'name')
        .lean(),
      MonthlyRankingSnapshot.find({ month })
        .populate('studentId', 'fullName influenceXId branch currentLevel')
        .sort({ rank: 1 })
        .lean(),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'InfluenceX Platform (NIAT Influencers Club)';
    workbook.created = new Date();

    const applyStandardStyle = (worksheet: ExcelJS.Worksheet) => {
      worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      worksheet.getRow(1).height = 28;
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columns.length },
      };
    };

    // SHEET 1: Summary & KPIs
    const wsSummary = workbook.addWorksheet('1. Summary & KPIs');
    wsSummary.columns = [
      { header: 'Metric KPI', key: 'metric', width: 35 },
      { header: 'Value', key: 'value', width: 25 },
      { header: 'Notes & Context', key: 'notes', width: 45 },
    ];
    applyStandardStyle(wsSummary);

    const totalCredits = creditTxs.filter((t) => t.status === 'APPROVED').reduce((sum, t) => sum + t.amount, 0);
    const presentCount = attendanceList.filter((a) => a.status === 'PRESENT').length;

    wsSummary.addRows([
      { metric: 'Report Reporting Month', value: month, notes: 'Configured report window (IST)' },
      { metric: 'Total Active Students', value: allStudents.length, notes: 'Registered club members' },
      { metric: 'Total Events Organized', value: events.length, notes: `Events held in ${month}` },
      { metric: 'Total Credits Distributed', value: `${totalCredits} pts`, notes: 'Approved ledger transactions' },
      { metric: 'Total Attendance Logs Marked', value: attendanceList.length, notes: 'Physical presence records' },
      { metric: 'Present Attendance Count', value: presentCount, notes: 'Verified attendees' },
      { metric: 'Attendance Rate', value: attendanceList.length > 0 ? `${((presentCount / attendanceList.length) * 100).toFixed(1)}%` : '100%', notes: 'Present / Marked' },
      { metric: 'Rewards / Goodies Claims', value: claims.length, notes: 'Redemptions in this month' },
    ]);

    // SHEET 2: Students Directory
    const wsStudents = workbook.addWorksheet('2. Students Directory');
    wsStudents.columns = [
      { header: 'InfluenceX ID', key: 'ixId', width: 16 },
      { header: 'Student Name', key: 'name', width: 25 },
      { header: 'Roll No', key: 'roll', width: 16 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Branch', key: 'branch', width: 12 },
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Current Tier', key: 'tier', width: 14 },
      { header: 'Verified Total Credits', key: 'credits', width: 22 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    applyStandardStyle(wsStudents);
    allStudents.forEach((s) => {
      wsStudents.addRow({
        ixId: s.influenceXId,
        name: s.fullName,
        roll: s.collegeStudentId,
        email: s.collegeEmail,
        branch: s.branch,
        year: s.year,
        section: s.section,
        tier: s.currentLevel,
        credits: s.cachedTotalCredits,
        status: s.status,
      });
    });

    // SHEET 3: Credit Ledger
    const wsLedger = workbook.addWorksheet('3. Credit Ledger');
    wsLedger.columns = [
      { header: 'Transaction ID', key: 'txId', width: 18 },
      { header: 'InfluenceX ID', key: 'ixId', width: 16 },
      { header: 'Student Name', key: 'studentName', width: 25 },
      { header: 'Rule / Activity Type', key: 'type', width: 22 },
      { header: 'Amount (Points)', key: 'amount', width: 16 },
      { header: 'Event Reference', key: 'event', width: 30 },
      { header: 'Reason & Justification', key: 'reason', width: 40 },
      { header: 'Awarded By', key: 'awardedBy', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Timestamp (IST)', key: 'date', width: 22 },
    ];
    applyStandardStyle(wsLedger);
    creditTxs.forEach((tx) => {
      const st = tx.studentId as any;
      const ev = tx.eventId as any;
      const aw = tx.awardedBy as any;
      wsLedger.addRow({
        txId: tx.transactionId,
        ixId: st?.influenceXId || '—',
        studentName: st?.fullName || '—',
        type: tx.creditType,
        amount: tx.amount,
        event: ev?.name || 'General Platform',
        reason: tx.reason,
        awardedBy: aw?.name || 'Admin',
        status: tx.status,
        date: formatToIST(tx.createdAt),
      });
    });

    // SHEET 4: Attendance Roster
    const wsAtt = workbook.addWorksheet('4. Attendance Roster');
    wsAtt.columns = [
      { header: 'Event ID', key: 'eventId', width: 16 },
      { header: 'Event Name', key: 'eventName', width: 30 },
      { header: 'Student InfluenceX ID', key: 'ixId', width: 18 },
      { header: 'Student Name', key: 'name', width: 25 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Marked By', key: 'markedBy', width: 20 },
      { header: 'Timestamp (IST)', key: 'date', width: 22 },
    ];
    applyStandardStyle(wsAtt);
    attendanceList.forEach((att) => {
      const st = att.studentId as any;
      const ev = att.eventId as any;
      const mb = att.markedBy as any;
      wsAtt.addRow({
        eventId: ev?.eventId || '—',
        eventName: ev?.name || '—',
        ixId: st?.influenceXId || '—',
        name: st?.fullName || '—',
        status: att.status,
        markedBy: mb?.name || 'Admin',
        date: formatToIST(att.markedAt),
      });
    });

    // SHEET 5: Events Catalog
    const wsEvents = workbook.addWorksheet('5. Events Catalog');
    wsEvents.columns = [
      { header: 'Event ID', key: 'eventId', width: 16 },
      { header: 'Event Name', key: 'name', width: 35 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Date (IST)', key: 'date', width: 15 },
      { header: 'Timing', key: 'timing', width: 20 },
      { header: 'Venue', key: 'venue', width: 25 },
      { header: 'Capacity', key: 'capacity', width: 12 },
      { header: 'Status', key: 'status', width: 14 },
    ];
    applyStandardStyle(wsEvents);
    events.forEach((ev) => {
      const cat = ev.categoryId as any;
      wsEvents.addRow({
        eventId: ev.eventId,
        name: ev.name,
        category: cat?.name || 'General',
        date: formatToIST(ev.date),
        timing: `${ev.startTime} - ${ev.endTime}`,
        venue: ev.venue,
        capacity: ev.capacity,
        status: ev.status,
      });
    });

    // SHEET 6: Rewards & Claims
    const wsClaims = workbook.addWorksheet('6. Rewards & Claims');
    wsClaims.columns = [
      { header: 'Student IX ID', key: 'ixId', width: 16 },
      { header: 'Student Name', key: 'name', width: 25 },
      { header: 'Reward Item', key: 'reward', width: 30 },
      { header: 'Required Credits', key: 'credits', width: 18 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Distributed By', key: 'distBy', width: 20 },
      { header: 'Requested Date', key: 'date', width: 22 },
    ];
    applyStandardStyle(wsClaims);
    claims.forEach((c) => {
      const st = c.studentId as any;
      const rw = c.rewardId as any;
      const db = c.distributedBy as any;
      wsClaims.addRow({
        ixId: st?.influenceXId || '—',
        name: st?.fullName || '—',
        reward: rw?.name || '—',
        credits: rw?.requiredCredits || 0,
        status: c.status,
        distBy: db?.name || '—',
        date: formatToIST(c.requestedAt),
      });
    });

    // SHEET 7: Monthly Rankings
    const wsRankings = workbook.addWorksheet('7. Monthly Rankings');
    wsRankings.columns = [
      { header: 'Official Rank', key: 'rank', width: 14 },
      { header: 'InfluenceX ID', key: 'ixId', width: 16 },
      { header: 'Student Name', key: 'name', width: 25 },
      { header: 'Branch', key: 'branch', width: 14 },
      { header: 'Tier Level', key: 'tier', width: 16 },
      { header: 'Credits Earned This Month', key: 'monthCredits', width: 26 },
      { header: 'Total All-Time Credits', key: 'totalCredits', width: 24 },
    ];
    applyStandardStyle(wsRankings);
    snapshots.forEach((snap) => {
      const st = snap.studentId as any;
      wsRankings.addRow({
        rank: `#${snap.rank}`,
        ixId: st?.influenceXId || '—',
        name: st?.fullName || '—',
        branch: st?.branch || '—',
        tier: st?.currentLevel || '—',
        monthCredits: snap.creditsThisMonth,
        totalCredits: snap.totalCreditsAtSnapshot,
      });
    });

    const filename = `InfluenceX_Monthly_Report_${month}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[Report] Error generating Excel report:', error);
    res.status(500).json({ error: 'Failed to export monthly Excel report.' });
  }
}
