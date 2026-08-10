import * as cron from 'node-cron'
import { processPendingRegistrations } from './pendingRegistrations'
import { logger } from '../utils/logger'
import { dataSource } from '../database'
import { initializeRegisterKeys } from '../init/initializeRegisterKeys'
const JOB_CRON_SCHEDULE = process.env.JOB_CRON_SCHEDULE
if (!JOB_CRON_SCHEDULE) {
  logger.error('Register jobs: JOB_CRON_SCHEDULE not set')
  throw new Error('JOB_CRON_SCHEDULE is not set')
}

/**
 * Initialize cron jobs
 */
export function initializeJobs(): void {
  cron.schedule(
    JOB_CRON_SCHEDULE!,
    async () => {
      await processPendingRegistrations().catch(error => {
        logger.error(`Scheduled registration run failed: ${error}`)
      })
    },
    { timezone: 'UTC' },
  )

  logger.info('Job scheduler initialized')
}

process.on('unhandledRejection', reason => {
  logger.error(`Register Jobs: Exiting! Unhandled promise rejection: ${(reason as any)?.message ?? reason}`)
  process.exit(1)
})

process.on('uncaughtException', err => {
  logger.error(`Register Jobs: Exiting! Uncaught exception: ${err?.message ?? err}`)
  process.exit(1)
})

if (require.main === module) {
  async function startJobs() {
    await dataSource.initialize()
    await initializeRegisterKeys()
    initializeJobs()
    logger.info('Jobs started standalone')
  }
  startJobs().catch(error => {
    logger.error(`Register Jobs: Exiting! Failed to start jobs: ${error}`)
    process.exit(1)
  })
}
