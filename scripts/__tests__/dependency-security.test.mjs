import { test, expect } from "bun:test";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const queryRequire = createRequire(require.resolve("query-string"));
const decoderPath = queryRequire.resolve("decode-uri-component");
const decode = queryRequire("decode-uri-component");

test("URI decoder backport preserves CommonJS and mobile query decoding", () => {
  for (const [input, output] of [
    ["Lisbon+city", "Lisbon city"],
    ["a%2Bb", "a+b"],
    ["Bel%C3%A9m", "Belém"],
    ["%E2%82%AC", "€"],
    ["%F0%9F%98%80", "😀"],
    ["%zz", "%zz"],
    ["%FE%FF", "��"],
    ["%C2", "�"],
    ["%C3%A5%zz", "å%zz"],
    ["%2520%zz", "%20%zz"],
  ])
    expect(decode(input)).toBe(output);
  expect(() => decode(null)).toThrow(TypeError);
  expect(
    require("query-string").parse("destination=Bel%C3%A9m&note=a%2Bb"),
  ).toEqual({ destination: "Belém", note: "a+b" });
});

test("malformed URI runs finish within a bounded subprocess", () => {
  // Regression input stays in a disposable process: a regression cannot hang CI.
  const script = `const decode = require(process.argv[1]);
    let input = '';
    for (let i = 0; i < 32000; i++) input += '%' + Math.floor(i/256).toString(16).padStart(2,'0') + '%' + (i%256).toString(16).padStart(2,'0') + 'x';
    const result = decode(input + '%zz');
    if (!result.endsWith('%zz')) process.exit(1);`;
  const result = spawnSync(
    process.env.NODE_BINARY ?? "node",
    ["-e", script, decoderPath],
    {
      timeout: 5000,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
});

test("deepmerge preserves data without changing result prototypes", () => {
  const merge = require("deepmerge");
  const payload = JSON.parse(
    '{"__proto__":{"poisoned":true},"nested":{"safe":1}}',
  );
  for (const result of [
    merge(payload, {}),
    merge({}, payload),
    merge(Object.create(null), payload),
  ]) {
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.poisoned).toBeUndefined();
    expect(result.nested.safe).toBe(1);
  }
  expect(
    merge({ list: [1], nested: { a: 1 } }, { list: [2], nested: { b: 2 } }),
  ).toEqual({ list: [1, 2], nested: { a: 1, b: 2 } });
});

test("Metro image-size keeps its callable API and rejects non-progressing image boxes", () => {
  const metroRequire = createRequire(require.resolve("metro/package.json"));
  const imagePath = metroRequire.resolve("image-size");
  const size = metroRequire("image-size");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  );
  expect(size(png)).toMatchObject({ width: 1, height: 1, type: "png" });
  const script = `const size = require(process.argv[1]);
    const icns = Buffer.alloc(16); icns.write('icns'); icns.writeUInt32BE(16,4); icns.write('icp4',8);
    const heif = Buffer.alloc(24); heif.writeUInt32BE(16); heif.write('ftyp',4); heif.write('heic',8); heif.write('meta',20);
    const jxl = Buffer.alloc(40); jxl.writeUInt32BE(12); jxl.write('JXL ',4); jxl.writeUInt32BE(20,12); jxl.write('ftyp',16); jxl.write('jxl ',20); jxl.write('jxlp',36);
    for (const input of [icns, heif, jxl]) { let threw = false; try { size(input); } catch { threw = true; } if (!threw) process.exit(1); }`;
  const result = spawnSync(
    process.env.NODE_BINARY ?? "node",
    ["-e", script, imagePath],
    {
      timeout: 5000,
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
});

test("Workflow nanoid backport rejects unsafe pool sizes and bounds non-secure generation", () => {
  const runtimeRequire = createRequire(require.resolve("@workflow/core"));
  const securePath = runtimeRequire.resolve("nanoid");
  const nonSecurePath = runtimeRequire.resolve("nanoid/non-secure");
  const script = `const secure = await import(process.argv[1]);
    const nonSecure = await import(process.argv[2]);
    for (const size of [1024, -1, 2147483648]) {
      let threw = false; try { secure.nanoid(size); } catch { threw = true; }
      if (!threw) process.exit(1);
      if (!/^[A-Za-z0-9_-]{21}$/.test(secure.nanoid())) process.exit(2);
    }
    if (nonSecure.nanoid(-1) !== '' || nonSecure.customAlphabet('abc')(-1) !== '') process.exit(3);`;
  const result = spawnSync(
    process.env.NODE_BINARY ?? "node",
    ["--input-type=module", "-e", script, securePath, nonSecurePath],
    { timeout: 5000, encoding: "utf8", env: { PATH: process.env.PATH } },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
});
