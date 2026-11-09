import { env } from '../utils/env.js'
import { logger } from '../utils/logger.js'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

// Minimal nodemailer-style SMTP sender using the built-in fetch or net
// We keep it dependency-light — swap for Resend/SendGrid in production by replacing sendEmail()
const sendViaSMTP = async (opts: EmailOptions): Promise<void> => {
  // Use Resend API if configured, otherwise log (dev mode)
  if (env.SMTP_HOST === 'localhost' && env.SMTP_PORT === 1025) {
    logger.info({ to: opts.to, subject: opts.subject }, '[EMAIL DEV] Would send email (configure SMTP to send)')
    return
  }

  const auth = Buffer.from(`${env.SMTP_USER}:${env.SMTP_PASS}`).toString('base64')

  try {
    const res = await fetch(`https://api.resend.com/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.SMTP_PASS}`,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      logger.error({ err, to: opts.to }, 'Email send failed')
    } else {
      logger.info({ to: opts.to, subject: opts.subject }, 'Email sent')
    }
  } catch (err) {
    logger.error({ err, to: opts.to }, 'Email transport error')
  }
}

const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'

export const emailTemplates = {
  workspaceInvite: (data: { workspaceName: string; token: string; inviterName?: string }): EmailOptions => ({
    to: '',
    subject: `You have been invited to ${data.workspaceName} on CollabOS`,
    html: `
      <div style="font-family:monospace;max-width:480px;margin:40px auto;padding:32px;border:1px solid #e0d8cc;background:#fff">
        <h1 style="font-size:24px;font-weight:800;margin-bottom:8px">Collab<span style="color:#e8400a">OS</span></h1>
        <p style="color:#555;margin-bottom:24px">You have been invited to join <strong>${data.workspaceName}</strong>${data.inviterName ? ` by ${data.inviterName}` : ''}.</p>
        <a href="${appUrl}/invite/${data.token}" style="display:inline-block;background:#0d0d0d;color:#fff;padding:10px 20px;text-decoration:none;font-weight:600">
          Accept Invitation
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px">This invitation expires in 7 days. If you did not expect this email, ignore it.</p>
      </div>`,
    text: `You have been invited to ${data.workspaceName} on CollabOS.\n\nAccept: ${appUrl}/invite/${data.token}\n\nExpires in 7 days.`,
  }),

  passwordReset: (data: { name: string; token: string }): EmailOptions => ({
    to: '',
    subject: 'Reset your CollabOS password',
    html: `
      <div style="font-family:monospace;max-width:480px;margin:40px auto;padding:32px;border:1px solid #e0d8cc;background:#fff">
        <h1 style="font-size:24px;font-weight:800;margin-bottom:8px">Collab<span style="color:#e8400a">OS</span></h1>
        <p style="color:#555;margin-bottom:24px">Hi ${data.name}, we received a request to reset your password.</p>
        <a href="${appUrl}/auth/reset-password?token=${data.token}" style="display:inline-block;background:#0d0d0d;color:#fff;padding:10px 20px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px">This link expires in 1 hour. If you did not request this, you can safely ignore it.</p>
      </div>`,
    text: `Reset your CollabOS password: ${appUrl}/auth/reset-password?token=${data.token}\n\nExpires in 1 hour.`,
  }),

  mentionNotification: (data: { mentionerName: string; channelName: string; messageUrl: string; preview: string }): EmailOptions => ({
    to: '',
    subject: `${data.mentionerName} mentioned you in #${data.channelName}`,
    html: `
      <div style="font-family:monospace;max-width:480px;margin:40px auto;padding:32px;border:1px solid #e0d8cc;background:#fff">
        <h1 style="font-size:24px;font-weight:800;margin-bottom:8px">Collab<span style="color:#e8400a">OS</span></h1>
        <p style="color:#555;margin-bottom:8px"><strong>${data.mentionerName}</strong> mentioned you in <strong>#${data.channelName}</strong>:</p>
        <blockquote style="border-left:3px solid #e8400a;padding:8px 12px;background:#f5f0e8;color:#555;margin:0 0 24px">${data.preview}</blockquote>
        <a href="${data.messageUrl}" style="display:inline-block;background:#0d0d0d;color:#fff;padding:10px 20px;text-decoration:none;font-weight:600">
          View Message
        </a>
      </div>`,
    text: `${data.mentionerName} mentioned you in #${data.channelName}: "${data.preview}"\n\nView: ${data.messageUrl}`,
  }),
}

export const sendEmail = async (opts: EmailOptions): Promise<void> => {
  await sendViaSMTP(opts)
}
