## Blob, a softbody physics simulation in Rust + WASM

[View Demo Here](https://blob.gkaemmer.com)

<img src="screenshot.png" />

Blob is animated by calls to WASM. The coordinates and velocities of each vertex are shared between Rust and Javascript. Every frame, the physics code is run 40 times, and the positions of each vertex are sampled for rendering.

Rendering is done with a few SVG polygons.

### `rustLoader.js`

SoftBody.js `require()`s the rust source code directly, and the import is managed by a webpack loader that runs the rust compiler (to the `wasm32-unknown-unknown` target). It grabs the WASM byte code and creates Javascript glue code automatically.
