import { WORLD_WIDTH, WORLD_HEIGHT } from "./constants";
import type { TerrainModification } from "./types";

// ============================================================================
// GPU Shader-based Terrain Renderer using WebGL2
// ============================================================================

const VERTEX_SHADER = `#version 300 es
precision highp float;

// Fullscreen quad vertices (2 triangles)
const vec2 positions[6] = vec2[](
  vec2(-1.0, -1.0),
  vec2( 1.0, -1.0),
  vec2( 1.0,  1.0),
  vec2(-1.0, -1.0),
  vec2( 1.0,  1.0),
  vec2(-1.0,  1.0)
);

void main() {
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_seed;
uniform vec2 u_cameraPos;
uniform vec2 u_viewSize;
uniform float u_zoom;
uniform vec2 u_worldSize;
uniform sampler2D u_modTexture;
uniform int u_modCount;

out vec4 fragColor;

// === Noise functions for irregular edges ===
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // Smooth interpolation

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian Motion for more natural irregular edges
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// === Terrain height calculation (matches CPU implementation) ===
float computeBaseHeight(float x) {
  float f1 = 0.001;
  float f2 = 0.005;
  float f3 = 0.02;

  float a1 = 200.0;
  float a2 = 50.0;
  float a3 = 10.0;

  float noise = sin((x + u_seed) * f1) * a1 +
                sin((x + u_seed * 2.0) * f2) * a2 +
                sin((x + u_seed * 3.0) * f3) * a3;

  float mountain = sin((x / u_worldSize.x) * 3.14159265 * 5.0 + u_seed) * -120.0;

  float h = u_worldSize.y / 1.6 + noise + mountain;
  return clamp(h, 200.0, u_worldSize.y - 100.0);
}

// === Check if point is in tunnel (capsule SDF) ===
bool isInTunnel(float px, float py, float sx, float sy, float nx, float ny, float radius, float length) {
  float dx = nx * length;
  float dy = ny * length;
  float len2 = length * length;

  if (len2 == 0.0) {
    float dist2 = (px - sx) * (px - sx) + (py - sy) * (py - sy);
    return dist2 <= radius * radius;
  }

  float t = clamp(((px - sx) * dx + (py - sy) * dy) / len2, 0.0, 1.0);
  float closestX = sx + t * dx;
  float closestY = sy + t * dy;

  float dist2 = (px - closestX) * (px - closestX) + (py - closestY) * (py - closestY);
  return dist2 <= radius * radius;
}

// === Check if point is inside irregular crater ===
bool isInCrater(float worldX, float worldY, float modX, float modY, float modRadius, out float edgeDist) {
  float dx = worldX - modX;
  float dy = worldY - modY;
  float dist = sqrt(dx * dx + dy * dy);

  // Calculate angle for noise sampling
  float angle = atan(dy, dx);

  // Create irregular edge using noise
  // Use position-based noise for consistent edges
  vec2 noisePos = vec2(modX + modY * 0.37, angle * 3.0 + modRadius * 0.1);
  float edgeNoise = fbm(noisePos * 0.5) * 0.3 + 0.85; // 0.55 to 1.15 range

  // Add smaller high-frequency detail
  float detailNoise = noise(vec2(angle * 8.0 + modX, modY * 0.1)) * 0.15;

  float irregularRadius = modRadius * (edgeNoise + detailNoise);
  edgeDist = dist - irregularRadius;

  return dist <= irregularRadius;
}

// === Generate star field (smooth point-based, no grid artifacts) ===
float star(vec2 uv, float layer) {
  // Create grid for star placement
  vec2 id = floor(uv);
  vec2 gridUV = fract(uv);

  float starLight = 0.0;

  // Check this cell and neighbors to avoid edge cutoff
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cellId = id + neighbor;

      // Random position within cell
      vec2 starPos = neighbor + vec2(
        hash(cellId + layer * 17.0),
        hash(cellId + layer * 31.0 + 50.0)
      ) * 0.8 + 0.1;

      // Only some cells have stars
      float starPresent = step(0.92, hash(cellId + layer * 47.0));
      if (starPresent < 0.5) continue;

      // Distance to star
      float d = length(gridUV - starPos);

      // Star size varies
      float size = hash(cellId + layer * 63.0) * 0.015 + 0.005;

      // Smooth star glow (exponential falloff)
      float glow = exp(-d * d / (size * size * 2.0));

      // Brightness variation
      float brightness = hash(cellId + layer * 79.0) * 0.7 + 0.3;

      starLight += glow * brightness;
    }
  }

  return clamp(starLight, 0.0, 1.0);
}

void main() {
  // Screen coordinates → World coordinates
  vec2 screenPos = gl_FragCoord.xy;
  float worldX = u_cameraPos.x + screenPos.x / u_zoom;
  float worldY = u_cameraPos.y + (u_viewSize.y - screenPos.y) / u_zoom;

  // Compute base terrain height
  float baseH = computeBaseHeight(worldX);
  bool solid = worldY >= baseH;

  // Track crater effects for coloring
  float nearestCraterDist = 1000.0;
  float nearestCraterRadius = 0.0;

  // Apply modifications from texture
  for (int i = 0; i < u_modCount; i++) {
    vec4 data0 = texelFetch(u_modTexture, ivec2(i, 0), 0);
    float modType = data0.r;
    float modX = data0.g;
    float modY = data0.b;
    float modRadius = data0.a;

    if (modType < 0.5) {
      // Destroy (crater) - use irregular edges
      float edgeDist;
      if (isInCrater(worldX, worldY, modX, modY, modRadius, edgeDist)) {
        solid = false;
      }
      // Track for scorch marks
      float dx = worldX - modX;
      float dy = worldY - modY;
      float dist = sqrt(dx * dx + dy * dy);
      if (dist < nearestCraterDist) {
        nearestCraterDist = dist;
        nearestCraterRadius = modRadius;
      }
    } else if (modType < 1.5) {
      // Add (builder)
      float dx = worldX - modX;
      float dy = worldY - modY;
      float distSq = dx * dx + dy * dy;
      if (distSq <= modRadius * modRadius) solid = true;
    } else {
      // Carve (tunnel)
      vec4 data1 = texelFetch(u_modTexture, ivec2(i, 1), 0);
      float nx = data1.r;
      float ny = data1.g;
      float length = data1.b;

      if (isInTunnel(worldX, worldY, modX, modY, nx, ny, modRadius, length)) {
        solid = false;
      }
    }
  }

  // === Render sky for non-solid pixels (background + stars) ===
  if (!solid) {
    // Sky gradient (matches original CSS gradient)
    float skyT = screenPos.y / u_viewSize.y;
    vec3 skyTop = vec3(0.008, 0.024, 0.09);    // #020617
    vec3 skyBot = vec3(0.09, 0.145, 0.33);     // #172554
    vec3 skyColor = mix(skyBot, skyTop, skyT);

    // === Procedural starfield with parallax ===
    // Parallax: stars move slower than camera (0.05x)
    // Negate Y because screen Y is flipped relative to world Y
    vec2 starUV = (screenPos + vec2(u_cameraPos.x, -u_cameraPos.y) * 0.05) / 40.0;

    // Multiple star layers for depth
    float stars = 0.0;
    stars += star(starUV * 1.0, 1.0) * 0.8;
    stars += star(starUV * 1.5 + 100.0, 2.0) * 0.5;
    stars += star(starUV * 2.0 + 200.0, 3.0) * 0.3;

    // Add stars to sky
    skyColor += vec3(stars);

    fragColor = vec4(skyColor, 1.0);
    return;
  }

  // === Terrain color with gradient ===
  float t = worldY / u_worldSize.y;
  vec3 topColor = vec3(0.278, 0.333, 0.412);   // #475569
  vec3 botColor = vec3(0.059, 0.090, 0.165);   // #0f172a
  vec3 color = mix(topColor, botColor, t);

  // === Grass layer near surface ===
  float distFromSurface = worldY - baseH;
  if (distFromSurface >= 0.0 && distFromSurface < 15.0) {
    color = vec3(0.133, 0.773, 0.369); // #22c55e
    if (distFromSurface < 4.0) {
      color = vec3(0.525, 0.937, 0.675); // #86efac
    }
  }

  // === Subtle texture noise ===
  float texNoise = fract(sin(dot(vec2(worldX, worldY), vec2(12.9898, 78.233))) * 43758.5453);
  color += (texNoise - 0.5) * 0.05;

  // === Enhanced scorch marks near craters ===
  if (nearestCraterRadius > 0.0) {
    float scorchOuter = nearestCraterRadius * 1.4;  // Outer scorch radius
    float scorchInner = nearestCraterRadius * 0.7;  // Inner dark zone

    if (nearestCraterDist <= scorchOuter) {
      // Outer scorch zone - brown/dark gradient
      float scorchT = 1.0 - (nearestCraterDist - scorchInner) / (scorchOuter - scorchInner);
      scorchT = clamp(scorchT, 0.0, 1.0);

      // Add noise to scorch for natural look
      float scorchNoise = noise(vec2(worldX * 0.2, worldY * 0.2)) * 0.3;
      scorchT = clamp(scorchT + scorchNoise - 0.15, 0.0, 1.0);

      // Scorch colors: dark brown to black
      vec3 scorchColor = mix(vec3(0.15, 0.1, 0.05), vec3(0.02, 0.01, 0.01), scorchT * 0.5);
      color = mix(color, scorchColor, scorchT * 0.7);

      // Inner edge darkening (near crater wall)
      if (nearestCraterDist <= nearestCraterRadius * 1.1) {
        float innerT = 1.0 - (nearestCraterDist / (nearestCraterRadius * 1.1));
        color = mix(color, vec3(0.0), innerT * 0.6);
      }
    }
  }

  fragColor = vec4(color, 1.0);
}
`;

const MAX_MODIFICATIONS = 4096;

/**
 * GPU-accelerated terrain renderer using WebGL2 shaders.
 * Renders terrain with modifications entirely on GPU.
 */
export class TerrainShaderRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private modTexture: WebGLTexture | null = null;

  // Uniform locations
  private uniforms: {
    seed: WebGLUniformLocation | null;
    cameraPos: WebGLUniformLocation | null;
    viewSize: WebGLUniformLocation | null;
    zoom: WebGLUniformLocation | null;
    worldSize: WebGLUniformLocation | null;
    modTexture: WebGLUniformLocation | null;
    modCount: WebGLUniformLocation | null;
  } = {
    seed: null,
    cameraPos: null,
    viewSize: null,
    zoom: null,
    worldSize: null,
    modTexture: null,
    modCount: null,
  };

  private modTextureData: Float32Array;
  private lastModCount = 0;
  private isInitialized = false;

  constructor() {
    // 2 rows per modification: [type, x, y, radius] and [nx, ny, length, 0]
    this.modTextureData = new Float32Array(MAX_MODIFICATIONS * 4 * 2);
  }

  /**
   * Initialize WebGL context and compile shaders.
   * Returns true if successful, false if WebGL2 unavailable.
   */
  init(canvas: HTMLCanvasElement): boolean {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
    });

    if (!gl) {
      console.warn("WebGL2 not available, falling back to CPU rendering");
      return false;
    }

    this.gl = gl;

    // Compile shaders
    const vertShader = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragShader = this.compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      FRAGMENT_SHADER,
    );

    if (!vertShader || !fragShader) {
      console.error("Failed to compile shaders");
      return false;
    }

    // Link program
    const program = gl.createProgram();
    if (!program) return false;

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return false;
    }

    this.program = program;

    // Get uniform locations
    this.uniforms = {
      seed: gl.getUniformLocation(program, "u_seed"),
      cameraPos: gl.getUniformLocation(program, "u_cameraPos"),
      viewSize: gl.getUniformLocation(program, "u_viewSize"),
      zoom: gl.getUniformLocation(program, "u_zoom"),
      worldSize: gl.getUniformLocation(program, "u_worldSize"),
      modTexture: gl.getUniformLocation(program, "u_modTexture"),
      modCount: gl.getUniformLocation(program, "u_modCount"),
    };

    // Create VAO (empty - we use gl_VertexID in shader)
    this.vao = gl.createVertexArray();

    // Create modification texture
    this.modTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.modTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.isInitialized = true;
    return true;
  }

  /**
   * Resize the WebGL viewport to match canvas size.
   */
  resize(width: number, height: number): void {
    if (!this.gl) return;
    this.gl.viewport(0, 0, width, height);
  }

  /**
   * Upload modifications to GPU texture.
   */
  uploadModifications(modifications: TerrainModification[]): void {
    if (!this.gl || !this.modTexture) return;

    const count = Math.min(modifications.length, MAX_MODIFICATIONS);
    this.lastModCount = count;

    // Pack modifications into texture data
    for (let i = 0; i < count; i++) {
      const mod = modifications[i];
      const baseIdx = i * 4;

      // Row 0: type, x, y, radius
      let modType = 0; // destroy
      if (mod.type === "add") modType = 1;
      else if (mod.type === "carve") modType = 2;

      this.modTextureData[baseIdx + 0] = modType;
      this.modTextureData[baseIdx + 1] = mod.x;
      this.modTextureData[baseIdx + 2] = mod.y;
      this.modTextureData[baseIdx + 3] = mod.radius;

      // Row 1: nx, ny, length (for carve)
      const row1Idx = MAX_MODIFICATIONS * 4 + baseIdx;
      this.modTextureData[row1Idx + 0] = mod._nx ?? 0;
      this.modTextureData[row1Idx + 1] = mod._ny ?? 0;
      this.modTextureData[row1Idx + 2] = mod.length ?? 0;
      this.modTextureData[row1Idx + 3] = 0;
    }

    // Upload to GPU
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.modTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F, // 32-bit float for precision
      MAX_MODIFICATIONS,
      2, // 2 rows
      0,
      gl.RGBA,
      gl.FLOAT,
      this.modTextureData,
    );
  }

  /**
   * Render terrain to WebGL canvas.
   */
  render(
    seed: number,
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
    zoom: number,
  ): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao) return;

    // Clear with transparent
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use program
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Set uniforms
    gl.uniform1f(this.uniforms.seed, seed);
    gl.uniform2f(this.uniforms.cameraPos, camX, camY);
    gl.uniform2f(this.uniforms.viewSize, viewW, viewH);
    gl.uniform1f(this.uniforms.zoom, zoom);
    gl.uniform2f(this.uniforms.worldSize, WORLD_WIDTH, WORLD_HEIGHT);
    gl.uniform1i(this.uniforms.modCount, this.lastModCount);

    // Bind modification texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.modTexture);
    gl.uniform1i(this.uniforms.modTexture, 0);

    // Draw fullscreen quad (6 vertices = 2 triangles)
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Check if renderer is ready.
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Clean up WebGL resources.
   */
  dispose(): void {
    const gl = this.gl;
    if (!gl) return;

    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.modTexture) gl.deleteTexture(this.modTexture);

    this.isInitialized = false;
  }

  private compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(
        type === gl.VERTEX_SHADER ? "Vertex" : "Fragment",
        "shader error:",
        gl.getShaderInfoLog(shader),
      );
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }
}
