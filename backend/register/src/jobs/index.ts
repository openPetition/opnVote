import * as cron from 'node-cron';
import { processPendingRegistrations } from './pendingRegistrations';
import { logger } from '../utils/logger';
const JOB_CRON_SCHEDULE = process.env.JOB_CRON_SCHEDULE
if(!JOB_CRON_SCHEDULE) {
  throw new Error('JOB_CRON_SCHEDULE is not set');
}

/**
 * Initialize cron jobs
 */
export function initializeJobs(): void {

  cron.schedule(JOB_CRON_SCHEDULE!, async () => {
    await processPendingRegistrations();
  });
  
  logger.info('Job scheduler initialized');
}
