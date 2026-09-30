precision highp float;
uniform sampler2D u_trail;
uniform vec2 u_resolution;
uniform float u_time;
in vec2 v_uv;
out vec4 out_color;
float noise(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 p = v_uv - 0.5;
  p.x *= u_resolution.x / u_resolution.y;
  vec3 light = texture(u_trail, v_uv).rgb;
  vec3 background = vec3(0.022, 0.029, 0.040) + vec3(0.013, 0.009, 0.003) * exp(-dot(p, p) * 2.5);
  vec3 color = background + vec3(1.0) - exp(-light * 1.9);
  color *= 1.0 - smoothstep(0.15, 1.15, length(p)) * 0.35;
  color += (noise(gl_FragCoord.xy + fract(u_time) * 71.0) - 0.5) * 0.006;
  out_color = vec4(color, 1.0);
}
