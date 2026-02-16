/** Android Chrome/Firefox 전용 — iOS Safari 미지원 (progressive enhancement) */
export function hapticLight() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(30);
  }
}
