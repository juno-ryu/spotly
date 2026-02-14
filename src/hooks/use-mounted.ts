"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** 클라이언트 하이드레이션 완료 여부를 반환 */
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
