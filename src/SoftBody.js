import React from "react";
import BlobSVG from "./BlobSVG";
import BlobCanvas from "./BlobCanvas";

// Only require physics and gyronorm in the browser
let physicsWasm, GyroNorm;
if (process.browser) {
  physicsWasm = require("./physics.rs");
  GyroNorm = require("../node_modules/gyronorm/dist/gyronorm.complete.min");
}

// Calculate physics many times per frame, to help with stability
let stepsPerFrame = 40;
let vertexCount = 50;
let radius = 100;

// Because -2 % n = -2, rather than n - 2
function modulo(n, m) {
  return (n % m + m) % m;
}

class Body {
  constructor(vertexCount, radius) {
    this.vertexCount = vertexCount;
    this.radius = radius;
    this.prepare();
  }

  async prepare() {
    const instance = await physicsWasm.prepare({
      env: {
        log: console.log.bind(console),
        cos: Math.cos,
        sin: Math.sin
      }
    });
    this.module = {};
    this.module.alloc = instance.exports.alloc;
    this.module.dealloc = instance.exports.dealloc;
    this.module.step = instance.exports.step;
    this.module.init = instance.exports.init;
    this.instance = instance;
    this.reset();
    if (this.onReady) this.onReady();
  }

  reset() {
    this.vertices = [];
    this.isMouseDown = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.gravX = 0;
    this.gravY = 1;
    this.centerX = 0;
    this.centerY = 0;
    this.keys = { left: false, right: false, up: false, down: false };
    for (let i = 0; i < vertexCount; i++) this.vertices.push({ x: 0, y: 0 });
    if (this.vertexData) this.teardown();
    this.pointer = this.module.alloc(this.vertexCount);

    // This array is shared with WASM
    this.vertexData = new Float64Array(
      this.instance.exports.memory.buffer,
      this.pointer,
      this.vertexCount * 5
    );
    this.module.init(this.pointer, this.vertexCount, this.radius);
    this.isPrepared = true;
  }

  handleDrag(clientX, clientY) {
    this.mouseX = clientX - window.innerWidth / 2;
    this.mouseY = clientY - window.innerHeight / 2;
    if (!this.isMouseDown) {
      // Calculate drag lengths
      for (let i = 0; i < this.vertexCount; i++) {
        const dx = this.mouseX - this.vertexData[i * 5 + 0];
        const dy = this.mouseY - this.vertexData[i * 5 + 1];
        const d = Math.sqrt(dx * dx + dy * dy);
        this.vertexData[i * 5 + 4] = d;
      }
      this.isMouseDown = true;
    }
  }

  stopDrag() {
    this.isMouseDown = false;
    // Reset drag lengths to radius
    for (let i = 0; i < this.vertexCount; i++) {
      this.vertexData[i * 5 + 4] = this.radius;
    }
  }

  update() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const { isDragging, dragX, dragY } = this;

    if (!this.isPrepared) return;

    for (let i = 0; i < stepsPerFrame; i++) {
      // Calculate many times per frame
      this.module.step(
        this.pointer,
        this.vertexCount,
        this.radius,
        width,
        height,
        this.gravX,
        this.gravY,
        this.vx,
        this.vy,
        this.isMouseDown,
        this.mouseX,
        this.mouseY,
        1.0 / stepsPerFrame
      );
    }
    this.centerX = 0;
    this.centerY = 0;
    for (let i = 0; i < this.vertexCount; i++) {
      // Grab vertex data from shared memory
      this.vertices[i].x = this.vertexData[i * 5 + 0];
      this.vertices[i].y = this.vertexData[i * 5 + 1];
      if (isNaN(this.vertices[i].x)) return this.reset(); // It blew up, reset
      this.centerX += this.vertices[i].x;
      this.centerY += this.vertices[i].y;
    }
    this.centerX /= this.vertexCount;
    this.centerY /= this.vertexCount;
  }

  teardown() {
    this.module.dealloc(this.pointer, this.vertexCount * 5);
  }

  get vx() {
    let vx = 0;
    if (this.keys.left) vx -= 1;
    if (this.keys.right) vx += 1;
    return vx;
  }

  get vy() {
    let vy = 0;
    if (this.keys.up) vy -= 1;
    if (this.keys.down) vy += 1;
    return vy;
  }
}

let origin = {
  x: 0,
  y: 0
};

export default class SoftBody extends React.Component {
  state = {
    render: "svg"
  };

  update = () => {
    this.body.update();
    requestAnimationFrame(this.update);
  };

  startDrag = e => {
    e.preventDefault();
    let moveHandler, endHandler, moveEvent, endEvent;
    if (e.touches) {
      // Use touch events
      moveHandler = e => {
        this.body.handleDrag(e.touches[0].clientX, e.touches[0].clientY);
      };
      moveEvent = "touchmove";
      endEvent = "touchend";
    } else {
      moveHandler = e => {
        this.body.handleDrag(e.clientX, e.clientY);
      };
      moveEvent = "mousemove";
      endEvent = "mouseup";
    }
    moveHandler(e);
    window.addEventListener(moveEvent, moveHandler);
    window.addEventListener(
      endEvent,
      (endHandler = e => {
        this.body.stopDrag();
        window.removeEventListener(moveEvent, moveHandler);
        window.removeEventListener(endEvent, endHandler);
      })
    );
  };

  handleDeviceOrientation = data => {
    if (!data.do.alpha) return;
    // This took a lot of guess and check
    const yaw = -data.do.gamma * Math.PI / 180;
    const pitch = data.do.alpha * Math.PI / 180;
    const roll = data.do.beta * Math.PI / 180;
    const { cos, sin } = Math;

    const x = -cos(yaw) * sin(pitch) * sin(roll) - sin(yaw) * cos(roll);
    const y = cos(yaw) * sin(roll);
    // const z = -sin(yaw)*sin(pitch)*sin(roll)+cos(yaw)*cos(roll);

    this.body.gravX = 3 * x;
    this.body.gravY = 3 * y;
  };

  handleKey = e => {
    const val = e.type === "keydown" ? true : false;
    if (e.code === "ArrowLeft") this.body.keys.left = val;
    if (e.code === "ArrowRight") this.body.keys.right = val;
    if (e.code === "ArrowUp") this.body.keys.up = val;
    if (e.code === "ArrowDown") this.body.keys.down = val;
  };

  componentDidMount() {
    this.body = new Body(vertexCount, radius);
    this.body.onReady = () => this.forceUpdate();
    document.addEventListener("keydown", this.handleKey);
    document.addEventListener("keyup", this.handleKey);
    const gn = new GyroNorm();
    gn.init().then(() => gn.start(this.handleDeviceOrientation));
    requestAnimationFrame(this.update);
  }

  componentWillUnmount() {
    this.body.teardown();
  }

  preventDefault = e => e.preventDefault();

  render() {
    if (!this.body || !this.body.vertices) return null;

    const Blob = this.state.render === "canvas" ? BlobCanvas : BlobSVG;
    return (
      <div>
        <style jsx>{`
          .help {
            position: absolute;
            z-index: 10;
            text-align: right;
            padding: 15px;
            font-family: system-ui, Helvetica, sans-serif;
            line-height: 1.5em;
            color: #aaa;
            width: 100%;
            box-sizing: border-box;
          }
          .help a {
            color: #67f;
          }
        `}</style>
        <div className="help">
          {innerWidth > 400 && (
            <span>
              Arrow keys to move<br />
            </span>
          )}
          <span>Drag to throw</span><br />
          Render using:{" "}
          {this.state.render === "canvas" ? (
            <span>Canvas</span>
          ) : (
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                this.setState({ render: "canvas" });
              }}
            >
              Canvas
            </a>
          )}
          {" | "}
          {this.state.render === "svg" ? (
            <span>SVG</span>
          ) : (
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                this.setState({ render: "svg" });
              }}
            >
              SVG
            </a>
          )}
        </div>
        <Blob body={this.body} onDragStart={this.startDrag} />
      </div>
    );
  }
}
