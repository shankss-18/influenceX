import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreditRule } from '../models/CreditRule';
import { LevelThreshold } from '../models/LevelThreshold';
import { createAuditLog } from '../utils/audit';

const updateCreditRuleSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  defaultAmount: z.number().optional(),
  isActive: z.boolean().optional(),
  requiresSecondApproval: z.boolean().optional(),
});

const updateLevelThresholdSchema = z.object({
  name: z.string().min(2).optional(),
  minCredits: z.number().min(0).optional(),
  order: z.number().optional(),
  badgeColor: z.string().optional(),
});

export async function listCreditRules(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rules = await CreditRule.find().sort({ type: 1 });
    res.status(200).json({ success: true, count: rules.length, rules });
  } catch (error) {
    next(error);
  }
}

export async function updateCreditRule(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = updateCreditRuleSchema.parse(req.body);

    const rule = await CreditRule.findById(id);
    if (!rule) {
      res.status(404).json({ success: false, error: 'Credit rule not found' });
      return;
    }

    const beforeValue = rule.toJSON();
    Object.assign(rule, updateData);
    await rule.save();

    await createAuditLog({
      req,
      action: 'CREDIT_RULE_UPDATED',
      targetType: 'CREDIT_RULE',
      targetId: rule._id.toString(),
      beforeValue,
      afterValue: rule.toJSON(),
      reason: `Admin updated credit rule '${rule.type}'`,
    });

    res.status(200).json({
      success: true,
      message: `Credit rule '${rule.type}' updated successfully`,
      rule: rule.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function listLevelThresholds(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const levels = await LevelThreshold.find().sort({ order: 1 });
    res.status(200).json({ success: true, count: levels.length, levels });
  } catch (error) {
    next(error);
  }
}

export async function updateLevelThreshold(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = updateLevelThresholdSchema.parse(req.body);

    const level = await LevelThreshold.findById(id);
    if (!level) {
      res.status(404).json({ success: false, error: 'Level threshold not found' });
      return;
    }

    const beforeValue = level.toJSON();
    Object.assign(level, updateData);
    await level.save();

    await createAuditLog({
      req,
      action: 'LEVEL_THRESHOLD_UPDATED',
      targetType: 'LEVEL_THRESHOLD',
      targetId: level._id.toString(),
      beforeValue,
      afterValue: level.toJSON(),
      reason: `Admin updated level threshold '${level.name}' (${level.minCredits} credits)`,
    });

    res.status(200).json({
      success: true,
      message: `Level threshold '${level.name}' updated successfully`,
      level: level.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}
