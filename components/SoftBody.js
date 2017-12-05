import React from "react";

let physicsWasm;
if (process.browser) {
  physicsWasm = require("./physics.rs");
}

class Vertex {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

const gravity = 5;
const tension = 0.00001;
const pressure = 10;
const friction = 0.99;
const bounce = 0.2;

function mod(n, m) {
  return ((n % m) + m) % m;
}

function cap(x, max) {
  if (x > max) return max;
  if (x < -max) return -max;
  return x;
}

// class Body {
//   vertices = [];
//   constructor(verticesCount, centerX, centerY, radius) {
//     let rads = 0;
//     this.radius = radius;
//     this.restingEdgeLength = radius * 2 * Math.PI / verticesCount / 10;
//     for (let i = 0; i < verticesCount; i++) {
//       this.vertices.push(new Vertex(centerX + radius * Math.cos(rads), centerY + radius * Math.sin(rads)));
//       rads += 2 * Math.PI / verticesCount;
//     }
//   }

//   update() {
//     let vertices = this.vertices;
//     let length = vertices.length;
//     let axs = [];
//     let ays = [];
//     for (let i = 0; i < length; i++) {
//       // sum forces
//       let ax = 0;
//       let ay = gravity/length;
//       let vertexI = vertices[i];
//       let avgxi = vertexI.x + vertexI.vx / 2;
//       let avgyi = vertexI.y + vertexI.vy / 2;

//       for (let j = 0; j < length; j++) {
//         if (i === j) continue;
//         let vertexJ = vertices[j];
//         let avgxj = vertexJ.x + vertexJ.vx / 2;
//         let avgyj = vertexJ.y + vertexJ.vy / 2;
//         const dx = vertexJ.x - vertexI.x;
//         const dy = vertexJ.y - vertexI.y;
//         const d2 = dx * dx + dy * dy;
//         const angle = Math.atan2(dy, dx);
//         if (j === mod(i + 1, length) || j === mod(i - 1, length)) {
//           // pull vertex i towards vertex j
//           ax += Math.cos(angle) * (d2 - this.restingEdgeLength * this.restingEdgeLength) * tension;
//           ay += Math.sin(angle) * (d2 - this.restingEdgeLength * this.restingEdgeLength) * tension;
//         } else {
//           // push vertex i away from vertex j
//           ax -= Math.cos(angle) * pressure / (d2 - this.radius * this.radius) / length;
//           ay -= Math.sin(angle) * pressure / (d2 - this.radius * this.radius) / length;
//         }
//       }

//       if (vertexI.y > 400) {
//         ay -= (vertexI.y - 400) * bounce;
//       }
//       axs.push(cap(ax, 10));
//       ays.push(cap(ay, 10));
//     }

//     for (let i = 0; i < length; i++) {
//       let vertexI = vertices[i];
//       vertexI.vx += axs[i];
//       vertexI.vy += ays[i];
//       vertexI.x += vertexI.vx;
//       vertexI.y += vertexI.vy;
//       vertexI.vx *= friction;
//       vertexI.vy *= friction;
//     }
//   }
// }

let speed = 2000;

class Body {
  constructor(vertexCount, radius) {
    this.vertexCount = vertexCount;
    this.radius = radius;
    this.vertices = [];
    for (let i = 0; i < vertexCount; i++)
      this.vertices.push(new Vertex(0, 0));
    if (process.browser) {
      window.vertices = this.vertices;
      this.prepare();
    }
  }

  async prepare() {
    const instance = await physicsWasm.prepare({ env: { log: console.log.bind(console), log_vertex: console.log.bind(console), cos: Math.cos, sin: Math.sin } });
    this.module = {};
    this.module.alloc = instance.exports.alloc;
    this.module.dealloc = instance.exports.dealloc;
    this.module.step = instance.exports.step;
    this.module.init = instance.exports.init;
    this.instance = instance;
    this.pointer = this.module.alloc(this.vertexCount);
    this.vertexData = new Float64Array(instance.exports.memory.buffer, this.pointer, this.vertexCount * 4);
    window.vertexData = this.vertexData;
    this.module.init(this.pointer, this.vertexCount, this.radius);
  }

  update() {
    for (let i = 0; i < speed; i++) {
      this.module.step(this.pointer, this.vertexCount, this.radius, 30.0/speed);
    }
    for (let i = 0; i < this.vertexCount; i++) {
      this.vertices[i].x = this.vertexData[i * 4 + 0];
      this.vertices[i].y = this.vertexData[i * 4 + 1];
    }
  }

  teardown() {
    this.module.dealloc(this.pointer, this.vertexCount * 4);
  }
}

let adjust = 0;
let origin = {
  x: 0,
  y: 0
}

export default class SoftBody extends React.Component {
  body = new Body(25, 50);

  update = () => {
    this.body.update();
    this.forceUpdate();
    requestAnimationFrame(this.update);
  }

  componentDidMount() {
    origin.x = window.innerWidth / 2;
    origin.y = window.innerHeight / 2;
    requestAnimationFrame(this.update);
  }

  componentWillUnmount() {
    this.body.teardown();
  }

  render() {

    return <div className="stage">
      <style jsx>{`
        .stage {
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
        }
        .edge {
          position: absolute;
          border-top: 2px solid black;
          transform-origin: 0 0;
        }
      `}</style>
      {this.body.vertices.map((vertex, i) => {
        const lastVertex = this.body.vertices[mod(i - 1, this.body.vertices.length)];
        const dx = vertex.x - lastVertex.x;
        const dy = vertex.y - lastVertex.y;
        const width = Math.sqrt(dx * dx + dy * dy);
        const rotation = Math.atan2(dy, dx);
        return <div className="edge" key={i} style={{
          top: origin.y + lastVertex.y,
          left: origin.x + lastVertex.x,
          width,
          transform: "rotate(" + rotation + "rad)"
        }} />
      })}
    </div>
  }
}
