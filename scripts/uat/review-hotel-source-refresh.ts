import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import facts from "../fixtures/agentic-hotel-constraints.json";
import {
  reviewHotelSourceRefresh,
  type HotelSourcePage,
} from "./lib/hotel-evidence-refresh";

const input = process.argv[2];
if (!input) throw new Error("Retrieved hotel source pages JSON required");
const bytes = readFileSync(input);
if (bytes.length > 3_000_000)
  throw new Error("Source batch exceeds review limit");
const pages = JSON.parse(bytes.toString()) as HotelSourcePage[];
if (!Array.isArray(pages)) throw new Error("Source page array required");
console.log(
  JSON.stringify(
    {
      inputSha256: createHash("sha256").update(bytes).digest("hex"),
      evidenceSha256: createHash("sha256")
        .update(
          readFileSync(
            join(
              import.meta.dirname,
              "../fixtures/agentic-hotel-constraints.json",
            ),
          ),
        )
        .digest("hex"),
      implementationSha256: createHash("sha256")
        .update(readFileSync(import.meta.filename))
        .update(
          readFileSync(
            join(import.meta.dirname, "lib/hotel-evidence-refresh.ts"),
          ),
        )
        .digest("hex"),
      modelCalls: 0,
      ...reviewHotelSourceRefresh(facts, pages, new Date().toISOString()),
    },
    null,
    2,
  ),
);
