const vertexSource = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_center;
uniform vec2 u_size;
uniform float u_wave;
uniform float u_radius;
uniform float u_dpr;

out vec2 v_local;
flat out float v_radius;
flat out float v_tone;

void main() {
  float diagonal = a_center.x * 0.018 + a_center.y * 0.012;
  float ripple = length(a_center - u_size * 0.5) * 0.03;
  float intensity = clamp((sin(diagonal - u_wave * 2.0)
    + sin(ripple - u_wave * 2.4) + 2.0) * 0.25, 0.0, 1.0);
  float bucket = min(6.0, floor(intensity * 7.0));
  v_radius = u_radius * intensity;
  v_tone = bucket > 5.5 ? 1.0 : (146.0 + 18.0 * bucket) / 255.0;

  // Four vertices form one dot's quad; the fragment shader cuts out its circle.
  vec2 corner = vec2(float((gl_VertexID & 1) * 2 - 1),
    float((gl_VertexID & 2) - 1));
  float extent = v_radius + 1.0 / u_dpr;
  v_local = corner * extent;
  vec2 position = a_center + v_local;
  gl_Position = vec4(position.x / u_size.x * 2.0 - 1.0,
    1.0 - position.y / u_size.y * 2.0, 0.0, 1.0);
}
`;

const fragmentSource = `#version 300 es
precision highp float;

in vec2 v_local;
flat in float v_radius;
flat in float v_tone;
uniform float u_dpr;
out vec4 out_color;

void main() {
  if (v_radius < 0.4) discard;
  float edge = 0.5 / u_dpr;
  float alpha = 1.0 - smoothstep(v_radius - edge, v_radius + edge,
    length(v_local));
  if (alpha <= 0.0) discard;
  // Premultiplied alpha keeps the translucent dots smooth against black.
  out_color = vec4(vec3(v_tone * alpha), alpha);
}
`;

export const createHedraGpuRenderer = (canvas) => {
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: false
  });
  if (!gl) return null;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Could not create a Hedra shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Hedra shader compilation failed: ${message}`);
    }
    return shader;
  };

  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create the Hedra shader program.');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Hedra shader linking failed: ${message}`);
  }

  const buffer = gl.createBuffer();
  const array = gl.createVertexArray();
  if (!buffer || !array) throw new Error('Could not allocate Hedra dot geometry.');
  gl.bindVertexArray(array);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(0, 1);
  gl.bindVertexArray(null);

  const sizeLocation = gl.getUniformLocation(program, 'u_size');
  const waveLocation = gl.getUniformLocation(program, 'u_wave');
  const radiusLocation = gl.getUniformLocation(program, 'u_radius');
  const dprLocation = gl.getUniformLocation(program, 'u_dpr');
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  let dotCount = 0;

  return {
    gl,
    maxSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    resize(width, height, rowPitch) {
      const centers = [];
      for (let row = 0, y = 0; y < height + rowPitch; row++, y += rowPitch) {
        for (let x = (row & 1) * rowPitch; x < width + rowPitch; x += rowPitch * 2) {
          centers.push(x, y);
        }
      }
      dotCount = centers.length / 2;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(centers), gl.STATIC_DRAW);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    render(waveTime, width, height, dpr, maxRadius) {
      if (gl.isContextLost()) return;
      gl.useProgram(program);
      gl.bindVertexArray(array);
      gl.uniform2f(sizeLocation, width, height);
      gl.uniform1f(waveLocation, waveTime);
      gl.uniform1f(radiusLocation, maxRadius);
      gl.uniform1f(dprLocation, dpr);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, dotCount);
    }
  };
};
