## Blob, a softbody physics simulation in Rust + WASM

[View Demo Here](https://blob.gkaemmer.com)

<img src="screenshot.png" />

Blob is simulated by calls to WASM. The coordinates and velocities of each vertex are shared between Rust and Javascript. Every frame, the physics code is run 40 times, and the positions of each vertex are sampled for rendering.

Rendering is done with a few SVG polygons in React.

The site uses Next.js and doesn't really need to, but it really cuts down boilerplate.

### `rustLoader.js`

SoftBody.js `require()`s the rust source code directly, and the import is managed by a webpack loader that runs the rust compiler (to the `wasm32-unknown-unknown` target). It grabs the WASM byte code and creates Javascript glue code automatically.

### Sharing data with WASM

For a blob with 50 sides, the shared data is a Float64Array with 250 (50 * 5) numbers in it. In rust, this memory is passed in as a `*mut Vertex`, and turned into a `&mut [Vertex]` with `slice::from_raw_parts_mut`. Then, the `init` and `step` functions can edit the data freely.

The javascript must know how that array is structured. To make interaction and rendering easier, the coordinates are copied every frame:
```js
for (let i = 0; i < this.vertexCount; i++) {
  // Vertex is stored as five floats at vertexData[i * 5];
  this.vertices[i].x = this.vertexData[i * 5 + 0];
  this.vertices[i].y = this.vertexData[i * 5 + 1];
}
```

From there, Javascript can handle the rendering and events, while Rust handles all the number crunching.
