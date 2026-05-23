#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'
import { initCommand } from './commands/init.js'
import { devCommand } from './commands/dev.js'
import { buildCommand, buildPreviewCommand } from './commands/build.js'
import { pagesListCommand, pagesCreateCommand, pagesValidateCommand } from './commands/pages.js'
import { userCreateCommand, userListCommand, userResetPasswordCommand } from './commands/user.js'
import { pluginAddCommand, pluginRemoveCommand, pluginListCommand } from './commands/plugin.js'
import { cacheClearCommand, searchRebuildCommand, upgradeCommand } from './commands/system.js'
import { backupCreateCommand, backupListCommand, backupRestoreCommand, backupDeleteCommand } from './commands/backup.js'
import { siteCreateCommand, siteListCommand, siteBuildCommand, siteBackupCommand, siteMigrateCommand } from './commands/site.js'

const main = defineCommand({
  meta: { name: 'bldmrk', description: 'bldmrk CLI' },
  subCommands: {
    init: initCommand,
    dev: devCommand,
    build: buildCommand,
    'build:preview': buildPreviewCommand,
    'pages:list': pagesListCommand,
    'pages:create': pagesCreateCommand,
    'pages:validate': pagesValidateCommand,
    'user:create': userCreateCommand,
    'user:list': userListCommand,
    'user:reset-password': userResetPasswordCommand,
    'plugin:add': pluginAddCommand,
    'plugin:remove': pluginRemoveCommand,
    'plugin:list': pluginListCommand,
    'cache:clear': cacheClearCommand,
    'search:rebuild': searchRebuildCommand,
    upgrade: upgradeCommand,
    'backup:create': backupCreateCommand,
    'backup:list': backupListCommand,
    'backup:restore': backupRestoreCommand,
    'backup:delete': backupDeleteCommand,
    'site:create': siteCreateCommand,
    'site:list': siteListCommand,
    'site:build': siteBuildCommand,
    'site:backup': siteBackupCommand,
    'site:migrate': siteMigrateCommand,
  },
})

runMain(main)
