import * as cron from 'node-cron'
import { processPendingAuthorizations } from './pendingAuthorizations'
import { logger } from '../utils/logger'
import { dataSource } from '../database'
const JOB_CRON_SCHEDULE = process.env.JOB_CRON_SCHEDULE
if (!JOB_CRON_SCHEDULE) {
  logger.error('AP jobs: JOB_CRON_SCHEDULE not set')
  throw new Error('JOB_CRON_SCHEDULE is not set')
}

/**
 * Initialize cron jobs
 */
export function initializeJobs(): void {
  cron.schedule(JOB_CRON_SCHEDULE!, async () => {
    await processPendingAuthorizations().catch(error => {
      logger.error(`AP jobs: Scheduled run failed: ${error}`)
    })
  })

  logger.info('Job scheduler initialized')
}

process.on('unhandledRejection', reason => {
  logger.error(`AP jobs: Exiting! Unhandled promise rejection: ${(reason as any)?.message ?? reason}`)
  process.exit(1)
})

process.on('uncaughtException', err => {
  logger.error(`AP jobs: Exiting! Uncaught exception: ${err?.message ?? err}`)
  process.exit(1)
})

if (require.main === module) {
  async function startJobs() {
    await dataSource.initialize()
    initializeJobs()
    logger.info('Jobs started standalone')
  }
  startJobs().catch(error => {
    logger.error(`AP jobs: Failed to start: ${error}`)
    process.exit(1)
  })
}
