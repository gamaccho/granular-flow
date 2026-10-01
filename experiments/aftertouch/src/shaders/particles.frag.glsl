precision highp float;
in vec3 v_color;
in float v_alpha;
in vec2 v_fiber;
out vec4 out_color;
void main() {
  // t=0 is the trailing tip. Taper per fragment so a four-vertex ribbon can
  // narrow continuously, instead of relying on vertex-only endpoint widths.
  float tipWidth = max(0.025, sqrt(smoothstep(0.0, 0.50, v_fiber.x)));
  float across = abs(v_fiber.y) / tipWidth;
  float ends = smoothstep(0.0, 0.35, v_fiber.x) * (1.0 - smoothstep(0.82, 1.0, v_fiber.x));
  float light = exp(-across * across * 5.0) * (1.0 - smoothstep(0.7, 1.0, across)) * ends;
  out_color = vec4(v_color * light * v_alpha, 1.0);
}
