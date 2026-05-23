import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- fs/promises mock ---
const mockMkdir = vi.fn().mockResolvedValue(undefined)
const mockWriteFile = vi.fn().mockResolvedValue(undefined)
const mockReaddir = vi.fn()
const mockReadFile = vi.fn()

vi.mock('fs/promises', () => ({
  default: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
  },
}))

// --- global fetch mock ---
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { FormLoader } from './FormLoader.js'
import { FormSubmissionService } from './FormSubmissionService.js'
import type { EmailService } from './EmailService.js'
import type { FormBlueprint } from './FormSchema.js'

const CONTACT_BLUEPRINT: FormBlueprint = {
  name: 'contact',
  fields: [
    { name: 'name', type: 'text', label: 'Full Name', required: true },
    { name: 'email', type: 'email', label: 'Email', required: true },
    { name: 'message', type: 'textarea', label: 'Message', required: false },
  ],
  actions: {
    email: {
      to: 'admin@example.com',
      subject: 'New Contact Submission',
    },
    save: { enabled: true, path: 'content/data/forms' },
    webhook: {
      url: 'https://webhook.example.com/hook',
      method: 'POST',
    },
  },
  honeypot: '_gotcha',
  rateLimit: 5,
}

const VALID_DATA = {
  name: 'Alice',
  email: 'alice@example.com',
  message: 'Hello!',
}

function makeLoader(blueprint: FormBlueprint = CONTACT_BLUEPRINT): FormLoader {
  const loader = {
    load: vi.fn().mockResolvedValue(blueprint),
    validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    loadAll: vi.fn().mockResolvedValue([blueprint]),
  } as unknown as FormLoader
  return loader
}

function makeEmailService(fail = false): EmailService {
  return {
    sendFormEmail: fail
      ? vi.fn().mockRejectedValue(new Error('SMTP error'))
      : vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailService
}

describe('FormSubmissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
  })

  it('executes all actions on a valid submission', async () => {
    const loader = makeLoader()
    const emailService = makeEmailService()
    const service = new FormSubmissionService(loader, emailService, '/project')

    const result = await service.submit('contact', VALID_DATA, '127.0.0.1')

    expect(result.success).toBe(true)
    expect(result.rateLimited).toBeUndefined()
    expect(result.errors).toBeUndefined()

    // Save was called
    expect(mockMkdir).toHaveBeenCalled()
    expect(mockWriteFile).toHaveBeenCalled()

    // Email was sent
    expect((emailService.sendFormEmail as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      CONTACT_BLUEPRINT,
      VALID_DATA,
    )

    // Webhook was called
    expect(mockFetch).toHaveBeenCalledWith(
      'https://webhook.example.com/hook',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(VALID_DATA),
      }),
    )
  })

  it('silently returns success when honeypot field is filled', async () => {
    const loader = makeLoader()
    const emailService = makeEmailService()
    const service = new FormSubmissionService(loader, emailService, '/project')

    const dataWithHoneypot = { ...VALID_DATA, _gotcha: 'bot-value' }
    const result = await service.submit('contact', dataWithHoneypot, '127.0.0.1')

    expect(result.success).toBe(true)
    // No side effects
    expect(mockMkdir).not.toHaveBeenCalled()
    expect(mockWriteFile).not.toHaveBeenCalled()
    expect((emailService.sendFormEmail as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns rateLimited when IP exceeds the rate limit', async () => {
    const loader = makeLoader()
    const service = new FormSubmissionService(loader, undefined, '/project')

    const ip = '10.0.0.1'
    // First 5 submissions succeed (rateLimit is 5)
    for (let i = 0; i < 5; i++) {
      const r = await service.submit('contact', VALID_DATA, ip)
      expect(r.success).toBe(true)
    }

    // 6th submission should be rate limited
    const result = await service.submit('contact', VALID_DATA, ip)
    expect(result.success).toBe(false)
    expect(result.rateLimited).toBe(true)
  })

  it('still saves submission even when email sending fails', async () => {
    const loader = makeLoader()
    const emailService = makeEmailService(true) // email will throw
    const service = new FormSubmissionService(loader, emailService, '/project')

    const result = await service.submit('contact', VALID_DATA, '127.0.0.1')

    expect(result.success).toBe(true)
    // Save still occurred
    expect(mockWriteFile).toHaveBeenCalled()
  })

  it('returns validation errors for invalid data', async () => {
    const loader = {
      load: vi.fn().mockResolvedValue(CONTACT_BLUEPRINT),
      validate: vi.fn().mockResolvedValue({
        valid: false,
        errors: [{ field: 'email', message: 'Email is required' }],
      }),
      loadAll: vi.fn().mockResolvedValue([CONTACT_BLUEPRINT]),
    } as unknown as FormLoader

    const service = new FormSubmissionService(loader, undefined, '/project')
    const result = await service.submit('contact', { name: 'Alice' }, '127.0.0.1')

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0].field).toBe('email')
  })

  it('does not send email when emailService is not provided', async () => {
    const loader = makeLoader()
    const service = new FormSubmissionService(loader, undefined, '/project')

    const result = await service.submit('contact', VALID_DATA, '127.0.0.1')

    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalled() // webhook still fires
  })
})
