import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/jwt';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../config/prisma';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

const createSenderSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  etherealUser: z.string().min(1),
  etherealPassword: z.string().min(1),
});

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const senders = await prisma.sender.findMany({
      where: { userId: req.userId! },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    res.json({ success: true, data: senders });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const input = createSenderSchema.parse(req.body);
    const sender = await prisma.sender.create({
      data: { ...input, userId: req.userId! },
    });
    res.status(201).json({
      success: true,
      data: { id: sender.id, email: sender.email, name: sender.name },
    });
  })
);

export default router;
