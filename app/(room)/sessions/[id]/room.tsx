"use client";
import { useEffect, useRef, useState } from "react";
import { lanternRooms } from "@/modules/village/art/buildings";
import { Timer } from "./parts";

/**
 * The window strip (§8.5): the pixel world shrinks to the row of Lantern Rooms, with this room's lantern lit
 * while the lesson runs. No walking, no kitty, no notices — just where you are.
 */
export function RoomStrip({
  room,
  lit,
  children,
}: {
  room: number;
  lit: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const live = [0, 1, 2, 3].map((i) => lit && i === room);
    const p = lanternRooms(live);
    const c = document.createElement("canvas");
    c.width = p.w;
    c.height = p.h;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.w, p.h), 0, 0);
    const ctx = ref.current!.getContext("2d")!;
    ctx.fillStyle = "#a8cf8e";
    ctx.fillRect(0, 0, 128, 30);
    ctx.fillStyle = "#ddbd8f";
    ctx.fillRect(0, 26, 128, 4);
    // the façade band: windows, doors and lanterns (rows 18–47 of the art)
    ctx.drawImage(c, 0, 18, 128, 30, 0, 0, 128, 30);
  }, [room, lit]);
  return (
    <header className="sticky top-0 z-10 border-b-2 border-ink bg-paper">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2">
        <canvas
          ref={ref}
          width={128}
          height={30}
          role="img"
          aria-label={
            lit
              ? `Lantern Room ${room + 1}, lantern lit: your lesson is running`
              : `Lantern Room ${room + 1}, lantern out`
          }
          className="shrink-0"
          style={{ width: 256, height: 60, imageRendering: "pixelated" }}
        />
        {children}
      </div>
    </header>
  );
}

/**
 * Live: the video takes the screen. "Leave the room" swaps it for the two-sided confirm screen; messages and
 * "something wrong?" sit in a drawer so nothing competes with the call.
 */
export function LiveRoom({
  room,
  roomUrl,
  startedAt,
  lengthMin,
  title,
  sides,
  confirm,
  chat,
  wrong,
}: {
  room: number;
  roomUrl: string;
  startedAt: string | null;
  lengthMin: number;
  title: string;
  sides: React.ReactNode;
  confirm: React.ReactNode;
  chat: React.ReactNode;
  wrong: React.ReactNode;
}) {
  const [leaving, setLeaving] = useState(false);
  const [drawer, setDrawer] = useState(false);
  return (
    <div className="flex h-dvh flex-col bg-ink">
      <RoomStrip room={room} lit>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-pixel text-label">{title}</span>
          <span className="text-meta text-ink-soft">
            <Timer startedAt={startedAt} lengthMin={lengthMin} />
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!leaving ? (
            <>
              <button
                type="button"
                className="btn btn-tertiary"
                aria-expanded={drawer}
                aria-controls="room-drawer"
                onClick={() => setDrawer(!drawer)}
              >
                Messages
              </button>
              <a href={roomUrl} target="_blank" rel="noreferrer" className="btn btn-tertiary">
                New tab
              </a>
              <button type="button" className="btn btn-secondary" onClick={() => setLeaving(true)}>
                Leave the room
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-tertiary" onClick={() => setLeaving(false)}>
              Back to the call
            </button>
          )}
        </div>
      </RoomStrip>
      <div className="relative flex min-h-0 flex-1">
        {/* The iframe stays mounted while confirming, so stepping back doesn't drop the call. */}
        <iframe
          title="Video room"
          src={`${roomUrl}#config.prejoinPageEnabled=true`}
          allow="camera; microphone; display-capture; fullscreen; autoplay"
          className={`min-h-0 flex-1 bg-ink ${leaving ? "invisible" : ""}`}
        />
        {drawer && !leaving ? (
          <aside
            id="room-drawer"
            className="panel absolute top-3 right-3 bottom-3 grid w-[360px] max-w-[calc(100%-24px)] content-start gap-5 overflow-y-auto p-5 anim-sheet"
          >
            <div className="grid gap-3">
              <h2 className="font-pixel text-label">Messages</h2>
              {chat}
            </div>
            {wrong}
          </aside>
        ) : null}
        {leaving ? (
          <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-paper-shade p-4">
            <div className="panel grid w-full max-w-[640px] gap-5 p-6 anim-sheet">
              <h2 className="font-name text-name">Before you go</h2>
              {sides}
              {confirm}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
