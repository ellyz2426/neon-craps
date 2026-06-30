# 🎲 Neon Craps VR

Casino craps in a holographic VR arena. Built with [IWSDK](https://github.com/nicepkg/iwsdk) v0.3.1.

**[▶ Play Now](https://ellyz2426.github.io/neon-craps/)**

## Features

- **24 Bet Types** — Pass/Don't Pass, Come/Don't Come, Field, Place (4–10), Buy (4–10), Lay (4–10), Hardways (4/6/8/10), Big 6/8, Any Seven, Any Craps, Craps & Eleven, Horn, Yo, and Hop bets
- **3D Dice Physics** — Realistic rolling with physics simulation
- **Holodeck Arena** — Neon-lit craps table with labeled bet zones and ON/OFF puck
- **8 Game Modes** — Classic, Speed, High Roller, Streak, Survival, Practice, Challenge, Tournament
- **40 Achievements** — Unlock milestones across gameplay
- **XR Ready** — Full VR support with laser pointer betting via controllers
- **Spatial UI** — 19 PanelUI panels for immersive menus, HUD, and notifications

## Controls

### Desktop
- **Mouse** — Click bet zones and UI buttons
- **1–9** — Quick bet amounts
- **Space** — Roll dice
- **P** — Pause

### VR
- **Laser Pointer** — Aim and select bets
- **Trigger** — Confirm selection
- **A Button** — Pause

## Tech Stack

- IWSDK v0.3.1
- Three.js r181
- ECS architecture (CrapsUISystem + CrapsGameSystem)
- 19 `.uikitml` PanelUI spatial panels
- Vite 7.3.6 with UIKitML compiler

## Development

```bash
npm install
npm run dev     # localhost:5173
npm run build   # production build to dist/
```

## License

MIT
