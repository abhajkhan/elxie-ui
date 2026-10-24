# ELXIE UI

Bluetooth-powered robot control and learning interface for the ELXIE platform.

## Overview

ELXIE UI is a mobile-first web application for controlling and interacting with an ELXIE robot over Bluetooth. The project combines robot command execution, live telemetry monitoring, and structured gameplay challenges in a single responsive interface. It allows users to drive the robot, monitor sensor data, and complete educational tasks designed around perception, memory, reflexes, and driving precision.

The application addresses the need for a lightweight, browser-based control layer in a robotics workflow. Instead of relying on fragmented tooling, ELXIE UI centralizes robot connectivity, challenge progression, and feedback into one interface. This makes the platform easier to use during live testing, training exercises, and hands-on robot interaction.

The system is built around a protocol-driven architecture. The frontend communicates with the robot through a custom Bluetooth protocol, updates telemetry in real time, and keeps the app state synchronized with the active game or control mode.

## Tech Stack

### Languages
- TypeScript
- JavaScript
- CSS
- HTML

### Frontend and application runtime
- Next.js 16
- React 19
- Tailwind CSS
- ESLint

### Robot communication and state management
- Web Bluetooth protocol client
- Custom JSON protocol for robot commands, telemetry, and game events
- React context-based state management
- Real-time telemetry and challenge synchronization

### Data and persistence
- MongoDB client support
- Local challenge progress tracking
- Browser-side state storage for session and gameplay data

### Tooling and deployment
- Node.js 20+
- npm
- Vercel deployment configuration
- Service worker registration for app-like runtime behavior

## Key Features

- Bluetooth connection lifecycle with handshake validation and live connection status
- Real-time robot telemetry for heading, obstacle detection, distance sensing, motion warnings, and battery info
- Manual joystick and directional control panel for robot movement
- Quick actions for LED color selection and audio feedback
- Challenge catalog with structured progression and game unlock logic
- Interactive learning modes for:
  - Colour Quest
  - Echo Memory
  - Driving Pro
  - Reflex Dash
  - Direction Invert
- Progress tracking across levels and tasks
- User synchronization and authentication via Clerk
- Responsive mobile-first UI optimized for robot control sessions
- Protocol-driven architecture aligned to robot firmware behavior

## Project Structure

```text
.
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── app/
│   ├── api/
│   ├── globals.css
│   ├── layout.tsx
│   ├── manifest.ts
│   ├── page.tsx
│   ├── playground/
│   │   ├── [mode]/
│   │   ├── blocks/
│   │   └── page.tsx
│   ├── profile/
│   ├── rc-mode/
│   ├── settings/
│   ├── sign-in/
│   └── sign-up/
├── components/
│   ├── games/
│   ├── AppHeader.tsx
│   ├── AppShell.tsx
│   ├── BluetoothConnectionGate.tsx
│   ├── BottomNav.tsx
│   ├── ColorWheelModal.tsx
│   ├── ControlPanel.tsx
│   ├── HomeDashboard.tsx
│   ├── JoystickController.tsx
│   ├── ModeCard.tsx
│   ├── ResultModal.tsx
│   ├── ServiceWorkerRegister.tsx
│   ├── SubPageHeader.tsx
│   └── UserSync.tsx
├── context/
│   └── BleContext.tsx
├── data/
│   └── gameCatalog.ts
├── docs/
├── games/
│   ├── registry.ts
│   └── useGameSession.ts
├── lib/
│   ├── ble/
│   ├── blocksUnlock.ts
│   ├── colourQuest.ts
│   ├── colourQuest.test.ts
│   ├── directionInvert.ts
│   ├── drivingPro.ts
│   ├── echoMemory.ts
│   ├── mongodb.ts
│   ├── progressStore.ts
│   └── useProgressSummaries.ts
├── public/
├── types/
│   └── protocol.ts
├── .gitignore
├── eslint.config.mjs
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── proxy.ts
├── tsconfig.json
├── vercel.json
└──
```

### Directory overview
- `app/`: Next.js App Router screens and route-level pages
- `components/`: reusable UI and robot control interfaces
- `context/`: shared Bluetooth connection and robot state management
- `data/`: game metadata and challenge definitions
- `games/`: runtime registration and gameplay session logic
- `lib/`: challenge algorithms, persistence, and protocol helpers
- `types/`: shared protocol types for robot communication and telemetry
- `public/`: static assets and app metadata
- `docs/`: supporting project documentation

## Getting Started

### Prerequisites
- Node.js 20 or later
- npm 10 or later
- A modern browser with Web Bluetooth support
- An ELXIE robot powered on and reachable from the browser

### Installation

```bash
git clone https://github.com/abhajkhan/elxie-ui.git
cd elxie-ui
npm install
```

### Run the application

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

### Production build

```bash
npm run build
npm run start
```

### Linting and tests

```bash
npm run lint
npm test
```

## Notes

This repository is focused on the control and training interface for the ELXIE robot ecosystem. Full hardware interaction requires a compatible robot and browser permission for Bluetooth access. The project is structured to separate UI, state management, gameplay logic, and protocol communication so it remains maintainable as the robot platform evolves.
