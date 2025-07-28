import winston from 'winston'

export const logger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
})

interface LogInfo {
  level: string
  message: string
  [key: string]: any
}

const error = (message: string | Error, meta?: any): winston.Logger => {
  const logInfo: LogInfo = {
    level: 'error',
    message: message instanceof Error ? message.message : message,
    ...meta,
  }

  if (message instanceof Error) {
    logInfo.stack = message.stack
  }

  return logger.log(logInfo)
}

const warn = (message: string, meta?: any): winston.Logger => {
  return logger.log({
    level: 'warn',
    message,
    ...meta,
  })
}

const info = (message: string, meta?: any): winston.Logger => {
  return logger.log({
    level: 'info',
    message,
    ...meta,
  })
}

export const customLogger = {
  error,
  warn,
  info,
  log: logger.log.bind(logger),
}
