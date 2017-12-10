import React from "react";

function isInside(body, x, y) {
  const dx = body.centerX - x;
  const dy = body.centerY - y;
  return dx * dx + dy * dy < body.radius * body.radius;
}

let ratio = 1, windowSize = {width: 800, height: 600};

function sx(x) {
  return (x + windowSize.width / 2) * ratio;
}

function sy(y) {
  return (y + windowSize.height / 2) * ratio;
}

export default class BlobSVG extends React.Component {
  tryDragStart = e => {
    e.preventDefault();
    if (
      isInside(
        this.props.body,
        e.clientX - windowSize.width / 2,
        e.clientY - windowSize.height / 2
      )
    ) {
      this.props.onDragStart(e);
    }
  };

  draw = () => {
    const { body } = this.props;
    const { vertices } = body;
    this.ctx.fillStyle = "#fff";
    this.ctx.fillRect(
      0,
      0,
      windowSize.width * ratio,
      windowSize.height * ratio
    );
    this.ctx.fillStyle = "#fd4";
    this.ctx.beginPath();
    this.ctx.moveTo(sx(vertices[0].x), sy(vertices[0].y));
    for (let vertex of vertices) {
      this.ctx.lineTo(sx(vertex.x), sy(vertex.y));
    }
    this.ctx.fill();

    const eyeVertex1 = 0;
    const eyeVertex2 = Math.floor(2 * body.vertexCount / 3);
    const mouthVertex = Math.floor(body.vertexCount / 3);
    this.ctx.fillStyle = "#333";
    // Eyes
    this.ctx.beginPath();
    this.ctx.arc(
      sx((vertices[eyeVertex1].x + body.centerX * 2) / 3),
      sy((vertices[eyeVertex1].y + body.centerY * 2) / 3),
      body.radius / 8 * ratio,
      0,
      Math.PI * 2,
      false
    );
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(
      sx((vertices[eyeVertex2].x + body.centerX * 2) / 3),
      sy((vertices[eyeVertex2].y + body.centerY * 2) / 3),
      body.radius / 8 * ratio,
      0,
      Math.PI * 2,
      false
    );
    this.ctx.fill();
    // Mouth
    this.ctx.beginPath();
    this.ctx.arc(
      sx((vertices[mouthVertex].x * 2 + body.centerX * 3) / 5),
      sy((vertices[mouthVertex].y * 2 + body.centerY * 3) / 5),
      body.radius / 4 * ratio,
      0,
      Math.PI * 2,
      false
    );
    this.ctx.fill();

    if (!this.unmount)
      requestAnimationFrame(this.draw);
  };

  handleResize = () => {
    windowSize.width = window.innerWidth;
    windowSize.height = window.innerHeight;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const backingStoreRatio =
      this.ctx.webkitBackingStorePixelRatio ||
      this.ctx.mozBackingStorePixelRatio ||
      this.ctx.msBackingStorePixelRatio ||
      this.ctx.oBackingStorePixelRatio ||
      this.ctx.backingStorePixelRatio ||
      1;
    ratio = devicePixelRatio / backingStoreRatio;
    this.forceUpdate();
  }

  componentDidMount() {
    this.ctx = this.canvas.getContext("2d");
    window.addEventListener("resize", this.handleResize);
    this.handleResize();
    requestAnimationFrame(this.draw);
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.handleResize);
    this.unmount = true;
  }

  render() {
    return (
      <canvas
        style={{
          position: "absolute",
          width: windowSize.width,
          height: windowSize.height
        }}
        onTouchStart={this.tryDragStart}
        onMouseDown={this.tryDragStart}
        width={windowSize.width * ratio}
        height={windowSize.height * ratio}
        ref={canvas => (this.canvas = canvas)}
      />
    );
  }
}
