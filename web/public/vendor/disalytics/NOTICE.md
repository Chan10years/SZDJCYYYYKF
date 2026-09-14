# Browser-local Demo parser asset

`parser-worker.js` is a generated browser asset copied from the MIT-licensed
[disalytics](https://github.com/oleksii-latyshev/disalytics) deployment at
revision `02afbf3c46541a27074a6fe919d18d50fc3253a2` (2026-09-14). Its vendored
parser is the MIT-licensed [LaihoE/demoparser](https://github.com/LaihoE/demoparser)
revision `ba39cc44cd5abfd7f34df2b3c0a7dd3630048311`, including the upstream
browser/WASM compatibility patches documented by disalytics in `vendor/README.md`.

The accompanying `demo_parser_wasm_bg-DPsvRw4-.wasm` is the matching generated
WASM artifact. Connected Decisions does not modify the parser asset. The
product-owned `public/workers/demoParserWorker.js` is only a local protocol and
normalization adapter: it never uploads the source Demo and never substitutes a
fixture when parsing is unsupported.

The upstream projects are distributed under the MIT license. This notice keeps
the exact source, revision, and local adapter boundary explicit for future asset
updates.
