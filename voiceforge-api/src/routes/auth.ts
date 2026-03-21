import { Router } from 'express';
import { z } from 'zod';
import { User } from '../db';
import { requireAuth } from '../middleware/requireAuth';
import { signToken } from '../utils/jwt';
import { generateOtp, sendOtpEmail, createOtpRecord, verifyOtp, markOtpAsUsed } from '../services/otp.service';
import { config } from '../config';

const router = Router();

// In-memory rate limiter: email → timestamps[]
const otpRateLimit = new Map<string, number[]>();

const OTP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const OTP_MAX_ATTEMPTS = 3;

// POST /auth/send-otp
const sendOtpSchema = z.object({
  email: z.string().email()
});

router.post('/send-otp', async (req, res, next) => {
  try {
    const { email } = sendOtpSchema.parse(req.body);
    const now = Date.now();

    // Rate limit check
    const attempts = otpRateLimit.get(email) || [];
    const recentAttempts = attempts.filter(t => now - t < OTP_WINDOW_MS);

    if (recentAttempts.length >= OTP_MAX_ATTEMPTS) {
      res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
      return;
    }

    // Update rate limit
    recentAttempts.push(now);
    otpRateLimit.set(email, recentAttempts);

    // Generate and send OTP
    const otp = generateOtp();
    await createOtpRecord(email, otp);
    await sendOtpEmail(email, otp);

    res.json({ success: true, message: 'Code sent' });
  } catch (err) {
    next(err);
  }
});

// POST /auth/verify-otp
const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits')
});

router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp } = verifyOtpSchema.parse(req.body);

    const valid = await verifyOtp(email, otp);
    if (!valid) {
      res.status(401).json({ error: 'Invalid or expired code' });
      return;
    }

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        email: email.toLowerCase(),
        provider: 'otp',
        name: email.split('@')[0]
      });
    }

    // Only mark OTP as used AFTER successful user creation/login
    await markOtpAsUsed(email);

    const token = signToken({ userId: user._id.toString(), email: user.email });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        credits: user.credits,
        plan: user.plan
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/google
const googleSchema = z.object({
  idToken: z.string()
});

router.post('/google', async (req, res, next) => {
  try {
    const { idToken } = googleSchema.parse(req.body);

    // Verify Google token
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);

    if (!response.ok) {
      res.status(401).json({ error: 'Invalid Google token' });
      return;
    }

    const googleData = await response.json() as { email: string; name?: string };
    const { email, name } = googleData;

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        email: email.toLowerCase(),
        provider: 'google',
        name: name || email.split('@')[0]
      });
    }

    const token = signToken({ userId: user._id.toString(), email: user.email });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        credits: user.credits,
        plan: user.plan
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!.userId).select('-__v');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        credits: user.credits,
        plan: user.plan
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
