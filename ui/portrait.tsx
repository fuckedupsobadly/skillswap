"use client";
import { useEffect, useRef } from "react";
import type { VillagerLook } from "@/db/schema";
import { villagerFrame } from "@/modules/village/art/people";

/** A 48 × 48 portrait: the villager's head and shoulders, cropped from the front frame at 3×. */
export function Portrait({ look, size = 48, label }: { look: VillagerLook; size?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(look);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const p = villagerFrame(JSON.parse(key), "down", "idle", 0);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = "#eadfcb";
    ctx.fillRect(0, 0, 16, 16);
    const img = new ImageData(new Uint8ClampedArray(p.data), 16, 32);
    const tmp = document.createElement("canvas");
    tmp.width = 16;
    tmp.height = 32;
    tmp.getContext("2d")!.putImageData(img, 0, 0);
    ctx.drawImage(tmp, 0, 3, 16, 16, 0, 0, 16, 16);
  }, [key]);
  return (
    <canvas
      ref={ref}
      width={16}
      height={16}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}
