import { mkdirSync, writeFileSync } from "node:fs";
import { drawTileset } from "@/modules/village/art/tiles";
import { tiledMap } from "@/modules/village/map";
import { encodePng } from "./png";

/** Writes the Tiled map and tileset the village loads (and that open in the Tiled editor). */
mkdirSync("public/village", { recursive: true });
const ts = drawTileset();
writeFileSync("public/village/tiles.png", encodePng(ts.w, ts.h, new Uint8Array(ts.data.buffer)));
writeFileSync("public/village/village.json", JSON.stringify(tiledMap()));
console.log(`wrote public/village/tiles.png (${ts.w}x${ts.h}) and village.json`);
