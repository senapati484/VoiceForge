import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { config } from '../config';
import OtpRecord from '../db/models/OtpRecord';

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: false,
  auth: {
    user: config.email.user,
    pass: config.email.pass
  }
});

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const html = `
    <div style="max-width: 400px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; padding: 24px;">
      <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 20px; font-weight: 600;">VoiceForge</h2>
        <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">Your verification code</p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #111827;">${otp}</span>
        </div>

        <p style="margin: 0; color: #6b7280; font-size: 13px;">Expires in 10 minutes</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: config.email.from,
    to: email,
    subject: `Your VoiceForge code: ${otp}`,
    html
  });
}

export async function createOtpRecord(email: string, otp: string): Promise<void> {
  // Delete any existing OTP for this email
  await OtpRecord.deleteMany({ email: email.toLowerCase() });

  const otpHash = await bcrypt.hash(otp, 10);

  await OtpRecord.create({
    email: email.toLowerCase(),
    otpHash,
    expiresAt: new Date(Date.now() + 600000) // 10 minutes
  });
}

export async function verifyOtp(email: string, otp: string): Promise<boolean> {
  const record = await OtpRecord.findOne({
    email: email.toLowerCase(),
    used: false
  });

  if (!record) return false;
  if (record.expiresAt < new Date()) return false;

  const valid = await bcrypt.compare(otp, record.otpHash);

  // Note: OTP is NOT marked as used here anymore
  // It will be marked as used after successful login in the auth route

  return valid;
}

export async function markOtpAsUsed(email: string): Promise<void> {
  await OtpRecord.deleteMany({ email: email.toLowerCase() });
}
