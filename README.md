# ROBOCEK Platform

Embedded robotics development platform for ESP32. Build, upload, and monitor robot firmware from a desktop IDE or CLI.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [SDK Reference](#sdk-reference)
  - [Motor Control](#motor-control)
  - [Line Sensor](#line-sensor)
  - [Ultrasonic Sensor](#ultrasonic-sensor)
  - [Initialization](#initialization)
- [Board Configuration](#board-configuration)
- [CLI Reference](#cli-reference)
- [Project Structure](#project-structure)
- [Building from Source](#building-from-source)
- [License](#license)

---

## Overview

ROBOCEK provides a complete toolchain for ESP32 robotics:

- **ROBOCEK Studio** — Desktop IDE (Tauri + React) with code editor, file explorer, build output, and serial monitor
- **ROBOCEK CLI** — Python command-line interface for project management and firmware building
- **ROBOCEK SDK** — C++ hardware abstraction library for motors, line sensors, and ultrasonic sensors

Target board: **ROBOCEK ESP32 Robot V1** (ESP32 + TB6612 motor driver)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  ROBOCEK Studio                      │
│              (Tauri + React + Monaco)                │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Sidebar │  │  Editor  │  │  Output / Monitor │  │
│  │ (files)  │  │ (Monaco) │  │  (build + serial) │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                       │                              │
│              Tauri IPC (invoke + events)             │
│                       │                              │
│  ┌────────────────────────────────────────────────┐  │
│  │              Rust Backend (lib.rs)              │  │
│  │  process spawning, serial I/O, file system      │  │
│  └────────────────────────────────────────────────┘  │
│                       │                              │
│              Subprocess (robocek CLI)                 │
│                       │                              │
│  ┌────────────────────────────────────────────────┐  │
│  │           Python CLI (robocek-cli)              │  │
│  │  project generation, config, PlatformIO calls   │  │
│  └────────────────────────────────────────────────┘  │
│                       │                              │
│              PlatformIO → ESP32 firmware              │
└─────────────────────────────────────────────────────┘
```

---

## Installation

### Option A — Desktop IDE (Recommended)

Download the latest release for your platform:

| Platform | Installer |
|---|---|
| Windows | `.exe` (NSIS) or `.msi` |
| Linux | `.deb` or `.AppImage` |
| macOS | `.dmg` |

On first launch, the IDE automatically installs:
1. Python 3.10+ (if missing)
2. Virtual environment at `~/.robocek/penv`
3. PlatformIO Core
4. ROBOCEK CLI + SDK

### Option B — CLI Only

```bash
pip install robocek
```

---

## Quick Start

### 1. Create a New Project

**IDE:** Click "New Project" → pick a template → name it → Create

**CLI:**
```bash
robocek create line-follower my-robot --board robocek-esp32-v1
cd my-robot
```

### 2. Build Firmware

**IDE:** Click the **Build** button in the toolbar

**CLI:**
```bash
robocek build
```

### 3. Upload to Board

**IDE:** Click the **Upload** button

**CLI:**
```bash
robocek upload
```

### 4. Open Serial Monitor

**IDE:** Click the **Monitor** button

**CLI:**
```bash
robocek monitor
```

---

## SDK Reference

All SDK functions are in the `RC` namespace. Include the master header:

```cpp
#include <robocek.h>
```

### Motor Control

**Source:** `lib/robocek-sdk/src/motor/motor.h`  
**Instance:** `RC::Motor`

| Method | Description |
|---|---|
| `Motor.begin()` | Initialize motor driver pins and PWM channels |
| `Motor.forward(int speed)` | Drive both motors forward (0–255) |
| `Motor.backward(int speed)` | Drive both motors backward (0–255) |
| `Motor.left(int speed)` | Turn left (right motor forward, left motor backward) |
| `Motor.right(int speed)` | Turn right (left motor forward, right motor backward) |
| `Motor.stop()` | Stop all motors |

**Example:**
```cpp
#include <robocek.h>

void setup() {
    RC::begin();
}

void loop() {
    Motor.forward(200);   // Full speed forward
    delay(1000);
    Motor.stop();
    delay(500);
    Motor.left(150);      // Turn left
    delay(500);
    Motor.stop();
}
```

### Line Sensor

**Source:** `lib/robocek-sdk/src/line_sensor/line_sensor.h`  
**Instance:** `RC::LineSensor`

| Method | Description |
|---|---|
| `LineSensor.begin()` | Initialize sensor pins as inputs |
| `LineSensor.isLeftDetected()` | Returns `true` if left sensor detects the line |
| `LineSensor.isRightDetected()` | Returns `true` if right sensor detects the line |

**Example:**
```cpp
void loop() {
    bool left = LineSensor.isLeftDetected();
    bool right = LineSensor.isRightDetected();

    if (!left && !right) {
        Motor.forward(200);       // Both sensors off line → go straight
    } else if (left && !right) {
        Motor.left(150);          // Left sensor on line → turn left
    } else if (!left && right) {
        Motor.right(150);         // Right sensor on line → turn right
    } else {
        Motor.stop();            // Both on line → stop
    }
}
```

### Ultrasonic Sensor

**Source:** `lib/robocek-sdk/src/ultrasonic/ultrasonic.h`  
**Instance:** `RC::Ultrasonic`

| Method | Description |
|---|---|
| `Ultrasonic.begin()` | Initialize trigger/echo pins |
| `Ultrasonic.read()` | Returns `UltrasonicDistance` with `.left` and `.right` in centimeters |

**Example:**
```cpp
void loop() {
    UltrasonicDistance dist = Ultrasonic.read();

    if (dist.left < 10.0f) {
        // Obstacle on the left
        Motor.right(200);
        delay(300);
    } else if (dist.right < 10.0f) {
        // Obstacle on the right
        Motor.left(200);
        delay(300);
    } else {
        Motor.forward(200);
    }

    delay(50);
}
```

### Initialization

**Source:** `lib/robocek-sdk/src/robocek.h`

```cpp
RC::begin();  // Calls Motor.begin(), LineSensor.begin(), Ultrasonic.begin()
```

Call this once in `setup()` before using any hardware.

---

## Board Configuration

Board pin definitions are in `robocek-cli/robocek/boards/robocek-esp32-v1/board.yaml`.

The build system auto-generates `generated/robocek_config.h` from this YAML. **Do not edit the generated file directly** — modify `board.yaml` and rebuild.

### ROBOCEK ESP32 Robot V1 Pin Map

| Function | GPIO Pin |
|---|---|
| Motor Standby | 23 |
| Left Motor PWM | 33 |
| Left Motor IN1 | 18 |
| Left Motor IN2 | 19 |
| Right Motor PWM | 25 |
| Right Motor IN1 | 26 |
| Right Motor IN2 | 27 |
| Line Sensor Left | 32 |
| Line Sensor Right | 35 |
| Ultrasonic Left Trigger | 32 |
| Ultrasonic Left Echo | 35 |
| Ultrasonic Right Trigger | 5 |
| Ultrasonic Right Echo | 34 |
| I2C SDA | 21 |
| I2C SCL | 22 |

---

## CLI Reference

| Command | Description |
|---|---|
| `robocek create <template> <name> [--board]` | Create a new project from a template |
| `robocek build` | Generate config and compile firmware |
| `robocek upload` | Build and upload firmware to the board |
| `robocek monitor` | Open serial monitor |
| `robocek devices` | List connected serial devices |
| `robocek config` | Generate hardware configuration only |
| `robocek board list` | List available boards |
| `robocek board info <id>` | Show board details |
| `robocek template list` | List available templates |
| `robocek version` | Show CLI version |

---

## Project Structure

Every ROBOCEK project follows this layout:

```
my-robot/
├── robocek.yaml              # Project metadata (name, template, board)
├── platformio.ini            # PlatformIO build configuration
├── src/
│   └── main.cpp              # Your firmware code
├── include/                  # User headers (empty by default)
├── lib/
│   └── robocek-sdk/
│       └── src/              # ROBOCEK SDK (auto-copied)
│           ├── robocek.h     # Master header
│           ├── motor/        # Motor control
│           ├── line_sensor/  # Line sensor
│           └── ultrasonic/   # Ultrasonic sensor
├── test/                     # Unit tests (empty by default)
└── generated/
    └── robocek_config.h      # Auto-generated pin definitions
```

---

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) (latest stable)
- [Python](https://python.org) 3.10+
- [PlatformIO](https://platformio.org) Core

### Steps

```bash
# Clone the repository
git clone https://github.com/your-org/robocek-platform.git
cd robocek-platform

# Install frontend dependencies
cd robocek-ide
npm install

# Run in development mode
npm run tauri dev

# Build production installers
npm run tauri build
```

---

## License

Copyright (c) ROBOCEK GCEK. All rights reserved.
