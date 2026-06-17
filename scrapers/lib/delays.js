// Human-like timing helpers. Anti-detection rule #3: random 3-12s delay
// between actions, never fixed intervals.

/** Sleep for a random duration in [minMs, maxMs]. Returns the ms waited. */
export async function humanDelay(minMs = 3000, maxMs = 12000) {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  await new Promise((resolve) => setTimeout(resolve, ms));
  return ms;
}

/** Random integer in [min, max] inclusive — handy for "view N profiles" caps. */
export function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/**
 * Business-hours guard (rule #5: 9am-6pm local only).
 * Returns true if the current local hour is within [startHour, endHour).
 */
export function isWithinBusinessHours(startHour = 9, endHour = 18, now = new Date()) {
  const h = now.getHours();
  return h >= startHour && h < endHour;
}
