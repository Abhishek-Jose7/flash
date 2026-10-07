# 🕷️ Bit N Build Live Game Platform

A high-concurrency, mobile-first, real-time interactive game platform built for live flashmobs and crowd events. Designed to handle **100–500+ participants simultaneously scanning a QR code**, automatically assigning them to **Bit** or **Build**, and assembling a giant spider node-by-node in real time via fast trivia rounds.

---

## ⚡ Key Highlights & Architecture

- **High-Burst QR Onboarding**: Instantaneous load (< 80ms) for 100–200+ simultaneous phone scans.
- **In-Memory Atomic State Engine (O(1))**: Eliminates all N+1 database bottlenecks. Answer submissions, scoring, and node unlocks happen in-memory with atomic counters.
- **Idempotency Protection**: Double-taps, retries, and network glitches are gracefully handled without duplicate scoring or duplicate node unlocks.
- **The Amazing Spider-Man Node Graph**: Predefined mathematical model with **48 nodes and 64 edges** rendered at 60 FPS on HTML5 Canvas with glowing laser filaments, pulse particles, and chromatic aberration glitch bursts.
- **0 KB Procedural Web Audio**: Sound synthesizer using the browser's Web Audio API for countdown ticks, comic "THWIP!" web sounds, correct chimes, buzzers, and victory fanfare without downloading any audio files.
- **Deterministic Top 5 MVP Podium**: Automatically tracks individual contributions so the top 5 contributors from the winning team are revealed at the victory screen with zero database aggregation queries.

---

## 🚀 Quick Start

### 1. Start the Live Server
```bash
npm start
```
By default, the server runs on port `3000`.

### 2. Event URLs
| Screen | URL | Purpose |
| :--- | :--- | :--- |
| **Mobile Players** | `http://<HOST-OR-IP>:3000/` | Opened by audience phones via QR code. |
| **Host Controller** | `http://<HOST-OR-IP>:3000/admin` | Host dashboard to trigger questions, countdowns, and game resets (Passkey: `spiderverse`). |
| **Health Check** | `http://<HOST-OR-IP>:3000/health` | Live server connection and memory telemetry. |

---

## 🎮 How the Live Flashmob Works

```
1. PRE-EVENT (LOBBY)
   └── Audience opens the mobile page → automatically joins the smaller team

2. COUNTDOWN & QUESTION ROUNDS (1 to 8)
   ├── Host clicks "START EVENT" or "NEXT QUESTION" in /admin
   ├── 3-second countdown synchronizes across all phones
   ├── Kahoot-style question appears with 4 vibrant comic cards (Red 🕷️, Blue 🕸️, Yellow ⚡, Purple 🌀)
   └── Fast answers award up to 1,000 points based on speed

3. LIVE SPIDER NODE ASSEMBLY
   ├── Each correct answer lights up corresponding nodes and laser webs on that team's spider
   └── Team progress updates live on each phone!

4. GRAND VICTORY & PODIUM
   ├── First team to assemble 100% of their spider (or highest completion after Q8) wins!
   └── Victory celebration with the Top 5 MVPs of the winning team highlighted!
```

---

## 🧪 Testing & Concurrency Verification

### Run Unit Tests
```bash
npm test
```
*Verifies graph geometry, team balancing, double-tap idempotency, node unlock progression, and Top 5 MVP ranking.*

### Run 250–500 Concurrent Player Stress Test
```bash
# Test with 250 simultaneous players
npm run test:load

# Test with 500 simultaneous players
CLIENTS=500 node tests/loadTest.js
```
*Simulates 250–500 phones connecting in a 1-second QR burst and submitting Kahoot answers simultaneously.*

---

## 📝 Customizing Questions

Edit `server/questions.json` to configure trivia questions, time limits, and spider parts:
```json
{
  "id": 1,
  "question": "What is Miles Morales' iconic signature venom power?",
  "options": [
    "Venom Strike (Bio-Electricity)",
    "Web Camouflage",
    "Spider-Sense Negation",
    "Sonic Shriek"
  ],
  "correctIndex": 0,
  "timeLimitSec": 15,
  "spiderPart": "Thorax & Core Spine"
}
```
