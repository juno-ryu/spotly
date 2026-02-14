/** 한글 초성 배열 */
const CHOSUNG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ",
  "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

/** 한글 음절에서 초성 추출 */
function getChosung(char: string): string {
  const code = char.charCodeAt(0);
  // 한글 음절 범위 (가 ~ 힣)
  if (code < 0xac00 || code > 0xd7a3) return char;
  return CHOSUNG[Math.floor((code - 0xac00) / 588)];
}

/** 문자열에서 초성만 추출 */
export function extractChosung(str: string): string {
  return Array.from(str).map(getChosung).join("");
}

/** 입력이 초성으로만 구성되어 있는지 확인 */
function isChosungOnly(str: string): boolean {
  return Array.from(str).every((ch) => CHOSUNG.includes(ch));
}

/** 한글 퍼지 검색 — 이름/키워드 매칭 + 초성 검색 지원 */
export function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();

  // 일반 포함 검색
  if (t.includes(q)) return true;

  // 초성 검색 (입력이 ㅊㅋ 같은 초성일 때)
  if (isChosungOnly(q)) {
    const targetChosung = extractChosung(t);
    return targetChosung.includes(q);
  }

  return false;
}
