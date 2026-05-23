import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import type { FormLoader, ValidationError } from './FormLoader.js'
import type { EmailService } from './EmailService.js'

export interface SubmissionResult {
  success: boolean
  rateLimited?: boolean
  errors?: ValidationError[]
}

interface RateLimitEntry {
  count: number
  windowStart: number
}

const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export class FormSubmissionService {
  private rateLimitMap = new Map<string, RateLimitEntry>()

  constructor(
    private readonly formLoader: FormLoader,
    private readonly emailService?: EmailService,
    private readonly projectDir?: string,
  ) {}

  async submit(
    formName: string,
    data: Record<string, unknown>,
    clientIp: string,
  ): Promise<SubmissionResult> {
    const blueprint = await this.formLoader.load(formName)

    // Honeypot check — if honeypot field is filled, silently succeed
    const honeypotValue = data[blueprint.honeypot]
    if (honeypotValue !== undefined && honeypotValue !== '' && honeypotValue !== null) {
      return { success: true }
    }

    // Rate limit check
    const now = Date.now()
    const ipKey = `${formName}:${clientIp}`
    const entry = this.rateLimitMap.get(ipKey)

    if (entry) {
      if (now - entry.windowStart < RATE_WINDOW_MS) {
        if (entry.count >= blueprint.rateLimit) {
          return { success: false, rateLimited: true }
        }
        entry.count++
      } else {
        // Reset window
        this.rateLimitMap.set(ipKey, { count: 1, windowStart: now })
      }
    } else {
      this.rateLimitMap.set(ipKey, { count: 1, windowStart: now })
    }

    // Validate
    const validation = await this.formLoader.validate(formName, data)
    if (!validation.valid) {
      return { success: false, errors: validation.errors }
    }

    // Determine save dir
    const savePath = blueprint.actions.save?.path ?? 'content/data/forms'
    const baseDir = this.projectDir ?? process.cwd()
    const submissionDir = path.join(baseDir, savePath, formName)

    // Save action
    const saveEnabled = blueprint.actions.save?.enabled !== false
    if (saveEnabled) {
      try {
        await fs.mkdir(submissionDir, { recursive: true })
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filePath = path.join(submissionDir, `${timestamp}.yaml`)
        const content = yaml.dump({ submittedAt: new Date().toISOString(), ...data })
        await fs.writeFile(filePath, content, 'utf-8')
      } catch (err) {
        console.error('[FormSubmissionService] Failed to save submission:', err)
      }
    }

    // Email action
    if (blueprint.actions.email && this.emailService) {
      try {
        await this.emailService.sendFormEmail(blueprint, data)
      } catch (err) {
        console.error('[FormSubmissionService] Failed to send email:', err)
        // Partial success — don't fail the whole submission
      }
    }

    // Webhook action
    if (blueprint.actions.webhook) {
      const { url, method, headers } = blueprint.actions.webhook
      try {
        await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(headers ?? {}),
          },
          body: JSON.stringify(data),
        })
      } catch (err) {
        console.error('[FormSubmissionService] Failed to call webhook:', err)
      }
    }

    return { success: true }
  }
}
