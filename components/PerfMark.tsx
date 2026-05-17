"use client";

import { useEffect } from "react";

export default function PerfMark({ mark }: { mark: string }) {
  useEffect(() => {
    if (typeof performance !== "undefined") {
      performance.mark(mark);
    }
  }, [mark]);
  return null;
}
