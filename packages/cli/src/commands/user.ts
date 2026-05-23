import { defineCommand } from 'citty'
import { input, select, password } from '@inquirer/prompts'
import { consola } from 'consola'
import path from 'path'
import { UserStore } from '@bldmrk/core'
import type { UserRole } from '@bldmrk/core'

function getUsersFilePath(): string {
  return path.join(process.cwd(), 'content', 'config', 'users.yaml')
}

export const userCreateCommand = defineCommand({
  meta: { description: 'Create a new user interactively' },
  async run() {
    const email = await input({ message: 'Email:' })
    const role = await select<UserRole>({
      message: 'Role:',
      choices: [
        { value: 'admin', name: 'Admin (full access)' },
        { value: 'editor', name: 'Editor (read + write)' },
        { value: 'viewer', name: 'Viewer (read only)' },
      ],
    })
    const pwd = await password({ message: 'Password:' })

    const store = new UserStore(getUsersFilePath())
    const user = await store.create({ email, password: pwd, role })
    consola.success(`User created: ${user.email} (${user.role}) — id: ${user.id}`)
  },
})

export const userListCommand = defineCommand({
  meta: { description: 'List all users' },
  async run() {
    const store = new UserStore(getUsersFilePath())
    const users = await store.list()

    if (users.length === 0) {
      consola.info('No users found.')
      return
    }

    console.log('\n  ID'.padEnd(40) + 'Email'.padEnd(35) + 'Role'.padEnd(12) + 'Created')
    console.log('  ' + '-'.repeat(90))
    for (const user of users) {
      console.log([
        ('  ' + user.id).padEnd(40),
        user.email.padEnd(35),
        user.role.padEnd(12),
        user.createdAt.slice(0, 10),
      ].join(''))
    }
    console.log()
  },
})

export const userResetPasswordCommand = defineCommand({
  meta: { description: 'Reset a user password interactively' },
  async run() {
    const store = new UserStore(getUsersFilePath())
    const users = await store.list()

    if (users.length === 0) {
      consola.warn('No users found.')
      return
    }

    const email = await select({
      message: 'Select user:',
      choices: users.map(u => ({ value: u.email, name: `${u.email} (${u.role})` })),
    })

    const newPassword = await password({ message: 'New password:' })
    const confirm = await password({ message: 'Confirm password:' })

    if (newPassword !== confirm) {
      consola.error('Passwords do not match.')
      process.exit(1)
    }

    const user = users.find(u => u.email === email)!
    await store.delete(user.id)
    await store.create({ email: user.email, password: newPassword, role: user.role })
    consola.success(`Password reset for ${email}`)
  },
})
