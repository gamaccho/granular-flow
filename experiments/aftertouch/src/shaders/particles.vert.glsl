precision highp float;
uniform sampler2D u_state;
uniform float u_aspect;
uniform float u_pixel_ratio;
uniform float u_palette_blend;
uniform float u_turbulence;
uniform float u_density;
in vec3 position;
in vec2 a_uv;
out vec3 v_color;
out float v_alpha;
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
  gl_Position = vec4(p.x * scale / u_aspect, p.y * scale, 0.0, 1.0);
  gl_PointSize = (1.2 + seed * 1.4 + min(length(state.zw), 1.0) * 1.1) * u_pixel_ratio;
  float glow = clamp(seed * 0.65 + length(state.zw) * 0.35, 0.0, 1.0);
  v_color = palette(u_palette_blend, glow);
  if (u_palette_blend > 2.4) v_color += vec3(0.02, 0.19, 0.16) * sin(seed * 14.0);
  v_alpha = (0.022 + seed * 0.038) * u_density;
}
