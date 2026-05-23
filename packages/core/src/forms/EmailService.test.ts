import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn()
  const mockCreateTransport = vi.fn((_opts?: object) => ({ sendMail: mockSendMail }))
  return { mockSendMail, mockCreateTransport }
})

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}))

import { EmailService } from './EmailService.js'
import type { FormBlueprint } from './FormSchema.js'

const smtpConfig = {
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  from: 'noreply@example.com',
}

function makeBlueprint(overrides?: Partial<FormBlueprint['actions']['email']>): FormBlueprint {
  return {
    name: 'Contact Form',
    fields: [],
    actions: {
      email: {
        to: 'admin@example.com',
        subject: 'New Contact Submission',
        ...overrides,
      },
    },
    honeypot: '_gotcha',
    rateLimit: 5,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSendMail.mockResolvedValue({ messageId: 'test-id' })
})

describe('EmailService', () => {
  describe('sendFormEmail()', () => {
    it('calls sendMail with correct to, subject, and from', async () => {
      const service = new EmailService(smtpConfig)
      const blueprint = makeBlueprint()

      await service.sendFormEmail(blueprint, { name: 'Alice' })

      expect(mockSendMail).toHaveBeenCalledOnce()
      const call = mockSendMail.mock.calls[0][0]
      expect(call.to).toBe('admin@example.com')
      expect(call.subject).toBe('New Contact Submission')
      expect(call.from).toBe('noreply@example.com')
    })

    it('uses emailAction.from when provided, overriding smtpConfig.from', async () => {
      const service = new EmailService(smtpConfig)
      const blueprint = makeBlueprint({ from: 'custom@sender.com' })

      await service.sendFormEmail(blueprint, {})

      const call = mockSendMail.mock.calls[0][0]
      expect(call.from).toBe('custom@sender.com')
    })

    it('falls back to "noreply@bldmrk" when no from in action or smtp config', async () => {
      const service = new EmailService({ host: 'smtp.example.com', port: 587, secure: false })
      const blueprint = makeBlueprint()

      await service.sendFormEmail(blueprint, {})

      const call = mockSendMail.mock.calls[0][0]
      expect(call.from).toBe('noreply@bldmrk')
    })

    it('includes form field keys and values in the HTML body', async () => {
      const service = new EmailService(smtpConfig)
      const blueprint = makeBlueprint()

      await service.sendFormEmail(blueprint, { name: 'Alice', message: 'Hello!' })

      const call = mockSendMail.mock.calls[0][0]
      expect(call.html).toContain('name')
      expect(call.html).toContain('Alice')
      expect(call.html).toContain('message')
      expect(call.html).toContain('Hello!')
    })

    it('does not call sendMail when blueprint has no email action', async () => {
      const service = new EmailService(smtpConfig)
      const blueprint: FormBlueprint = {
        name: 'Silent Form',
        fields: [],
        actions: {},
        honeypot: '_gotcha',
        rateLimit: 5,
      }

      await service.sendFormEmail(blueprint, { name: 'Bob' })

      expect(mockSendMail).not.toHaveBeenCalled()
    })

    it('propagates errors thrown by sendMail', async () => {
      const service = new EmailService(smtpConfig)
      const blueprint = makeBlueprint()
      mockSendMail.mockRejectedValue(new Error('SMTP connection refused'))

      await expect(service.sendFormEmail(blueprint, { name: 'Alice' })).rejects.toThrow(
        'SMTP connection refused',
      )
    })
  })

  describe('constructor', () => {
    it('calls createTransport with secure: false when configured', () => {
      new EmailService({ host: 'smtp.example.com', port: 587, secure: false })

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: false }),
      )
    })

    it('calls createTransport with secure: true and auth when configured', () => {
      new EmailService({
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: { user: 'user@example.com', pass: 'secret' },
      })

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: true,
          auth: { user: 'user@example.com', pass: 'secret' },
        }),
      )
    })

    it('omits auth from createTransport when not provided', () => {
      new EmailService({ host: 'smtp.example.com', port: 587, secure: false })

      const call = mockCreateTransport.mock.calls[0][0]
      expect(call).not.toHaveProperty('auth')
    })
  })
})
