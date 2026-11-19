# Workflow dependency security review — 14 November 2026

The runtime remains Workflow 4.6.2. Its serializer dependency is overridden to
devalue 5.9.3, the patched version identified by the
[upstream advisory](https://github.com/advisories/GHSA-r9w8-h9r3-54w4).
Only this resolved package changed. Lifecycle scripts were disabled during the
small dependency install; no app build or deployment ran.

Before changing the installed dependency, 28 old/new cross-version serialization
checks passed using Workflow's actual reducers and revivers. Values included
trip timing metadata, byte arrays, an empty buffer, a date in a map, sets,
BigInt, undefined and NaN. The committed regression resolves devalue from the
runtime and covers supported values plus rejection of an invalid custom
ArrayBuffer reviver. These checks do not replace a compiled Workflow run.

A nanoid 5.1.16 override was rejected and restored to the original pin: the same
deterministic byte stream produced different IDs than nanoid 5.1.6. Workflow
uses customRandom with a fixed length of 21. This narrows the exposure of its
specific call but does not constitute a dependency-wide exemption. A replay
sequence fixture now makes this compatibility risk visible during future
upgrades. Resolve the remaining advisory through an upstream-compatible update
and replay migration assessment rather than blindly overriding the dependency.

The refreshed audit reported 20 findings (11 high, 7 moderate, 2 low) across
11 package groups, with no devalue findings. It includes two newly reported
Vitest mocker findings, so it is not directly comparable to the older audit
total by subtraction. Findings remain for provider-utils, Vitest mocker,
decode-uri-component, deepmerge, glob, image-size, minimatch, nanoid,
postcss-selector-parser, uuid and zod. No blanket reachability exemption or
production security pass is claimed.

After the serializer update, the 30 planning-workflow tests and all 255 script
tests passed, including the deterministic replay fixture. Scripts TypeScript,
focused formatting and `git diff --check` also passed.
Compiled/build verification remains pending adequate disk capacity. Preserve
the merge hold while security and traveler-quality acceptance remain open.
