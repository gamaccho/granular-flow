precision highp float;
uniform sampler2D u_trail;
uniform float u_decay;
uniform float u_dt;
uniform vec2 u_texel;
in vec2 v_uv;
out vec4 out_color;
void main() {
  vec3 center = texture(u_trail, v_uv).rgb;
  vec3 neighbors = texture(u_trail, v_uv + vec2(u_texel.x, 0.0)).rgb
    + texture(u_trail, v_uv - vec2(u_texel.x, 0.0)).rgb
    + texture(u_trail, v_uv + vec2(0.0, u_texel.y)).rgb
    + texture(u_trail, v_uv - vec2(0.0, u_texel.y)).rgb;
  vec3 light = mix(center, neighbors * 0.25, min(u_dt * 4.0, 0.12));
  out_color = vec4(light * pow(u_decay, u_dt * 60.0), 1.0);
}
