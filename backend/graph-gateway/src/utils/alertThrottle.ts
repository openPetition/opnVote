const recentAlerts = new Map<string, number>()

export function shouldAlert(key: string): boolean {
  const ttl = parseInt(process.env.ALERT_THROTTLE_MS || '60000')
  const last = recentAlerts.get(key)
  if (last && Date.now() - last < ttl) return false
  if (recentAlerts.size > 500) recentAlerts.clear()
  recentAlerts.set(key, Date.now())
  return true
}
