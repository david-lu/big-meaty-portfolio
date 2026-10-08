// WebGL2 setup for the Hedra halftone transition.
export const createWebgl2Program = (canvas, vertexSource, fragmentSource,
  { preserveDrawingBuffer = false } = {}) => {
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer
  });
  if (!gl) return null;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Could not create a WebGL2 shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`WebGL2 shader compilation failed: ${message}`);
    }
    return shader;
  };

  let vertex;
  let fragment;
  let program;
  try {
    vertex = compile(gl.VERTEX_SHADER, vertexSource);
    fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    if (!program) throw new Error('Could not create a WebGL2 shader program.');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`WebGL2 shader linking failed: ${gl.getProgramInfoLog(program)}`);
    }
  } catch (error) {
    if (program) gl.deleteProgram(program);
    throw error;
  } finally {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return {
    gl,
    program,
    maxSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    locations: names => Object.fromEntries(names.map(name =>
      [name, gl.getUniformLocation(program, `u_${name}`)]))
  };
};
