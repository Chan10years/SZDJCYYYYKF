# demoparser2 WASM provenance

These generated browser assets are copied without modification from the
official [LaihoE/demoparser](https://github.com/LaihoE/demoparser) repository,
revision `2d0f3b3a55d9830bef296e3f0003973fccf17849`, under its MIT license.

Source files:

- `src/wasm/www/pkg/demoparser2.js`
- `src/wasm/www/pkg/demoparser2_bg.wasm`

The upstream `LICENSE` text applies to these generated assets. The browser
worker uses this parser only for the local-first import attempt. If the WASM
parser cannot read a current Demo, the product explicitly switches to the
existing Next application runtime's official native `@laihoe/demoparser2`
binding; it never substitutes a repository fixture.
