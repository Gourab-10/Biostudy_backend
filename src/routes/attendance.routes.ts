// src/routes/attendance.routes.ts
// ─── Attendance Management Routes ───
// Admin endpoints: mark, get students, stats, report
// Student endpoints: view own attendance, summary

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ═══════════════════════════════════════════
// Student: Get My Attendance
// GET /api/attendance/my?month=2026-07
// ═══════════════════════════════════════════

router.get('/my', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const month = req.query.month as string | undefined; // "YYYY-MM"

    const where: any = { userId };

    if (month) {
      // Filter by month prefix: date starts with "YYYY-MM"
      where.date = {
        startsWith: month,
      };
    }

    const records = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        classNum: true,
        status: true,
        remarks: true,
        createdAt: true,
      },
    });

    res.json({ records });
  } catch (error: any) {
    console.error('[Attendance] Get my attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records.' });
  }
});

// ═══════════════════════════════════════════
// Student: Get My Attendance Summary
// GET /api/attendance/my/summary
// ═══════════════════════════════════════════

router.get('/my/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const records = await prisma.attendance.findMany({
      where: { userId },
      select: { status: true },
    });

    const totalDays = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const excused = records.filter(r => r.status === 'EXCUSED').length;
    const percentage = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;

    // Calculate current streak (consecutive PRESENT days from most recent)
    const sortedRecords = await prisma.attendance.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { status: true, date: true },
    });

    let streak = 0;
    for (const record of sortedRecords) {
      if (record.status === 'PRESENT') {
        streak++;
      } else {
        break;
      }
    }

    res.json({
      summary: {
        totalDays,
        present,
        absent,
        late,
        excused,
        percentage,
        streak,
      },
    });
  } catch (error: any) {
    console.error('[Attendance] Get summary error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary.' });
  }
});

// ═══════════════════════════════════════════
// Admin: Get Students for Attendance Marking
// GET /api/attendance/students?classNum=11&date=2026-07-15
// ═══════════════════════════════════════════

router.get('/students', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const classNum = parseInt(req.query.classNum as string) || 11;
    const date = req.query.date as string; // "YYYY-MM-DD"

    if (!date) {
      res.status(400).json({ error: 'date query parameter is required (YYYY-MM-DD).' });
      return;
    }

    // Get all students in the given class
    const students = await prisma.user.findMany({
      where: {
        role: 'student',
        selectedClass: classNum,
      },
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        avatarUrl: true,
      },
    });

    // Get existing attendance records for the given date
    const existingRecords = await prisma.attendance.findMany({
      where: {
        date,
        classNum,
      },
      select: {
        userId: true,
        status: true,
        remarks: true,
      },
    });

    // Create a map for quick lookup
    const attendanceMap = new Map(
      existingRecords.map(r => [r.userId, { status: r.status, remarks: r.remarks }])
    );

    // Merge students with their attendance status
    const studentsWithAttendance = students.map(student => ({
      ...student,
      status: attendanceMap.get(student.id)?.status || null,
      remarks: attendanceMap.get(student.id)?.remarks || null,
    }));

    res.json({ students: studentsWithAttendance, date, classNum });
  } catch (error: any) {
    console.error('[Attendance] Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students for attendance.' });
  }
});

// ═══════════════════════════════════════════
// Admin: Mark Attendance (Bulk)
// POST /api/attendance/mark
// Body: { classNum, date, records: [{ userId, status, remarks? }] }
// ═══════════════════════════════════════════

router.post('/mark', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { classNum, date, records } = req.body;
    const adminId = req.userId!;

    if (!classNum || !date || !records || !Array.isArray(records)) {
      res.status(400).json({
        error: 'classNum, date (YYYY-MM-DD), and records array are required.',
      });
      return;
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date must be in YYYY-MM-DD format.' });
      return;
    }

    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

    // Upsert each attendance record
    const results = await Promise.all(
      records.map(async (record: { userId: string; status: string; remarks?: string }) => {
        if (!record.userId || !validStatuses.includes(record.status)) {
          return { userId: record.userId, error: 'Invalid userId or status.' };
        }

        return prisma.attendance.upsert({
          where: {
            userId_date: {
              userId: record.userId,
              date,
            },
          },
          update: {
            status: record.status as any,
            remarks: record.remarks || null,
            markedBy: adminId,
            classNum,
          },
          create: {
            userId: record.userId,
            date,
            classNum,
            status: record.status as any,
            remarks: record.remarks || null,
            markedBy: adminId,
          },
          select: {
            id: true,
            userId: true,
            status: true,
            date: true,
          },
        });
      })
    );

    res.json({
      message: `Attendance marked for ${results.length} students.`,
      results,
    });
  } catch (error: any) {
    console.error('[Attendance] Mark attendance error:', error);
    res.status(500).json({ error: 'Failed to mark attendance.' });
  }
});

// ═══════════════════════════════════════════
// Admin: Get Attendance Stats
// GET /api/attendance/stats?classNum=11&date=2026-07-15
// ═══════════════════════════════════════════

router.get('/stats', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const classNum = parseInt(req.query.classNum as string) || 11;
    const date = req.query.date as string | undefined;

    // Total students in class
    const totalStudents = await prisma.user.count({
      where: { role: 'student', selectedClass: classNum },
    });

    // Today's or specified date stats
    const targetDate = date || new Date().toISOString().split('T')[0];

    const todayRecords = await prisma.attendance.findMany({
      where: { classNum, date: targetDate },
      select: { status: true },
    });

    const todayPresent = todayRecords.filter(r => r.status === 'PRESENT').length;
    const todayAbsent = todayRecords.filter(r => r.status === 'ABSENT').length;
    const todayLate = todayRecords.filter(r => r.status === 'LATE').length;
    const todayExcused = todayRecords.filter(r => r.status === 'EXCUSED').length;
    const todayMarked = todayRecords.length;
    const todayPercentage = totalStudents > 0
      ? Math.round((todayPresent / totalStudents) * 100)
      : 0;

    // Overall average attendance percentage (across all dates)
    const allRecords = await prisma.attendance.findMany({
      where: { classNum },
      select: { status: true },
    });

    const totalPresent = allRecords.filter(r => r.status === 'PRESENT').length;
    const overallPercentage = allRecords.length > 0
      ? Math.round((totalPresent / allRecords.length) * 100)
      : 0;

    res.json({
      stats: {
        totalStudents,
        date: targetDate,
        todayMarked,
        todayPresent,
        todayAbsent,
        todayLate,
        todayExcused,
        todayPercentage,
        overallPercentage,
      },
    });
  } catch (error: any) {
    console.error('[Attendance] Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance stats.' });
  }
});

// ═══════════════════════════════════════════
// Admin: Get Monthly Attendance Report
// GET /api/attendance/report?classNum=11&month=2026-07
// ═══════════════════════════════════════════

router.get('/report', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const classNum = parseInt(req.query.classNum as string) || 11;
    const month = req.query.month as string; // "YYYY-MM"

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'month must be in YYYY-MM format.' });
      return;
    }

    // Get total students in class
    const totalStudents = await prisma.user.count({
      where: { role: 'student', selectedClass: classNum },
    });

    // Get all attendance records for the month
    const records = await prisma.attendance.findMany({
      where: {
        classNum,
        date: { startsWith: month },
      },
      include: {
        user: {
          select: { displayName: true, email: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group by date for daily summaries
    const dailySummary: Record<string, { present: number; absent: number; late: number; excused: number; total: number }> = {};

    for (const record of records) {
      if (!dailySummary[record.date]) {
        dailySummary[record.date] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      }
      dailySummary[record.date].total++;
      const key = record.status.toLowerCase() as 'present' | 'absent' | 'late' | 'excused';
      dailySummary[record.date][key]++;
    }

    res.json({
      month,
      classNum,
      totalStudents,
      dailySummary,
      records: records.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.user.displayName,
        userEmail: r.user.email,
        date: r.date,
        status: r.status,
        remarks: r.remarks,
      })),
    });
  } catch (error: any) {
    console.error('[Attendance] Get report error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance report.' });
  }
});

export default router;
