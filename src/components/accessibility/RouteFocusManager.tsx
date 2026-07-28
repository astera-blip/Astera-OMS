"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function RouteFocusManager({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLDivElement>(null);
  const initialPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== initialPath.current) {
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [pathname]);

  return (
    <div id="main-content" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
      {children}
    </div>
  );
}
