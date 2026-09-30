precision highp float;
in vec3 v_color;
in float v_alpha;
out vec4 out_color;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float light = exp(-r * r * 4.0) * (1.0 - smoothstep(0.7, 1.0, r));
  out_color = vec4(v_color * light * v_alpha, 1.0);
}
