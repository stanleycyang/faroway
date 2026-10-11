import { readFile } from "node:fs/promises";
import {
  LiteApiSearchSchema,
  searchLiteApiHotels,
} from "../lib/affiliates/liteapi";

// Use a separately configured sandbox key, never a production key.
const file = process.argv[2];
if (!file)
  throw new Error(
    "Usage: bun scripts/check-liteapi-sandbox.ts <search-input.json>",
  );
const input = LiteApiSearchSchema.parse(
  JSON.parse(await readFile(file, "utf8")),
);
const result = await searchLiteApiHotels(input);
console.log(
  JSON.stringify({
    sandbox: result.sandbox,
    hotels: result.data.length,
    offers: result.data.reduce(
      (count, hotel) => count + hotel.roomTypes.length,
      0,
    ),
  }),
);
