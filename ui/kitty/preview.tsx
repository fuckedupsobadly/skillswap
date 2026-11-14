"use client";
import { useEffect, useRef } from "react";
import type { Stage } from "@/modules/game/genome";
import type { Slot } from "@/modules/game/ranks";
import { ANIMS, type AnimName } from "@/modules/game/rig/anim";
import { FRAME } from "@/modules/game/rig/raster";
import { Compositor, drawRoom, ROOM_H, ROOM_W } from "./compositor";

/**
 * A kitty on its own small canvas: adoption cards, the wardrobe, profile cards and the dev sheet.
 * Idle breathing with an occasional blink; `anim` pins one animation; `still` draws a single frame.
 */
export function KittyPreview({
  code,
  stage = "kitten",
  equipped = {},
  scale = 3,
  anim,
  frame = 0,
  still = false,
  room,
  label,
  facing = 1,
}: {
  code: string;
  stage?: Stage;
  equipped?: Partial<Record<Slot, string>>;
  scale?: number;
  anim?: AnimName;
  frame?: number;
  still?: boolean;
  room?: { theme: "cozy" | "twilight"; item?: string; bed?: string };
  label: string;
  facing?: 1 | -1;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(equipped);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const comp = new Compositor({ code, stage, equipped: JSON.parse(key) });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let current: AnimName = anim ?? "idle";
    let i = still ? frame : 0;
    let tick = 0;
    let timer = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (room) {
        drawRoom(ctx, room.theme, room.item, room.bed);
        ctx.drawImage(
          comp.frame(current, i, facing, tick) as CanvasImageSource,
          (ROOM_W - FRAME) / 2,
          ROOM_H - FRAME - 4,
        );
      } else ctx.drawImage(comp.frame(current, i, facing, tick) as CanvasImageSource, 0, 0);
    };
    render();
    if (still || reduced) return;
    const step = () => {
      const def = ANIMS[current];
      i++;
      tick++;
      if (i >= def.frames.length) {
        i = 0;
        if (!anim) current = current === "idle" && Math.random() < 0.18 ? "blink" : "idle";
        else if (!def.loop) current = anim;
      }
      render();
      timer = window.setTimeout(step, 1000 / ANIMS[current].fps);
    };
    timer = window.setTimeout(step, 1000 / ANIMS[current].fps);
    return () => clearTimeout(timer);
  }, [code, stage, key, anim, frame, still, room?.theme, room?.item, room?.bed, facing, room]);

  const w = room ? ROOM_W : FRAME;
  const h = room ? ROOM_H : FRAME;
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      role="img"
      aria-label={label}
      style={{ width: w * scale, height: h * scale, imageRendering: "pixelated" }}
      className="block"
    />
  );
}
