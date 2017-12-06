import React from "react";

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
    if (process.browser) {
      window.vertices = this.vertices;
      this.prepare();
    }
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
    this.pointer = this.module.alloc(this.vertexCount);

    // This is the data that is shared with WASM
    // It's just an array of float64s
    this.vertexData = new Float64Array(
      instance.exports.memory.buffer,
      this.pointer,
      this.vertexCount * 4
    );
    this.module.init(this.pointer, this.vertexCount, this.radius);
    this.isPrepared = true;
  }

  handleDrag(clientX, clientY) {
    this.mouseX = clientX - window.innerWidth / 2;
    this.mouseY = clientY - window.innerHeight / 2;
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
        isDragging,
        dragX,
        dragY,
        1.0 / stepsPerFrame
      );
    }
    this.centerX = 0;
    this.centerY = 0;
    for (let i = 0; i < this.vertexCount; i++) {
      // Grab vertex data from shared memory
      this.vertices[i].x = this.vertexData[i * 4 + 0];
      this.vertices[i].y = this.vertexData[i * 4 + 1];
      this.centerX += this.vertices[i].x;
      this.centerY += this.vertices[i].y;
    }
    this.centerX /= this.vertexCount;
    this.centerY /= this.vertexCount;
  }

  teardown() {
    this.module.dealloc(this.pointer, this.vertexCount * 4);
  }

  get isDragging() {
    const keys = this.keys;
    return this.isMouseDown || keys.left || keys.right || keys.up || keys.down;
  }

  get dragX() {
    if (this.isMouseDown) return this.mouseX;
    let x = this.centerX;
    if (this.keys.left) x -= this.radius / 2;
    if (this.keys.right) x += this.radius / 2;
    return x;
  }

  get dragY() {
    if (this.isMouseDown) return this.mouseY;
    let y = this.centerY;
    if (this.keys.up) y -= this.radius / 2;
    if (this.keys.down) y += this.radius / 2;
    return y;
  }
}

let origin = {
  x: 0,
  y: 0
};

export default class SoftBody extends React.Component {
  update = () => {
    this.body.update();
    this.forceUpdate();
    requestAnimationFrame(this.update);
  };

  startDrag = e => {
    e.preventDefault();
    this.body.isMouseDown = true;
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
        this.body.isMouseDown = false;
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
    const y = cos(pitch) * sin(roll);
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
    document.addEventListener("keydown", this.handleKey);
    document.addEventListener("keyup", this.handleKey);
    const gn = new GyroNorm();
    gn.init().then(() => gn.start(this.handleDeviceOrientation));

    requestAnimationFrame(this.update);
  }

  componentWillUnmount() {
    this.body.teardown();
  }

  render() {
    if (!this.body) return null;
    const vertices = this.body.vertices;
    const eyeVertex1 = 0;
    const eyeVertex2 = Math.floor(2 * this.body.vertexCount / 3);
    const mouthVertex = Math.floor(this.body.vertexCount / 3);
    return (
      <svg
        style={{ position: "absolute" }}
        className="svg"
        onTouchStart={e => e.preventDefault()}
        viewBox={[
          -window.innerWidth / 2,
          -window.innerHeight / 2,
          window.innerWidth,
          window.innerHeight
        ].join(" ")}
      >
        <g onMouseDown={this.startDrag} onTouchStart={this.startDrag}>
          <polygon
            points={this.body.vertices.map(v => `${v.x} ${v.y}`).join(" ")}
            stroke="transparent"
            fill="#fd4"
          />
          {/* Eyes */}
          <circle
            fill="#333"
            cx={(vertices[eyeVertex1].x + this.body.centerX * 2) / 3}
            cy={(vertices[eyeVertex1].y + this.body.centerY * 2) / 3}
            r={this.body.radius / 8}
          />
          <circle
            fill="#333"
            cx={(vertices[eyeVertex2].x + this.body.centerX * 2) / 3}
            cy={(vertices[eyeVertex2].y + this.body.centerY * 2) / 3}
            r={this.body.radius / 8}
          />
          {/* Mouth */}
          <circle
            fill="#333"
            cx={(vertices[mouthVertex].x * 2 + this.body.centerX * 3) / 5}
            cy={(vertices[mouthVertex].y * 2 + this.body.centerY * 3) / 5}
            r={this.body.radius / 4}
          />
        </g>
      </svg>
    );
  }
}
