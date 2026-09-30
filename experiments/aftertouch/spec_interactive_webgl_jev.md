# Spec: Interactive WebGL Experience Powered by TypeSafe AI "Jev"

## 1. Project Overview & Goal
Build a high-performance, real-time interactive WebGL experience (Three.js + custom GLSL shaders) that dynamically alters visual behavior using **TypeSafe AI's Jev** model.
The installation analyzes touch/pointer motion nuances (e.g., speed, jitter, dwell time) to infer user emotional state (`hesitant`, `aggressive`, `tender`, `playful`), transforming particle fluid / flame dynamics with sub-100ms latency.

---

## 2. Tech Stack & Architecture
- **Frontend / Graphics**: Vanilla HTML5, Three.js (r160+), Custom RawShaderMaterial (GLSL ES 3.0), Tailwind CSS (for minimal UI overlay).
- **Backend Proxy / Edge**: Cloudflare Worker or Node.js lightweight proxy (Hono / Express) to protect the Jev API key and enforce rate limiting.
- **Inference Engine**: TypeSafe AI - Jev API (`Score` / `Choice` primitives via typed schemas).

### Data Flow
```
[User Touch/Pointer Events]
       │ (Feature Extraction: velocity, jitter, dwell, path curvature)
       ▼ (Debounced: Max 1 call per 800ms)
[Edge Proxy (Secure Key & Rate Limit)]
       │
       ▼ (TypeSafe Jev API: jev-latest)
[Inferred State: mode ("tender"|"aggressive"|...), confidence (0.0-1.0)]
       │
       ▼ (Smooth Uniform LERP interpolation at 60fps)
[WebGL Fragment / Vertex Shader (Particle Dynamics & Palette Shifts)]
```

---

## 3. Directory Structure
```
project-root/
├── package.json
├── vite.config.js
├── public/
│   └── index.html
├── src/
│   ├── main.js              # Entrypoint, canvas setup, animation loop
│   ├── input/
│   │   └── gestureTracker.js # Pointer/touch feature metrics calculator
│   ├── client/
│   │   └── jevClient.js      # Backend proxy fetcher with fallbacks
│   └── shaders/
│       ├── simulation.vert.glsl
│       └── simulation.frag.glsl
└── server/
    └── index.js             # Secure edge proxy (Express or Hono)
```

---

## 4. Key Implementation Components

### 4.1 Gesture Feature Extractor (`src/input/gestureTracker.js`)
Track pointer movements over a sliding window (last 600ms) and extract:
- `avg_speed`: Average pointer movement distance per millisecond.
- `jitter`: Standard deviation of movement direction changes (trembling / erratic motion).
- `dwell_ratio`: Proportion of time the pointer hovered nearly still.
- `stroke_length`: Total path distance.

```javascript
export class GestureTracker {
  constructor(debounceMs = 800) {
    this.history = [];
    this.lastTrigger = 0;
    this.debounceMs = debounceMs;
  }

  record(x, y) {
    const now = performance.now();
    this.history.push({ x, y, t: now });
    // Keep only last 600ms
    this.history = this.history.filter(p => now - p.t <= 600);
  }

  shouldEvaluate() {
    const now = performance.now();
    return this.history.length > 5 && (now - this.lastTrigger > this.debounceMs);
  }

  getMetrics() {
    this.lastTrigger = performance.now();
    // Calculate speed, jitter, and dwell ratio from this.history
    // Returns structured summary object
    return {
      speed: Number(calculatedSpeed.toFixed(2)),
      jitter: Number(calculatedJitter.toFixed(2)),
      dwellRatio: Number(calculatedDwell.toFixed(2))
    };
  }
}
```

### 4.2 Jev API Typed Classification (`server/index.js` or Edge Function)
The proxy calls TypeSafe Jev using its structured classification endpoint.

```javascript
// server/index.js (Proxy Endpoint)
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const JEV_API_KEY = process.env.TYPESAFE_API_KEY;

app.post('/api/infer-mood', async (req, res) => {
  const { speed, jitter, dwellRatio } = req.body;

  const prompt = `Analyze gesture metrics: speed=${speed}, jitter=${jitter}, dwellRatio=${dwellRatio}. Determine touch intent.`;

  try {
    const response = await fetch("https://api.typesafe.ai/v1/inference", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${JEV_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "jev-latest",
        prompt: prompt,
        task: "choice",
        options: ["hesitant", "aggressive", "tender", "playful"]
      })
    });

    const data = await response.json();
    // Returns: { choice: "tender", confidence: 0.88 }
    res.json(data);
  } catch (err) {
    // Fail-safe default
    res.json({ choice: "tender", confidence: 0.5 });
  }
});

app.listen(3000, () => console.log('Proxy running on port 3000'));
```

### 4.3 WebGL Shader Target Uniforms
The shader must accept target values that smoothly LERP inside `requestAnimationFrame`:

| Uniform | Type | `hesitant` | `aggressive` | `tender` | `playful` |
|---|---|---|---|---|---|
| `u_turbulence` | float | 0.2 | 2.5 | 0.4 | 1.2 |
| `u_decay` | float | 0.98 | 0.85 | 0.95 | 0.92 |
| `u_palette_blend` | float | 0.0 (Pale blue) | 1.0 (Blazing crimson) | 2.0 (Warm amber) | 3.0 (Prismatic violet) |
| `u_particle_attraction` | float | -0.5 (repel) | 3.0 (burst) | 1.0 (cling) | 0.5 (orbit) |

### 4.4 Transition Interpolation (`src/main.js`)
- Do **not** apply shader values instantly.
- In the animation loop, continuously interpolate current values toward target values using `target = target + (next - target) * (deltaTime * 2.5)`.

---

## 5. Security & Safety Guards
1. **Never expose `TYPESAFE_API_KEY` on the client**.
2. **Client-side debouncing**: Cap inference requests to max 1 request every 800ms.
3. **Graceful Degradation**: If network latency exceeds 300ms or fails, fallback to simple heuristic physics without throwing errors or dropping frame rate.
4. **Rate Limiting**: Limit IP-based requests in the proxy to 30 requests/minute.

---

## 6. Execution Instructions for CodeX
1. Initialize project with `vite` and install `three`, `express`, `cors`, `dotenv`.
2. Generate the Three.js full-screen particle/flame simulation canvas with an interactive pointer listener.
3. Create `server/index.js` mockable proxy that connects to TypeSafe AI's Jev API.
4. Wire gesture tracking to send metrics to `/api/infer-mood` and LERP the uniform values in the render loop.
5. Provide a `.env.example` file containing `TYPESAFE_API_KEY=your_key_here`.