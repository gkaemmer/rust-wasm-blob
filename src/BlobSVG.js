import React from "react";

export default class BlobSVG extends React.Component {
  preventDefault = e => e.preventDefault();

  draw = () => {
    if (this.unmount) return;
    this.forceUpdate();
    requestAnimationFrame(this.draw);
  }

  componentDidMount() {
    requestAnimationFrame(this.draw);
  }

  componentWillUnmount() {
    this.unmount = true;
  }

  render() {
    const { body, onDragStart } = this.props;
    const vertices = body.vertices;
    const eyeVertex1 = 0;
    const eyeVertex2 = Math.floor(2 * body.vertexCount / 3);
    const mouthVertex = Math.floor(body.vertexCount / 3);
    return (
      <svg
        style={{ position: "absolute" }}
        onTouchStart={this.preventDefault}
        viewBox={[
          -window.innerWidth / 2,
          -window.innerHeight / 2,
          window.innerWidth,
          window.innerHeight
        ].join(" ")}
      >
        <g onMouseDown={onDragStart} onTouchStart={onDragStart}>
          <polygon
            points={body.vertices.map(v => `${v.x} ${v.y}`).join(" ")}
            stroke="transparent"
            fill="#fd4"
          />
          {/* Eyes */}
          <circle
            fill="#333"
            cx={(vertices[eyeVertex1].x + body.centerX * 2) / 3}
            cy={(vertices[eyeVertex1].y + body.centerY * 2) / 3}
            r={body.radius / 8}
          />
          <circle
            fill="#333"
            cx={(vertices[eyeVertex2].x + body.centerX * 2) / 3}
            cy={(vertices[eyeVertex2].y + body.centerY * 2) / 3}
            r={body.radius / 8}
          />
          {/* Mouth */}
          <circle
            fill="#333"
            cx={(vertices[mouthVertex].x * 2 + body.centerX * 3) / 5}
            cy={(vertices[mouthVertex].y * 2 + body.centerY * 3) / 5}
            r={body.radius / 4}
          />
        </g>
      </svg>
    );
  }
}
