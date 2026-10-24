export function waitingTimeMessage(queuedAt: string, now: number) {
  const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(queuedAt)) / 1_000))

  if (elapsedSeconds < 60) {
    return `Waiting for ${elapsedSeconds} ${elapsedSeconds === 1 ? 'second' : 'seconds'}.`
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) {
    return `Waiting for about ${elapsedMinutes} ${elapsedMinutes === 1 ? 'minute' : 'minutes'}.`
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  return `Waiting for about ${elapsedHours} ${elapsedHours === 1 ? 'hour' : 'hours'}.`
}
