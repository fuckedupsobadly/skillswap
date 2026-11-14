"use client";
import { useEffect } from "react";

/**
 * Presence heartbeat from any page (§4): online while a tab is open; any key, click or scroll in the last
 * 10 minutes keeps you out of AFK. Nothing else is inferred.
 */
export function Heartbeat() {
  useEffect(() => {
    let input = true;
    const mark = () => {
      input = true;
    };
    const send = () => {
      if (document.hidden) return;
      void fetch(`/api/v1/village/ping?input=${input ? 1 : 0}`, { method: "POST", keepalive: true }).catch(
        () => {},
      );
      input = false;
    };
    for (const e of ["keydown", "pointerdown", "wheel", "touchstart"])
      window.addEventListener(e, mark, { passive: true });
    send();
    const t = window.setInterval(send, 60_000);
    return () => {
      clearInterval(t);
      for (const e of ["keydown", "pointerdown", "wheel", "touchstart"]) window.removeEventListener(e, mark);
    };
  }, []);
  return null;
}
