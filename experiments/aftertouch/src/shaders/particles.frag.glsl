precision highp float;
in vec3 v_color;
in float v_alpha;
in vec2 v_fiber;
out vec4 out_color;
void main() {
  float across = abs(v_fiber.y);
  float ends = smoothstep(0.0, 0.12, v_fiber.x) * (1.0 - smoothstep(0.82, 1.0, v_fiber.x));
  float light = exp(-across * across * 5.0) * (1.0 - smoothstep(0.7, 1.0, across)) * ends;
  out_color = vec4(v_color * light * v_alpha, 1.0);
}
