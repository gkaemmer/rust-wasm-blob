import React from "react";

let physicsWasm, GyroNorm;
if (process.browser) {
  physicsWasm = require("./physics.rs");
  GyroNorm = require("../node_modules/gyronorm/dist/gyronorm.complete.min");
}

let speed = 20;

function modulo(n, m) {
  return (n % m + m) % m;
}

class Body {
  constructor(vertexCount, radius) {
    this.vertexCount = vertexCount;
    this.radius = radius;
    this.vertices = [];
    this.isDragging = false;
    this.dragX = 0;
    this.dragY = 0;
    this.gravX = 0;
    this.gravY = 1;
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
    console.log(instance);
    this.module = {};
    this.module.alloc = instance.exports.alloc;
    this.module.dealloc = instance.exports.dealloc;
    this.module.step = instance.exports.step;
    this.module.init = instance.exports.init;
    this.instance = instance;
    this.pointer = this.module.alloc(this.vertexCount);
    this.vertexData = new Float64Array(
      instance.exports.memory.buffer,
      this.pointer,
      this.vertexCount * 4
    );
    window.vertexData = this.vertexData;
    this.module.init(this.pointer, this.vertexCount, this.radius);
    this.isPrepared = true;
  }

  handleDrag(clientX, clientY) {
    this.dragX = clientX - window.innerWidth / 2;
    this.dragY = clientY - window.innerHeight / 2;
  }

  update(force) {
    if (this.isPaused && force !== true) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const finalSpeed = force === true ? 30 : speed;

    if (!this.isPrepared) return;

    for (let i = 0; i < finalSpeed; i++) {
      // Calculate many times per frame
      this.module.step(
        this.pointer,
        this.vertexCount,
        this.radius,
        width,
        height,
        this.gravX,
        this.gravY,
        this.isDragging,
        this.dragX,
        this.dragY,
        1.0/speed
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
    this.body.isDragging = true;
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
        this.body.isDragging = false;
        window.removeEventListener(moveEvent, moveHandler);
        window.removeEventListener(endEvent, endHandler);
      })
    );
  };

  handleDeviceOrientation = () => {};

  componentDidMount() {
    if (process.browser) this.body = new Body(25, 100);
    requestAnimationFrame(this.update);
    document.addEventListener("keydown", e => {
      if (e.code === "Space") {
        if (this.body.isPaused) {
          this.body.update(true);
        }
        this.body.isPaused = true;
      }
    });
    const gn = new GyroNorm();
    gn.init().then(() => {
      gn.start(data => {
        if (!data.do.alpha) return;
        // This took a lot of guess and check
        this.alpha = data.do.alpha;
        this.beta = data.do.beta;
        this.gamma = data.do.gamma;
        const yaw = -this.gamma * Math.PI / 180;
        const pitch = this.alpha * Math.PI / 180;
        const roll = this.beta * Math.PI / 180;
        const { cos, sin } = Math;

        const x = -cos(yaw) * sin(pitch) * sin(roll) - sin(yaw) * cos(roll);
        const y = cos(pitch) * sin(roll);
        // const z = -sin(yaw)*sin(pitch)*sin(roll)+cos(yaw)*cos(roll);

        this.body.gravX = 3 * x;
        this.body.gravY = 3 * y;
      });
    });
  }

  componentWillUnmount() {
    this.body.teardown();
  }

  render() {
    if (!this.body) return null;
    return (
      <div className="stage">
        <style jsx>{`
          .stage {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;
          }
          .svg {
            top: 0;
            left: 0;
            right: 0;
          }
        `}</style>
        <svg
          className="svg"
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
              cx={(this.body.vertices[0].x + this.body.centerX * 2) / 3}
              cy={(this.body.vertices[0].y + this.body.centerY * 2) / 3}
              r={this.body.radius / 8}
            />
            <circle
              fill="#333"
              cx={
                (this.body.vertices[Math.floor(2 * this.body.vertexCount / 3)]
                  .x +
                  this.body.centerX * 2) /
                3
              }
              cy={
                (this.body.vertices[Math.floor(2 * this.body.vertexCount / 3)]
                  .y +
                  this.body.centerY * 2) /
                3
              }
              r={this.body.radius / 8}
            />
            {/* Mouth */}
            <circle
              fill="#333"
              cx={
                (this.body.vertices[Math.floor(this.body.vertexCount / 3)].x +
                  this.body.centerX * 2) /
                3
              }
              cy={
                (this.body.vertices[Math.floor(this.body.vertexCount / 3)].y +
                  this.body.centerY * 2) /
                3
              }
              r={this.body.radius / 4}
            />
          </g>
        </svg>
      </div>
    );
  }
}
