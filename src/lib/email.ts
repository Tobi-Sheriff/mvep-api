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
