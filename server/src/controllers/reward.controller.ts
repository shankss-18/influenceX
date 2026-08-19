import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Reward } from '../models/Reward';
import { RewardClaim } from '../models/RewardClaim';
import { RankGoodie } from '../models/RankGoodie';
import { LevelThreshold } from '../models/LevelThreshold';
import { Student } from '../models/Student';
import { createAuditLog } from '../utils/audit';
import { getCurrentISTDate } from '../utils/timezone';

const defaultTierConfigs = [
  { name: 'Explorer', order: 1, minCredits: 0, icon: '🌱', goodieName: 'Club Welcome Stickers & Kit', totalStock: 50, lowStockThreshold: 10 },
  { name: 'Rising', order: 2, minCredits: 100, icon: '🚀', goodieName: 'Exclusive Metal Club Lapel Pin', totalStock: 40, lowStockThreshold: 8 },
  { name: 'Creator', order: 3, minCredits: 250, icon: '🎨', goodieName: 'NIAT Influencers Custom T-Shirt', totalStock: 30, lowStockThreshold: 5 },
  { name: 'Leader', order: 4, minCredits: 500, icon: '⭐', goodieName: 'Official Premium Creator Hoodie', totalStock: 20, lowStockThreshold: 5 },
  { name: 'Icon', order: 5, minCredits: 1000, icon: '👑', goodieName: 'Golden Trophy & Tech Backpack', totalStock: 10, lowStockThreshold: 3 },
];

/**
 * Screen 6: Supply & Inventory Tracking for 5 Tier Goodies
 */
export async function getGoodieInventory(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Ensure default thresholds exist
    for (const dt of defaultTierConfigs) {
      const exists = await LevelThreshold.findOne({ name: dt.name });
      if (!exists) {
        await LevelThreshold.create(dt);
      }
    }

    const thresholds = await LevelThreshold.find().sort({ order: 1 });

    const inventory = await Promise.all(
      thresholds.map(async (t) => {
        const issuedCount = await RankGoodie.countDocuments({
          levelName: t.name,
          status: 'ISSUED',
        });
        const pendingCount = await RankGoodie.countDocuments({
          levelName: t.name,
          status: 'PENDING',
        });

        const totalStock = t.totalStock || 50;
        const remainingStock = Math.max(0, totalStock - issuedCount);
        const lowStockThreshold = t.lowStockThreshold || 5;
        const isLowStock = remainingStock <= lowStockThreshold;
        const isOutOfStock = remainingStock === 0;

        return {
          id: t._id.toString(),
          levelName: t.name,
          order: t.order,
          minCredits: t.minCredits,
          icon: t.icon,
          goodieName: t.goodieName || `${t.name} Goodie Kit`,
          totalStock,
          issuedCount,
          pendingCount,
          remainingStock,
          lowStockThreshold,
          isLowStock,
          isOutOfStock,
        };
      })
    );

    res.status(200).json({
      success: true,
      inventory,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 6: Admin Updates Goodie Name or Tops-Up Stock (Restock)
 */
export async function updateGoodieInventory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { levelName } = req.params;
    const { goodieName, totalStock, lowStockThreshold } = req.body as {
      goodieName?: string;
      totalStock?: number;
      lowStockThreshold?: number;
    };

    let threshold = await LevelThreshold.findOne({ name: levelName });
    if (!threshold) {
      res.status(404).json({ success: false, error: `Level '${levelName}' configuration not found` });
      return;
    }

    const beforeValue = threshold.toJSON();
    if (goodieName !== undefined) threshold.goodieName = goodieName;
    if (totalStock !== undefined) threshold.totalStock = Number(totalStock);
    if (lowStockThreshold !== undefined) threshold.lowStockThreshold = Number(lowStockThreshold);

    await threshold.save();

    await createAuditLog({
      req,
      action: 'REWARD_UPDATED',
      targetType: 'REWARD',
      targetId: threshold._id.toString(),
      beforeValue,
      afterValue: threshold.toJSON(),
      reason: `Admin updated goodie config for level '${levelName}': name='${threshold.goodieName}', stock=${threshold.totalStock}`,
    });

    res.status(200).json({
      success: true,
      message: `Updated goodie config for '${levelName}'. Total stock set to ${threshold.totalStock}.`,
      threshold: threshold.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 6: Entitlement Queue & Issued History
 */
export async function listRankGoodies(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = req.query.status as string;
    const levelName = req.query.levelName as string;
    const search = (req.query.search as string || '').trim().toLowerCase();

    const query: any = {};
    if (status && ['PENDING', 'ISSUED'].includes(status)) {
      query.status = status;
    }
    if (levelName && levelName !== 'ALL') {
      query.levelName = levelName;
    }

    const goodies = await RankGoodie.find(query)
      .populate('studentId', 'fullName influenceXId collegeStudentId branch year section currentLevel cachedTotalCredits')
      .populate('issuedBy', 'name email role')
      .sort({ unlockedAt: -1, issuedAt: -1 });

    let filtered = goodies;
    if (search) {
      filtered = goodies.filter((g) => {
        const st = g.studentId as any;
        return (
          st?.fullName?.toLowerCase().includes(search) ||
          st?.influenceXId?.toLowerCase().includes(search) ||
          st?.collegeStudentId?.toLowerCase().includes(search) ||
          g.goodieName?.toLowerCase().includes(search)
        );
      });
    }

    const allGoodies = await RankGoodie.find();
    const pendingCount = allGoodies.filter((g) => g.status === 'PENDING').length;
    const issuedCount = allGoodies.filter((g) => g.status === 'ISSUED').length;

    res.status(200).json({
      success: true,
      count: filtered.length,
      stats: {
        total: allGoodies.length,
        pendingCount,
        issuedCount,
      },
      goodies: filtered,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 6: Single Goodie Issue with Stock Check
 */
export async function issueRankGoodie(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const actorUser = req.user!;

    const goodie = await RankGoodie.findById(id).populate('studentId', 'fullName influenceXId');
    if (!goodie) {
      res.status(404).json({ success: false, error: 'Goodie entitlement record not found' });
      return;
    }

    if (goodie.status === 'ISSUED') {
      res.status(400).json({ success: false, error: 'This goodie has already been issued.' });
      return;
    }

    // Check inventory stock for this level
    const threshold = await LevelThreshold.findOne({ name: goodie.levelName });
    const currentIssued = await RankGoodie.countDocuments({
      levelName: goodie.levelName,
      status: 'ISSUED',
    });
    const totalStock = threshold?.totalStock || 50;

    if (currentIssued >= totalStock) {
      res.status(400).json({
        success: false,
        error: `Out of stock: All ${totalStock} units of '${goodie.goodieName}' have been issued. Please restock in Goodie Configuration above.`,
      });
      return;
    }

    const beforeValue = goodie.toJSON();
    goodie.status = 'ISSUED';
    goodie.issuedAt = getCurrentISTDate();
    goodie.issuedBy = actorUser._id;
    if (notes) goodie.notes = notes;
    await goodie.save();

    const student = goodie.studentId as any;
    await createAuditLog({
      req,
      action: 'RANK_GOODIE_ISSUED',
      targetType: 'RANK_GOODIE',
      targetId: goodie._id.toString(),
      beforeValue,
      afterValue: goodie.toJSON(),
      reason: `Admin ${actorUser.name} issued '${goodie.goodieName}' to student ${student?.influenceXId} (${student?.fullName}). Remaining stock: ${totalStock - currentIssued - 1}`,
    });

    res.status(200).json({
      success: true,
      message: `Goodie '${goodie.goodieName}' successfully issued to ${student?.fullName}.`,
      goodie: goodie.toJSON(),
      remainingStock: totalStock - currentIssued - 1,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Screen 6: Bulk Issue Pending Goodies
 */
export async function bulkIssueRankGoodies(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { goodieIds, notes } = req.body as { goodieIds: string[]; notes?: string };
    const actorUser = req.user!;

    if (!goodieIds || goodieIds.length === 0) {
      res.status(400).json({ success: false, error: 'No goodie IDs provided for bulk issuing' });
      return;
    }

    let issuedCount = 0;
    const skippedDueToStock: string[] = [];

    for (const gId of goodieIds) {
      const goodie = await RankGoodie.findById(gId).populate('studentId', 'fullName influenceXId');
      if (!goodie || goodie.status === 'ISSUED') continue;

      const threshold = await LevelThreshold.findOne({ name: goodie.levelName });
      const currentIssued = await RankGoodie.countDocuments({
        levelName: goodie.levelName,
        status: 'ISSUED',
      });
      const totalStock = threshold?.totalStock || 50;

      if (currentIssued >= totalStock) {
        skippedDueToStock.push(`${goodie.levelName} (${goodie.goodieName})`);
        continue;
      }

      goodie.status = 'ISSUED';
      goodie.issuedAt = getCurrentISTDate();
      goodie.issuedBy = actorUser._id;
      if (notes) goodie.notes = notes;
      await goodie.save();
      issuedCount++;
    }

    await createAuditLog({
      req,
      action: 'RANK_GOODIE_ISSUED',
      targetType: 'RANK_GOODIE',
      targetId: actorUser._id.toString(),
      reason: `Admin ${actorUser.name} bulk issued ${issuedCount} goodies.${skippedDueToStock.length > 0 ? ` Skipped out-of-stock: ${skippedDueToStock.join(', ')}` : ''}`,
    });

    res.status(200).json({
      success: true,
      message: `Successfully issued ${issuedCount} goodies.${skippedDueToStock.length > 0 ? ` ${skippedDueToStock.length} items were skipped due to zero stock.` : ''}`,
      issuedCount,
      skippedDueToStock,
    });
  } catch (error) {
    next(error);
  }
}
