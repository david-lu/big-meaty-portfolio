// Keep bubble data on the GPU; scrolling only changes the progress uniform.
const vertexShader = `#version 300 es
layout(location = 0) in vec4 a_particle;
layout(location = 1) in vec2 a_variation;
uniform vec2 u_viewport;
uniform float u_horizontalOverscan;
uniform float u_progress;
uniform float u_flight;
out vec2 v_uv;
const vec2 corners[6] = vec2[6](
  vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0),
  vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(1.0, 1.0)
);
void main() {
  v_uv = corners[gl_VertexID];
  float phase = clamp((u_progress - a_particle.w) / u_flight, 0.0, 1.0);
  if (phase <= 0.0 || phase >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    return;
  }
  float size = a_particle.y;
  float left = -u_horizontalOverscan +
    a_particle.x * (u_viewport.x + 2.0 * u_horizontalOverscan) - size * 0.5 +
    sin(phase * 12.566370614359172 + a_variation.x) * a_particle.z;
  float top = u_viewport.y + size - phase * (u_viewport.y + 2.0 * size);
  vec2 centered = (v_uv - 0.5) * size;
  float sine = sin(a_variation.y);
  float cosine = cos(a_variation.y);
  vec2 rotated = vec2(cosine * centered.x - sine * centered.y,
    sine * centered.x + cosine * centered.y);
  vec2 position = vec2(left + size * 0.5, top + size * 0.5) + rotated;
  gl_Position = vec4(position / u_viewport * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
}`;

const fragmentShader = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_sprite;
out vec4 outColor;
void main() {
  vec4 color = texture(u_sprite, v_uv);
  outColor = color;
}`;

export const createNickBubbleRenderer = (canvas) => {
  const twgl = window.twgl;
  const gl = twgl && canvas.getContext('webgl2', {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: true
  });
  const context = gl ? null : canvas.getContext('2d', { alpha: true });
  let sprite;
  let texture;
  let particleCount = 0;
  let horizontalOverscan = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let canvasRatio = 0;
  let programInfo;
  let instanceBuffer;
  let vertexArray;
  const uniforms = {
    u_viewport: new Float32Array(2), u_horizontalOverscan: 0, u_progress: 0,
    u_flight: 1, u_sprite: null
  };

  if (gl) {
    programInfo = twgl.createProgramInfo(gl, [vertexShader, fragmentShader]);
    instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    vertexArray = gl.createVertexArray();
    gl.bindVertexArray(vertexArray);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }

  const setSprite = (nextSprite) => {
    sprite = nextSprite;
    if (gl) {
      if (texture) gl.deleteTexture(texture);
      texture = twgl.createTexture(gl, {
        src: sprite, min: gl.LINEAR, mag: gl.LINEAR,
        wrap: gl.CLAMP_TO_EDGE, flipY: false
      });
      uniforms.u_sprite = texture;
    }
  };

  const setParticles = (particles, overscan) => {
    horizontalOverscan = overscan;
    if (!gl) return;
    const data = new Float32Array(particles.length * 6);
    particles.forEach(({ x, size, sway, launch, waveOffset, angle }, i) => {
      const index = i * 6;
      data[index] = x;
      data[index + 1] = size;
      data[index + 2] = sway;
      data[index + 3] = launch;
      data[index + 4] = waveOffset;
      data[index + 5] = angle;
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    particleCount = particles.length;
  };

  const draw = (particles, position, flight, width, height, ratio) => {
    if (!sprite) return;
    if (width !== canvasWidth || height !== canvasHeight || ratio !== canvasRatio) {
      canvas.width = Math.ceil(width * ratio);
      canvas.height = Math.ceil(height * ratio);
      canvasWidth = width;
      canvasHeight = height;
      canvasRatio = ratio;
    }

    if (gl) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!particleCount) return;
      gl.useProgram(programInfo.program);
      gl.bindVertexArray(vertexArray);
      uniforms.u_viewport[0] = width;
      uniforms.u_viewport[1] = height;
      uniforms.u_horizontalOverscan = horizontalOverscan;
      uniforms.u_progress = position;
      uniforms.u_flight = flight;
      twgl.setUniforms(programInfo, uniforms);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, particleCount);
      gl.bindVertexArray(null);
    } else if (context) {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 1;
      for (const { x, size, sway, launch, waveOffset, angle } of particles) {
        const phase = Math.max(0, Math.min(1, (position - launch) / flight));
        if (phase === 0 || phase === 1) continue;
        const left = -horizontalOverscan + x * (width + 2 * horizontalOverscan) -
          size / 2 + Math.sin(phase * Math.PI * 4 + waveOffset) * sway;
        const top = height + size - phase * (height + 2 * size);
        const centerX = left + size / 2;
        const centerY = top + size / 2;
        const sine = Math.sin(angle);
        const cosine = Math.cos(angle);
        const extent = size / 2 * (Math.abs(sine) + Math.abs(cosine));
        if (centerX + extent < 0 || centerX - extent > width ||
            centerY + extent < 0 || centerY - extent > height) continue;
        context.setTransform(ratio * cosine, ratio * sine,
          -ratio * sine, ratio * cosine, ratio * centerX, ratio * centerY);
        context.drawImage(sprite, -size / 2, -size / 2, size, size);
      }
    }
  };

  return { kind: gl ? 'webgl2' : context ? '2d' : 'none', setSprite, setParticles, draw };
};
