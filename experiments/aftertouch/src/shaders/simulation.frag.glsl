precision highp float;
uniform sampler2D u_state;
uniform float u_time;
uniform float u_dt;
uniform float u_turbulence;
uniform float u_decay;
uniform float u_particle_attraction;
uniform float u_aspect;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform vec2 u_pointer_previous;
uniform vec2 u_pointer_velocity;
uniform float u_active;
uniform float u_contact;
in vec2 v_uv;
out vec4 out_state;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec4 state = texture(u_state, v_uv);
  vec2 p = state.xy;
  vec2 velocity = state.zw;
  float seed = hash(v_uv);
  vec2 center = vec2(0.07 * sin(u_time * 0.14), 0.035 * cos(u_time * 0.17));
  vec2 q = p - center;
  q.y *= 1.17;
  float radius = max(length(q), 0.001);
  vec2 radial = q / radius;
  vec2 tangent = vec2(-radial.y, radial.x);
  float phase = atan(q.y, q.x);
  float band = 0.50 + 0.20 * seed + 0.045 * sin(phase * 3.0 + u_time * 0.18);
  vec2 field = tangent * (0.14 + seed * 0.10 + u_turbulence * 0.06);
  field += radial * (band - radius) * 0.65;
  // Analytic divergence-free curls: persistent particles move entirely on GPU.
  float f = 4.0;
  vec2 curl = vec2(-sin(p.y * f + u_time * 0.28) * cos(p.x * f - u_time * 0.2),
                   sin(p.x * f - u_time * 0.2) * cos(p.y * f + u_time * 0.28));
  field += curl * (0.025 + u_turbulence * 0.06);
  field += vec2(sin(phase * 5.0 + u_time * 0.25), cos(phase * 4.0 - u_time * 0.19)) * 0.018;
  // Affect the whole swept segment, including gaps between sparse touch events.
  vec2 stroke = u_pointer - u_pointer_previous;
  float alongStroke = clamp(dot(p - u_pointer_previous, stroke) / max(dot(stroke, stroke), 0.00001), 0.0, 1.0);
  vec2 toward = mix(u_pointer_previous, u_pointer, alongStroke) - p;
  float distanceToTouch = length(toward);
  vec2 direction = toward / max(distanceToTouch, 0.02);
  float swipeSpeed = length(u_pointer_velocity);
  float brushing = smoothstep(0.15, 1.1, swipeSpeed);
  // A compact fingertip footprint in CSS pixels, independent of viewport shape.
  float scale = u_aspect < 1.0 ? u_aspect * 1.55 : 1.22;
  float brushRadius = mix(18.0, 26.0, smoothstep(0.2, 6.0, swipeSpeed)) * 2.0 / (u_resolution.y * scale);
  float influence = (1.0 - smoothstep(0.25, 1.0, distanceToTouch / brushRadius)) * u_active;
  float burst = smoothstep(1.6, 2.8, u_particle_attraction);
  float orbit = 1.0 - smoothstep(0.08, 0.4, abs(u_particle_attraction - 0.5));
  vec2 touchForce = direction * u_particle_attraction * (1.0 - burst) * 0.6;
  touchForce -= direction * burst * 2.3;
  touchForce += vec2(-direction.y, direction.x) * orbit * 0.65;
  vec2 rootDrift = field + touchForce * influence * (1.0 - brushing) * 0.12;
  field += touchForce * influence * (1.0 - brushing * 0.9);
  vec2 combDirection = u_pointer_velocity / max(swipeSpeed, 0.001);
  vec2 combVelocity = combDirection * min(swipeSpeed * 0.9, 3.4) + field * 0.06;
  // A decaying pointer after release is not a new brush stroke. Preserve the
  // stretched fiber until actual movement returns, rather than overwriting it
  // with the slowing pointer at the end of a gesture.
  float movingContact = u_contact * step(0.0000001, dot(stroke, stroke));
  float combing = min(influence * brushing * movingContact, 0.98);
  field = mix(field, combVelocity, combing);
  // Keep the combed direction as elastic memory instead of throwing the root.
  // Strongly stretched fibers relax over seconds, while untouched fibers retain
  // the original flow. Contact can still redirect a remembered fiber immediately.
  float stretched = smoothstep(0.30, 0.75, length(velocity));
  float relaxation = mix(4.0, 0.22, stretched);
  velocity = mix(velocity, field, min(1.0, u_dt * (relaxation + combing * 30.0)));
  velocity *= pow(mix(u_decay, 0.996, stretched), u_dt * 20.0);
  p += rootDrift * u_dt;
  if (length(p) > 1.65) {
    float angle = seed * 6.2831853 + u_time * 0.1;
    p = vec2(cos(angle), sin(angle) / 1.17) * band;
    velocity = vec2(0.0);
  }
  out_state = vec4(p, velocity);
}
