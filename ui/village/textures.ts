import type Phaser from "phaser";
import type { VillagerLook } from "@/db/schema";
import * as B from "@/modules/village/art/buildings";
import {
  critter,
  fieldKitty,
  K_ANIMS,
  SHEET_FRAMES,
  V_ANIMS,
  type VAnim,
  VIEWS,
  villagerSheet,
} from "@/modules/village/art/people";
import type { Px } from "@/modules/village/art/pixels";
import { GUILDS } from "@/modules/village/guilds";
import { ICONS } from "@/ui/pixel/icon-art";

/** Px → canvas → Phaser texture. Every world sprite is real pixel art from the shared art module. */
export function toCanvas(p: Px) {
  const c = document.createElement("canvas");
  c.width = p.w;
  c.height = p.h;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.w, p.h), 0, 0);
  return c;
}

export function addPx(scene: Phaser.Scene, key: string, p: Px) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, toCanvas(p));
  return key;
}

/** Static place art by its map key. */
export function placeTexture(
  scene: Phaser.Scene,
  art: string,
  data: { notes: number; wishes: number; chimneys: string[]; liveRooms: number },
) {
  const key = `place:${art}`;
  let p: Px;
  if (art.startsWith("guild:")) {
    const g = GUILDS.find((x) => x.id === art.slice(6))!;
    p = B.guildHall(g, ICONS[g.icon], data.chimneys.includes(g.id));
  } else {
    const now = new Date();
    p =
      art === "tavern"
        ? B.tavern({})
        : art === "bank"
          ? B.bank()
          : art === "tower"
            ? B.clockTower(now.getHours(), now.getMinutes())
            : art === "hall"
              ? B.townHall()
              : art === "well"
                ? B.well(data.wishes, data.wishes > 0)
                : art === "board"
                  ? B.noticeBoard(data.notes)
                  : art === "lanterns"
                    ? B.lanternRooms([0, 1, 2, 3].map((i) => i < data.liveRooms))
                    : art === "gate"
                      ? B.gate()
                      : B.prop("bench");
  }
  return addPx(scene, key, p);
}

/** A villager's spritesheet: rows = down, up, right; left is the mirror of right. Cached by look. */
export function villagerTexture(scene: Phaser.Scene, look: VillagerLook) {
  const key = `villager:${JSON.stringify(look)}`;
  if (scene.textures.exists(key)) return key;
  const sheet = villagerSheet(look);
  const tex = scene.textures.addCanvas(key, toCanvas(sheet))!;
  VIEWS.forEach((v, row) => {
    SHEET_FRAMES.forEach(({ anim, f }, col) => {
      tex.add(`${v}:${anim}:${f}`, 0, col * 16, row * 32, 16, 32);
    });
  });
  for (const v of VIEWS)
    for (const a of Object.keys(V_ANIMS) as VAnim[]) {
      const ak = `${key}|${v}:${a}`;
      if (scene.anims.exists(ak)) continue;
      scene.anims.create({
        key: ak,
        frames: Array.from({ length: V_ANIMS[a] }, (_, f) => ({ key, frame: `${v}:${a}:${f}` })),
        frameRate: a === "walk" ? 10 : a === "idle" ? 2 : a === "sleep" || a === "read" ? 2 : 8,
        repeat: a === "wave" || a === "point" ? 0 : -1,
      });
    }
  return key;
}

/** The 16 × 16 field kitty for a genome. */
export function kittyTexture(scene: Phaser.Scene, code: string) {
  const key = `kitty:${code}`;
  if (scene.textures.exists(key)) return key;
  const views = ["down", "up", "right"] as const;
  const anims = Object.entries(K_ANIMS) as [keyof typeof K_ANIMS, number][];
  const cols = anims.reduce((a, [, n]) => a + n, 0);
  const c = document.createElement("canvas");
  c.width = cols * 16;
  c.height = views.length * 16;
  const ctx = c.getContext("2d")!;
  const tex = scene.textures.addCanvas(key, c)!;
  views.forEach((v, row) => {
    let col = 0;
    for (const [a, n] of anims)
      for (let f = 0; f < n; f++) {
        const p = fieldKitty(code, v, a, f);
        ctx.putImageData(new ImageData(new Uint8ClampedArray(p.data), 16, 16), col * 16, row * 16);
        tex.add(`${v}:${a}:${f}`, 0, col * 16, row * 16, 16, 16);
        col++;
      }
  });
  tex.refresh();
  for (const v of views)
    for (const [a, n] of anims) {
      const ak = `${key}|${v}:${a}`;
      if (!scene.anims.exists(ak))
        scene.anims.create({
          key: ak,
          frames: Array.from({ length: n }, (_, f) => ({ key, frame: `${v}:${a}:${f}` })),
          frameRate: a === "walk" ? 10 : 2,
          repeat: -1,
        });
    }
  return key;
}

export function critterTexture(scene: Phaser.Scene, kind: "chicken" | "duck" | "bird") {
  const key = `critter:${kind}`;
  if (scene.textures.exists(key)) return key;
  const a = critter(kind, 0);
  const b = critter(kind, 1);
  const c = document.createElement("canvas");
  c.width = a.w * 2;
  c.height = a.h;
  const ctx = c.getContext("2d")!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(a.data), a.w, a.h), 0, 0);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(b.data), b.w, b.h), a.w, 0);
  const tex = scene.textures.addCanvas(key, c)!;
  tex.add("0", 0, 0, 0, a.w, a.h);
  tex.add("1", 0, a.w, 0, a.w, a.h);
  scene.anims.create({
    key: `${key}|go`,
    frames: [
      { key, frame: "0" },
      { key, frame: "1" },
    ],
    frameRate: kind === "bird" ? 6 : 3,
    repeat: -1,
  });
  return key;
}
