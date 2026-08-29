import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth/jwt';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../config/prisma';
import { scheduleEmailSchema } from '../utils/validation';
import { scheduleCampaign } from '../services/schedulingService';
import { extractEmailsFromText } from '../utils/emailParser';
import { searchEmails } from '../elasticsearch/emailIndex';
import { AppError } from '../utils/AppError';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.use(requireAuth);

// POST /api/emails/schedule
router.post(
  '/schedule',
  asyncHandler(async (req, res) => {
    const input = scheduleEmailSchema.parse({
      ...req.body,
      delayMs: req.body.delayMs !== undefined ? Number(req.body.delayMs) : undefined,
      hourlyLimit: req.body.hourlyLimit !== undefined ? Number(req.body.hourlyLimit) : undefined,
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw new AppError('User not found', 404);

    const { campaign, emails } = await scheduleCampaign(req.userId!, user.email, input);

    res.status(201).json({
      success: true,
      data: {
        campaign,
        emails,
      },
    });
  })
);

// GET /api/emails/scheduled
router.get(
  '/scheduled',
  asyncHandler(async (req, res) => {
    const emails = await prisma.scheduledEmail.findMany({
      where: {
        campaign: { userId: req.userId! },
        status: { in: ['scheduled', 'processing'] },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    });
    res.json({ success: true, data: emails });
  })
);

// GET /api/emails/sent
router.get(
  '/sent',
  asyncHandler(async (req, res) => {
    const emails = await prisma.scheduledEmail.findMany({
      where: {
        campaign: { userId: req.userId! },
        status: { in: ['sent', 'failed'] },
      },
      orderBy: { sentAt: 'desc' },
      take: 200,
    });
    res.json({ success: true, data: emails });
  })
);

// GET /api/emails/search?q=
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string) ?? '';
    const results = await searchEmails({ userId: req.userId!, query: q });
    res.json({ success: true, data: results });
  })
);

// GET /api/emails/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const email = await prisma.scheduledEmail.findFirst({
      where: { id: req.params.id, campaign: { userId: req.userId! } },
    });
    if (!email) throw new AppError('Email not found', 404);
    res.json({ success: true, data: email });
  })
);

// POST /api/emails/parse-upload  (CSV/text file -> extracted email list)
router.post(
  '/parse-upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const content = req.file.buffer.toString('utf-8');
    const emails = extractEmailsFromText(content);
    res.json({ success: true, data: { emails, count: emails.length } });
  })
);

export default router;
