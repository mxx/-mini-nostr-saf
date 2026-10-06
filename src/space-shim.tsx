/**
 * Local replacements for `@hatch/space-sdk/client` (not available in napplets).
 */
import type { CSSProperties } from "react";

/** Minimal top safe-area scrim (replaces the SDK's SafeAreaTopScrim). */
export function SafeAreaTopScrim({ backgroundColor }: { backgroundColor?: string }) {
  const style: CSSProperties = {
    position: "sticky",
    top: 0,
    height: "env(safe-area-inset-top, 0px)",
    backgroundColor,
    zIndex: 50,
  };
  return <div style={style} aria-hidden="true" />;
}
