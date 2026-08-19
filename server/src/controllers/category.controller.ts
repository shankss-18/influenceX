import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EventCategory } from '../models/EventCategory';
import { Event } from '../models/Event';
import { createAuditLog } from '../utils/audit';
import { getCurrentISTDate } from '../utils/timezone';

const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60).trim(),
  description: z.string().max(250).optional().default(''),
  isActive: z.boolean().optional().default(true),
});

export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const showAll = req.query.all === 'true';
    const filter = showAll ? {} : { isActive: true };
    const categories = await EventCategory.find(filter).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      categories: categories.map((c) => c.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = categorySchema.parse(req.body);

    const existing = await EventCategory.findOne({ name: data.name });
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'An event category with this name already exists',
      });
      return;
    }

    const category = await EventCategory.create({
      name: data.name,
      description: data.description,
      isActive: data.isActive,
      createdAt: getCurrentISTDate(),
      updatedAt: getCurrentISTDate(),
    });

    await createAuditLog({
      req,
      action: 'EVENT_CATEGORY_CREATED',
      targetType: 'EVENT_CATEGORY',
      targetId: category._id.toString(),
      afterValue: category.toJSON(),
      reason: `Category '${category.name}' created by admin`,
    });

    res.status(201).json({
      success: true,
      message: 'Event category created successfully',
      category: category.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = categorySchema.partial().parse(req.body);

    const category = await EventCategory.findById(id);
    if (!category) {
      res.status(404).json({
        success: false,
        error: 'Event category not found',
      });
      return;
    }

    const beforeValue = category.toJSON();

    if (data.name && data.name !== category.name) {
      const duplicate = await EventCategory.findOne({ name: data.name, _id: { $ne: id } });
      if (duplicate) {
        res.status(409).json({
          success: false,
          error: 'An event category with this name already exists',
        });
        return;
      }
      category.name = data.name;
    }

    if (data.description !== undefined) category.description = data.description;
    if (data.isActive !== undefined) category.isActive = data.isActive;
    category.updatedAt = getCurrentISTDate();

    await category.save();

    await createAuditLog({
      req,
      action: 'EVENT_CATEGORY_UPDATED',
      targetType: 'EVENT_CATEGORY',
      targetId: category._id.toString(),
      beforeValue,
      afterValue: category.toJSON(),
      reason: `Category '${category.name}' updated by admin`,
    });

    res.status(200).json({
      success: true,
      message: 'Event category updated successfully',
      category: category.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const category = await EventCategory.findById(id);
    if (!category) {
      res.status(404).json({
        success: false,
        error: 'Event category not found',
      });
      return;
    }

    // Prompt requirement: "never hard-delete a category that's in use by an event"
    const inUseCount = await Event.countDocuments({ categoryId: id });
    if (inUseCount > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete category '${category.name}' because it is linked to ${inUseCount} event(s). You can deactivate it instead.`,
      });
      return;
    }

    const beforeValue = category.toJSON();
    await EventCategory.findByIdAndDelete(id);

    await createAuditLog({
      req,
      action: 'EVENT_CATEGORY_DELETED',
      targetType: 'EVENT_CATEGORY',
      targetId: id,
      beforeValue,
      reason: `Unused category '${category.name}' deleted by admin`,
    });

    res.status(200).json({
      success: true,
      message: 'Event category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
