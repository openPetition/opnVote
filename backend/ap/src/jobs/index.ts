import * as cron from 'node-cron'
import { processPendingAuthorizations } from './pendingAuthorizations'
import { logger } from '../utils/logger'
import { dataSource } from '../database'
const JOB_CRON_SCHEDULE = process.env.JOB_CRON_SCHEDULE
if (!JOB_CRON_SCHEDULE) {
  throw new Error('JOB_CRON_SCHEDULE is not set')
}

/**
 * Initialize cron jobs
 */
export function initializeJobs(): void {
  cron.schedule(JOB_CRON_SCHEDULE!, async () => {
    await processPendingAuthorizations()
  })

  logger.info('Job scheduler initialized')
}

if (require.main === module) {
  async function startJobs() {
    await dataSource.initialize()
    initializeJobs()
    logger.info('Jobs started standalone')
  }
  startJobs()
}
