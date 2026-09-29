import { createWebgl2Program } from './webgl2.js';

const vertexSource = `#version 300 es
precision highp float;

uniform vec2 u_size;
uniform float u_dpr;
uniform float u_row_pitch;
uniform float u_radius;
uniform float u_distance;
uniform float u_growth_pixels;
uniform float u_row_delay;
uniform float u_column_offset;
uniform int u_cells;
uniform int u_columns;

out vec2 v_local;
flat out float v_radius;

void main() {
  int column = gl_InstanceID / u_cells;
  int cell = gl_InstanceID % u_cells;
  float offset = u_columns > 1
    ? u_column_offset * float(column) / float(u_columns - 1) : 0.0;
  float growth = clamp((u_distance - (float(cell) + offset) * u_row_delay)
    / u_growth_pixels, 0.0, 1.0);
  v_radius = u_radius * growth;

  float x = (float(column) - 0.5) * 2.0 * u_row_pitch
    + float(cell & 1) * u_row_pitch;
  float y = u_size.y - 0.5 * u_row_pitch
    + (0.5 - float(cell)) * u_row_pitch;
  vec2 corner = vec2(float((gl_VertexID & 1) * 2 - 1),
    float((gl_VertexID & 2) - 1));
  v_local = corner * (v_radius + 1.0 / u_dpr);
  vec2 position = vec2(x, y) + v_local;
  gl_Position = vec4(position.x / u_size.x * 2.0 - 1.0,
    1.0 - position.y / u_size.y * 2.0, 0.0, 1.0);
}
`;

const fragmentSource = `#version 300 es
precision highp float;

in vec2 v_local;
flat in float v_radius;
uniform vec3 u_color;
uniform float u_dpr;
out vec4 out_color;

void main() {
  if (v_radius <= 0.0) discard;
  float edge = 0.5 / u_dpr;
  float alpha = 1.0 - smoothstep(v_radius - edge, v_radius + edge,
    length(v_local));
  if (alpha <= 0.0) discard;
  out_color = vec4(u_color * alpha, alpha);
}
`;

export const createHalftoneGpuRenderer = (canvas) => {
  // The canvases hold a completed section color after scrolling stops.
  const setup = createWebgl2Program(canvas, vertexSource, fragmentSource,
    { preserveDrawingBuffer: true });
  if (!setup) return null;
  const { gl, program, maxSize, locations } = setup;
  const uniform = locations([
    'size', 'dpr', 'row_pitch', 'radius', 'distance', 'growth_pixels',
    'row_delay', 'column_offset', 'cells', 'columns', 'color'
  ]);

  return {
    maxSize,
    resize() {
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    render({ width, height, dpr, rowPitch, radius, distance,
      growthPixels, rowDelay, columnOffset, cells, columns, color, complete }) {
      if (gl.isContextLost()) return;
      gl.clearColor(...(complete ? color : [0, 0, 0]), complete ? 1 : 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (complete) return;
      gl.useProgram(program);
      gl.uniform2f(uniform.size, width, height);
      gl.uniform1f(uniform.dpr, dpr);
      gl.uniform1f(uniform.row_pitch, rowPitch);
      gl.uniform1f(uniform.radius, radius);
      gl.uniform1f(uniform.distance, distance);
      gl.uniform1f(uniform.growth_pixels, growthPixels);
      gl.uniform1f(uniform.row_delay, rowDelay);
      gl.uniform1f(uniform.column_offset, columnOffset);
      gl.uniform1i(uniform.cells, cells);
      gl.uniform1i(uniform.columns, columns);
      gl.uniform3f(uniform.color, ...color);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cells * columns);
    }
  };
};
