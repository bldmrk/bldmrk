import nodemailer from 'nodemailer'
import type { FormBlueprint } from './FormSchema.js'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  auth?: { user: string; pass: string }
  from?: string
}

export class EmailService {
  private transporter: nodemailer.Transporter

  constructor(private readonly smtpConfig: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      ...(smtpConfig.auth ? { auth: smtpConfig.auth } : {}),
    })
  }

  async sendFormEmail(blueprint: FormBlueprint, data: Record<string, unknown>): Promise<void> {
    const emailAction = blueprint.actions.email
    if (!emailAction) return

    const from = emailAction.from ?? this.smtpConfig.from ?? `noreply@bldmrk`

    const rows = Object.entries(data)
      .map(([key, val]) => `<tr><th style="text-align:left;padding:4px 8px;border:1px solid #ddd;">${escapeHtml(key)}</th><td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(String(val ?? ''))}</td></tr>`)
      .join('\n')

    const html = `
<!DOCTYPE html>
<html>
<body>
<h2>New Form Submission: ${escapeHtml(blueprint.name)}</h2>
<table style="border-collapse:collapse;width:100%">
  <tbody>
    ${rows}
  </tbody>
</table>
</body>
</html>`.trim()

    await this.transporter.sendMail({
      from,
      to: emailAction.to,
      subject: emailAction.subject,
      ...(emailAction.replyTo ? { replyTo: emailAction.replyTo } : {}),
      html,
    })
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
