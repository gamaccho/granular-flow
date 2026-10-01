precision highp float;
uniform sampler2D u_state;
uniform float u_time;
uniform float u_aspect;
uniform float u_pixel_ratio;
uniform float u_palette_blend;
uniform float u_turbulence;
uniform float u_density;
uniform vec2 u_resolution;
in vec3 position;
in vec2 a_uv;
out vec3 v_color;
out float v_alpha;
out vec2 v_fiber;
vec3 palette(float index, float glow) {
  vec3 blue = mix(vec3(0.13, 0.30, 0.51), vec3(0.54, 0.84, 1.0), glow);
  vec3 red = mix(vec3(0.49, 0.025, 0.05), vec3(1.0, 0.35, 0.07), glow);
  vec3 amber = mix(vec3(0.38, 0.16, 0.045), vec3(1.0, 0.74, 0.38), glow);
  vec3 violet = mix(vec3(0.22, 0.045, 0.49), vec3(0.76, 0.46, 1.0), glow);
  if (index < 1.0) return mix(blue, red, index);
  if (index < 2.0) return mix(red, amber, index - 1.0);
  return mix(amber, violet, index - 2.0);
}
void main() {
  vec4 state = texture(u_state, a_uv);
  vec2 p = state.xy;
  float seed = fract(sin(dot(a_uv, vec2(81.1, 23.7))) * 43758.5);
  float scale = u_aspect < 1.0 ? u_aspect * 1.55 : 1.22;
  float speed = length(state.zw);
  vec2 direction = speed > 0.001 ? state.zw / speed : vec2(1.0, 0.0);
  vec2 normal = vec2(-direction.y, direction.x);
  float t = position.x;
  float fiberLength = 0.012 + min(speed, 3.4) * 0.12;
  float width = (1.0 + seed * 0.45 + min(speed, 3.4) * 0.12) * 2.0 / (u_resolution.y * scale);
  float taper = mix(0.3, 1.0, smoothstep(0.0, 0.18, t)) * (1.0 - 0.75 * t * t * t);
  float bow = sin(t * 3.14159265) * min(speed, 3.4) * 0.004 * sin(seed * 6.2831853 + u_time * 0.2);
  p -= direction * fiberLength * (1.0 - t);
  p += normal * (position.y * width * taper + bow);
  gl_Position = vec4(p.x * scale / u_aspect, p.y * scale, 0.0, 1.0);
  v_fiber = vec2(t, position.y * 2.0);
  float glow = clamp(seed * 0.65 + speed * 0.35, 0.0, 1.0);
  v_color = palette(u_palette_blend, glow);
  if (u_palette_blend > 2.4) v_color += vec3(0.02, 0.19, 0.16) * sin(seed * 14.0);
  // Spread the light along the fiber so long swipes keep fine detail.
  v_alpha = (0.018 + seed * 0.022) * u_density / (1.0 + speed * 1.4);
}
