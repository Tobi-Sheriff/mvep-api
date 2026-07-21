import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
});

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: config.EMAIL_FROM,
    to,
    subject: 'Verify your MVEP account',
    text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Verify your MVEP account</h2>
        <p>Enter this code on the verification screen:</p>
        <p style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #111;">${code}</p>
        <p style="color: #666;">This code expires in <strong>15 minutes</strong>.</p>
        <p style="color: #999; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: config.EMAIL_FROM,
    to,
    subject: 'Reset your MVEP password',
    text: `Reset your password using this link: ${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your MVEP password</h2>
        <p>Click the button below to choose a new password:</p>
        <p><a href="${resetUrl}" style="display:inline-block; padding:12px 24px; background:#111; color:#fff; text-decoration:none; border-radius:6px;">Reset Password</a></p>
        <p style="color: #666; font-size: 13px;">Or paste this link into your browser:<br>${resetUrl}</p>
        <p style="color: #666;">This link expires in <strong>30 minutes</strong>.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
}
