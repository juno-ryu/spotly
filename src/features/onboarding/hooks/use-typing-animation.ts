"use client";

import { useEffect, useState } from "react";

/** 타이핑 속도 (ms/글자) */
const DEFAULT_SPEED = 50;

/** 채팅처럼 한 글자씩 텍스트를 표시하는 훅 */
export function useTypingAnimation(
  text: string,
  speed: number = DEFAULT_SPEED,
  enabled: boolean = true,
) {
  const [displayText, setDisplayText] = useState("");
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDisplayText("");
      setIsDone(false);
      return;
    }

    const chars = Array.from(text);
    let index = 0;
    setDisplayText("");
    setIsDone(false);

    const interval = setInterval(() => {
      index++;
      setDisplayText(chars.slice(0, index).join(""));
      if (index >= chars.length) {
        clearInterval(interval);
        setIsDone(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, enabled]);

  return { displayText, isDone };
}
