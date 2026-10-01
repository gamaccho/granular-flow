precision highp float;
uniform sampler2D u_trail;
uniform float u_decay;
uniform float u_dt;
in vec2 v_uv;
out vec4 out_color;
void main() {
  // Preserve tapered edges without spatial diffusion: one texture read instead
  // of five, at the same resolution and with the same temporal persistence.
  vec3 light = texture(u_trail, v_uv).rgb;
  out_color = vec4(light * pow(u_decay, u_dt * 60.0), 1.0);
}
