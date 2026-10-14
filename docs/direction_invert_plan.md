# Direction Invert — Game Design & Specification

**Mode:** Direction Invert · **Canonical game ID:** `inverted_drive` · **Total levels in mode:** 6
**Current implementation scope:** Levels 1–6
**Protocol:** Elxie Communication JSON Contract v1.0 — used as-is. No new message types, no renamed fields, no new payload fields.
**Core Mechanic:** The robot's movement direction is intentionally different from the direction given by the player. The player must learn and adapt to the active direction mapping while driving and completing the required movement objectives.

The robot is authoritative for direction mapping, level timing, task progression, movement behavior, collision detection, turn counting, task success/failure, score, stars, and the final result. The mobile/web application displays instructions, sends player input, and displays results.

> **Implementation gating.** The contract lists `inverted_drive` as placeholder/future (§12) and forbids implementing future game functionality during Phase 5 (§44.20). Direction Invert is therefore implemented only **after** the Phase 5 acceptance tests (§45) pass. Until the game ships, `inverted_drive` may appear in `device_info.capabilities.games` as a placeholder (§6), and `game_start` for it returns an `error` with code `GAME_NOT_IMPLEMENTED`. When the game ships, only the status column of contract §12 changes; no message changes.

---

## Game Objective

Direction Invert is a driving challenge where the joystick direction does not always correspond to the robot's normal movement. The player must learn the active direction mapping and use it correctly to complete three objectives in each level.

The mode teaches four control concepts across six levels:

1. Forward/Backward Invert (L1–L2)
2. Steering Invert (L3–L4)
3. Full Invert (L5)
4. Dynamic Invert (L6)

---

## Level-1: Forward/Backward Invert

In Level 1, the player learns the basic Forward/Backward Invert concept.

There are three objectives. Completing each objective gives one star.

The active direction mapping is:

* **Forward → Backward**
* **Backward → Forward**
* **Left → Left**
* **Right → Right**

On clicking **Start Level**, the task instructions are displayed on the UI.

When the player clicks **GO**, the actual mission starts and the level timer starts (see §3 and §5.1 for how GO maps to the protocol).

The player must drive the robot while adapting to the inverted Forward/Backward controls.

The player works toward three objectives:

1. Drive safely without collision for the required time.
2. Complete the required number of turns.
3. Complete the required number of left and right turns.

The player can continue driving while completing all objectives.

When an objective is successfully completed, a success/feedback message is shown and the player continues with the remaining objectives.

When all three objectives are successfully completed, the level is completed and the result is shown in the score card.

If the level timer expires before all objectives are completed, the level ends and the current progress/result is shown.

### Level 1 Task 1

* Forward/Backward direction is inverted.
* Left/right direction remains normal.
* Player must adapt to the inverted movement.
* Drive without collision for the required duration.
* Collision detection remains active.

### Level 1 Task 2

* Same Forward/Backward Invert behavior.
* Player continues driving using the inverted controls.
* Minimum required number of turns must be completed.

### Level 1 Task 3

* Same Forward/Backward Invert behavior.
* Player must complete the required left/right turn counts.
* Level completes when all three objectives are successfully completed.

---

## Level-2: Forward/Backward Invert — Challenge

Level 2 continues the Forward/Backward Invert concept from Level 1 with greater movement constraints.

The active direction mapping remains:

* **Forward → Backward**
* **Backward → Forward**
* **Left → Left**
* **Right → Right**

The purpose of this level is to reinforce the inversion learned in Level 1 while requiring more movement and turning.

On clicking **Start Level**, the task instructions are displayed. When **GO** is selected, the mission starts and the level timer begins. The player works on all three objectives during the level.

### Level 2 Task 1

* Same Forward/Backward Invert behavior.
* Drive safely without collision.
* Required driving duration must be completed.

### Level 2 Task 2

* Same inverted movement behavior.
* Higher minimum turn requirement than Level 1.
* Player must complete the required total turns.

### Level 2 Task 3

* Same inverted movement behavior.
* Player must complete the required left and right turn counts.
* Level completes when all three objectives are completed.

---

## Level-3: Steering Invert

Level 3 introduces the second control concept: Steering Invert.

The active direction mapping is:

* **Forward → Forward**
* **Backward → Backward**
* **Left → Right**
* **Right → Left**

Forward and backward movement remain normal, but left and right steering are reversed.

On clicking **Start Level**, the task instructions are displayed. When **GO** is selected, the mission starts and the level timer begins. The player must adapt to the reversed steering while completing the three objectives.

### Level 3 Task 1

* Forward/backward movement remains normal.
* Left/right steering is inverted.
* Drive safely without collision for the required duration.

### Level 3 Task 2

* Same Steering Invert behavior.
* Player must complete the required total number of turns.

### Level 3 Task 3

* Same Steering Invert behavior.
* Player must complete the required left and right turn counts.
* Level completes when all three objectives are completed.

---

## Level-4: Steering Invert — Challenge

Level 4 reinforces the Steering Invert concept introduced in Level 3.

The active direction mapping remains:

* **Forward → Forward**
* **Backward → Backward**
* **Left → Right**
* **Right → Left**

The player must continue adapting to reversed steering while handling greater movement and turning constraints.

On clicking **Start Level**, the task instructions are displayed. When **GO** is selected, the mission starts and the level timer begins.

### Level 4 Task 1

* Forward/backward movement remains normal.
* Left/right steering remains inverted.
* Drive safely without collision for the required duration.

### Level 4 Task 2

* Same Steering Invert behavior.
* Higher minimum turn requirement.
* Player must complete the required total turns.

### Level 4 Task 3

* Same Steering Invert behavior.
* Player must complete the required left and right turn counts.
* Level completes when all three objectives are completed.

---

## Level-5: Full Invert

Level 5 introduces Full Invert.

The active direction mapping is:

* **Forward → Backward**
* **Backward → Forward**
* **Left → Right**
* **Right → Left**

Both movement and steering directions are now inverted.

On clicking **Start Level**, the full inversion instructions are displayed. When **GO** is selected, the mission starts and the level timer begins. The player must adapt to both inverted movement and inverted steering while completing all three objectives.

### Level 5 Task 1

* Forward/backward is inverted.
* Left/right is inverted.
* Drive safely without collision for the required duration.

### Level 5 Task 2

* Full Invert remains active.
* Player must complete the required total number of turns.

### Level 5 Task 3

* Full Invert remains active.
* Player must complete the required left and right turn counts.
* Level completes when all three objectives are completed.

---

## Level-6: Dynamic Invert

Level 6 introduces Dynamic Invert.

Unlike the previous levels, the active direction mapping changes during the level.

The level uses **Normal Control ↔ Full Invert**. The player must adapt whenever the control mapping changes.

Before a mapping change, the robot provides a transition/warning indication, delivered through robot-side outputs (OLED, LEDs, buzzer) and, when the physical remote is the controller, a `haptic` message with pattern `warning` (contract §31). The new mapping then becomes active.

The current implementation uses a 30-second level and changes the control behavior during the level. The approximate control sequence is:

**Normal → Full Invert → Normal**

On clicking **Start Level**, the player receives the Dynamic Invert instructions. When **GO** is selected, the mission starts and the level timer begins. The player must continuously adapt to the currently active control mapping while completing all three objectives.

### Level 6 Task 1

* Control starts in Normal mode.
* Full Invert becomes active during the level.
* Control can return to Normal mode later.
* Player must drive safely without collision.

### Level 6 Task 2

* Player must continue adapting while the control mapping changes.
* Required total number of turns must be completed.

### Level 6 Task 3

* Player must complete the required left and right turn counts while adapting to the changing control mapping.
* Level completes when all three objectives are successfully completed.

---

## Level Progression

| Level  | Control Concept         | Learning Purpose                                      |
| ------ | ----------------------- | ----------------------------------------------------- |
| **L1** | Forward/Backward Invert | Learn basic directional inversion                     |
| **L2** | Forward/Backward Invert | Reinforce inversion with greater constraints          |
| **L3** | Steering Invert         | Learn reversed left/right steering                    |
| **L4** | Steering Invert         | Reinforce steering inversion with greater constraints |
| **L5** | Full Invert             | Combine movement and steering inversion               |
| **L6** | Dynamic Invert          | Adapt when the control mapping changes during play    |

The progression follows:

**Learn → Practise → Increase Constraints → Introduce New Control Concept → Practise → Adapt to Changes**

---

## 1. Identity

| Field | Value |
| ----- | ----- |
| Mode | Direction Invert |
| Game ID (wire) | `inverted_drive` — the display name "Inverted Drive" must never be used in protocol messages |
| Levels | 6 (implementation scope L1–L6) |
| Input Method | Joystick — BLE `input` message or ESP-NOW input packet, normalized to the same firmware input event |
| Feedback | Mobile UI, OLED, LEDs/Buzzer, remote haptic — where applicable |
| Telemetry | Optional. Enabled by the mobile app with `telemetry_config`; allowed while the robot is in `GAME` |
| Objectives | 3 per level, tracked simultaneously |
| Core Mechanic | Directional input is transformed by the robot before it controls movement |
| Robot Authority | Timing, direction mapping, collision detection, turn counting, objective completion, scoring, stars, final result |
| Level 1–2 | Forward/Backward Invert |
| Level 3–4 | Steering Invert |
| Level 5 | Full Invert |
| Level 6 | Dynamic Invert |

---

## 2. Level Parameters

| Level | Concept | Level timer | Min total turns | Min left turns | Min right turns |
| ----- | ------- | ----------- | --------------- | -------------- | --------------- |
| L1 | Forward/Backward Invert | TBD | TBD | TBD | TBD |
| L2 | Forward/Backward Invert | TBD | TBD (higher than L1) | TBD | TBD |
| L3 | Steering Invert | TBD | TBD | TBD | TBD |
| L4 | Steering Invert | TBD | TBD (higher than L3) | TBD | TBD |
| L5 | Full Invert | TBD | TBD | TBD | TBD |
| L6 | Dynamic Invert | 30 s | TBD | TBD | TBD |

Each successfully completed objective awards 1 star (0–3 stars per level).

The current Direction Invert specification does not define exact durations or turn-count values, so they remain **TBD** and must not be copied from Driving Pro (9 s / 5 turns / 2 left / 3 right).

These values are firmware configuration (built-in level table in `GameConfig.h`), not protocol values.

---

## 3. Game Flow

### Mobile play (BLE)

1. The user selects Direction Invert and a level in the mobile UI. This is **UI only** — the contract defines no "select game/level" message and none may be added.
2. The mobile app displays the task instructions and the **GO** button. Instruction content is app-side content.
3. **GO** sends the Protocol v1 `game_start` command with `gameId: "inverted_drive"` and the level (§5.1).
4. The robot validates the request (§5.8), replies `game_started` with `status: "running"`, starts the non-blocking level timer, and begins tracking all three objectives.
5. The player drives with joystick `input` messages. The robot applies the active mapping and executes movement.
6. When an objective is passed, the robot sends a `game_state` message with `task` and `status: "passed"` (§5.4). The level continues.
7. The level ends when all three objectives have passed, the timer expires, or the objectives can no longer be satisfied. The robot sends a level-level `game_state` (`completed` or `failed`) and then the authoritative `game_result` (§5.5, §5.6).
8. The mobile app displays the result and stores persistent progression.

### Remote-only play (ESP-NOW, no BLE)

1. Level selection and instructions use the existing local OLED menu path (`GameManager::start(gameId, level, ControlSource::REMOTE)`). No protocol message is generated.
2. The remote supplies joystick input; the robot gives feedback on OLED, LEDs, buzzer, and remote haptic (§7).
3. The result is stored and delivered later through `results_sync` when BLE connects (§5.9).

The level continues until the level timer ends or all three objectives are completed.

---

## 4. Task Rules

### Task 1

Ride using the active Direction Invert mapping for the required duration without collision.

Success:

```text
time >= required duration
AND
no collision
```

Failure:

```text
collision detected
OR
required duration not reached at timeout
```

### Task 2

Ride using the active Direction Invert mapping and perform the required number of turns.

A turn is counted when the steering direction changes into a left or right turn. Holding the same direction continuously counts as one turn. Turns are counted on the **mapped (actual) steering direction of the robot**, not on the raw player input (see Direction Mapping).

Success:

```text
time >= required duration
AND
no collision
AND
totalTurns >= required turns
```

Failure:

```text
collision
OR
totalTurns < required turns at timeout
```

### Task 3

Ride using the active Direction Invert mapping with the required left and right turn counts.

```text
minimum left turns  = required left turns
minimum right turns = required right turns
```

Success:

```text
time >= required duration
AND
no collision
AND
leftTurns >= required left turns
AND
rightTurns >= required right turns
```

Failure:

```text
collision
OR
leftTurns < required left turns at timeout
OR
rightTurns < required right turns at timeout
```

### Direction Mapping

The active mapping depends on the level:

```text
L1–L2 → Forward/Backward Invert
L3–L4 → Steering Invert
L5    → Full Invert
L6    → Dynamic Invert (Normal → Full Invert → Normal)
```

| Concept | Forward | Backward | Left | Right |
| ------- | ------- | -------- | ---- | ----- |
| Normal (L6 start/end) | Forward | Backward | Left | Right |
| Forward/Backward Invert | Backward | Forward | Left | Right |
| Steering Invert | Forward | Backward | Right | Left |
| Full Invert | Backward | Forward | Right | Left |

Rules:

- The mapping is applied **inside `InvertedDrive`** (the game's `handleInput()`), on the normalized input event, **before** the existing safety checks.
- The mapping is never applied in `BleProtocol`, `EspNowProtocol`, `ControllerManager`, `RobotController`, or `MotorController`.
- A "stop" input (`none`) is never inverted and always stops movement.
- The mapping is owned by firmware and derived from the level number. It is not transmitted in any message.
- The direction mapping changes how the player's input controls the robot; task success conditions remain based on the robot's actual gameplay state.

---

## 5. JSON Contract

Direction Invert uses the existing Protocol v1 JSON contract (`Communication_JSON_Contract.md`, v1.0). It must not introduce new message types, rename or add fields, or create a Direction Invert-specific communication protocol.

### Messages used

| Purpose | Direction | Message | Contract § |
| ------- | --------- | ------- | ---------- |
| Start level (GO) | Mobile → ESP32 | `command` / `game_start` | §13 |
| Start confirmation | ESP32 → Mobile | `response` / `game_started` | §13 |
| Player input (BLE) | Mobile → ESP32 | `input` (joystick) | §9.1, §11 |
| Player input (remote) | Remote → ESP32 | ESP-NOW `input` with `seq` | §29, §33 |
| Objective result | ESP32 → Mobile | `game_state` with `task` | §19 |
| Level outcome | ESP32 → Mobile | `game_state` without `task` | §19 |
| Final result | ESP32 → Mobile | `game_result` | §20 |
| Offline result delivery | ESP32 ↔ Mobile | `results_sync` / `results_sync_ack` | §21 |
| Abort | Mobile → ESP32 | `command` / `game_abort`, then `ack` | §16, §26 |
| Errors | ESP32 → Mobile | `error` | §27 |
| Telemetry | Mobile ↔ ESP32 | `telemetry_config`, `telemetry` | §23–§25 |
| Remote feedback | ESP32 → Remote | `haptic`, `robot_status` | §31, §32 |

Communication flow:

```text
Mobile/Web
    ↓
game_start
    ↓
ESP32 GameManager → InvertedDrive (GameEngine)
    ↓
input
    ↓
InvertedDrive
    ↓
game_state / game_result
```

### 5.1 Game Start

Mobile → ESP32:

```json
{
  "v": 1,
  "type": "command",
  "command": "game_start",
  "id": "game-001",
  "payload": {
    "gameId": "inverted_drive",
    "level": 1
  }
}
```

ESP32 → Mobile:

```json
{
  "v": 1,
  "type": "response",
  "response": "game_started",
  "id": "game-001",
  "payload": {
    "gameId": "inverted_drive",
    "level": 1,
    "status": "running"
  }
}
```

The `id` from `game_start` must be copied into the `game_started` response (§3).

On acceptance the robot stops any RC movement, enters `GAME` (§28), starts the level timer, and begins objective tracking. `game_start` is the **GO** action; it is sent once per level attempt.

`level` is an integer. The protocol layer validates only that it is a well-formed integer ≥ 1. The valid range for `inverted_drive` (1–6) is validated by `GameManager` against the game registry (§5.8), so future levels are not blocked by the protocol (§13).

### 5.2 Start Task / GO

There is no separate `start_task` message in Protocol v1. Do not introduce `start_task`, `task_start`, or any equivalent custom message.

The UI-level **GO** action is implemented by the mobile/web application sending `game_start` (§5.1). Level selection and the instruction screen are app UI and produce no protocol traffic.

### 5.3 Game Input

During an active Direction Invert game, joystick input uses the existing Protocol v1 `input` message (§9.1).

Mobile → ESP32:

```json
{
  "v": 1,
  "type": "input",
  "id": "input-1001",
  "ts": 123456789,
  "payload": {
    "inputType": "joystick",
    "dir": "up",
    "magnitude": 0.9
  }
}
```

Stop (§10):

```json
{
  "v": 1,
  "type": "input",
  "id": "input-1002",
  "ts": 123456790,
  "payload": {
    "inputType": "joystick",
    "dir": "none",
    "magnitude": 0.0
  }
}
```

> **Direction vocabulary.** The contract's joystick examples (§8–§10, §14, §17) use `dir: "up"`, while Appendix A enumerates `forward / backward / left / right / none`. Direction Invert does not define its own vocabulary: it accepts whatever the Phase 5 `BleProtocol` accepts for existing games and receives only the **normalized** firmware input event. The words forward/backward/left/right in this document are the normalized meanings (`up` ≙ forward).

For ESP-NOW the remote uses the §29 packets, each with a monotonically increasing `seq`:

```json
{
  "v": 1,
  "type": "input",
  "seq": 1024,
  "ts": 123456789,
  "payload": {
    "inputType": "joystick",
    "x": 0.0,
    "y": 1.0,
    "magnitude": 1.0
  }
}
```

Routing (identical for both transports):

```text
input
  ↓
Protocol layer → InputEvent(source=BLE | ESP_NOW)
  ↓
ControllerManager (ownership / priority)
  ↓
GameEngine.handleInput()   ← InvertedDrive
  ↓
Direction Invert mapping
  ↓
Robot safety checks
  ↓
Robot movement (RobotController / MotorController)
```

Rules:

- While the game is active, generic movement input must **not** be interpreted as ordinary RC (§11).
- The mobile/web app sends player intent only. It must not send PWM values or motor-specific commands (§9.1).
- `InvertedDrive` is transport-agnostic; it consumes the normalized event.
- Input ownership is decided only by `ControllerManager`. While BLE is connected, ESP-NOW game input is ignored there (§7).
- `dir: "none"`, stale input, controller disconnect, and ownership change all result in a safe stop (§10, §30).

### 5.4 Objective Result

There is no separate `task_result` message in Protocol v1. Direction Invert must not introduce `task_result`, nor reuse `game_feedback` (§14, which is Color Quest's answer-feedback message).

Objective-level feedback uses the existing `game_state` message (§19), the same message Driving Pro uses for per-task state. `task` carries the objective number:

| `task` | Objective |
| ------ | --------- |
| 1 | Safe driving without collision for the required time |
| 2 | Required total turns |
| 3 | Required left and right turns |

Robot → Mobile, objective passed:

```json
{
  "v": 1,
  "type": "game_state",
  "ts": 123456789,
  "payload": {
    "game": "inverted_drive",
    "level": 1,
    "task": 2,
    "status": "passed"
  }
}
```

- `status: "passed"` — the objective is satisfied. The level keeps running.
- `status: "failed"` — the objective can no longer be satisfied (collision, or timer expiry before the requirement was met).
- A `game_state` **with** `task` is an objective event. A `game_state` **without** `task` is a level event (§5.5).

The robot's `GameEngine` evaluates safe driving, total turns, and left/right turns. The mobile/web application must not independently calculate whether an objective has passed.

### 5.5 Level Failed / Completed (no `game_over`)

There is no separate `game_over` message in Protocol v1. Direction Invert must not introduce a custom `game_over` message.

Level-level outcomes use the existing `game_state` contract without `task`:

```json
{
  "v": 1,
  "type": "game_state",
  "ts": 123456789,
  "payload": {
    "game": "inverted_drive",
    "level": 1,
    "status": "failed"
  }
}
```

Allowed `status` values (§19):

```text
ready
running
passed
failed
completed
aborted
```

- `completed` — all three objectives passed.
- `failed` — the level ended with at least one objective not passed.
- `aborted` — see §5.7.

Collision detection is part of gameplay evaluation (an objective that collision makes unachievable is reported as `failed`) and must not introduce a custom protocol event. Motors are stopped before the level-level `game_state` is sent.

### 5.6 Game Result

The robot generates the authoritative final result using the existing `game_result` message (§20).

Robot → Mobile, all objectives passed:

```json
{
  "v": 1,
  "type": "game_result",
  "id": "result-001",
  "payload": {
    "game": "inverted_drive",
    "level": 1,
    "score": 3,
    "stars": 3,
    "status": "completed",
    "tasks": {
      "completed": 3,
      "passed": 3,
      "failed": 0
    }
  }
}
```

Robot → Mobile, level ended before all objectives were passed:

```json
{
  "v": 1,
  "type": "game_result",
  "id": "result-002",
  "payload": {
    "game": "inverted_drive",
    "level": 1,
    "score": 2,
    "stars": 2,
    "status": "failed",
    "tasks": {
      "completed": 3,
      "passed": 2,
      "failed": 1
    }
  }
}
```

Field meaning for Direction Invert:

- `stars` = number of objectives passed (0–3).
- `tasks.passed` / `tasks.failed` = objectives passed / not passed at level end; `tasks.completed` = `passed + failed` (3 at level end).
- `status` = `completed` when all three passed, `failed` otherwise.
- The exact `score` calculation belongs to the Direction Invert game implementation. The communication layer only transports the authoritative result.

The mobile/web application stores persistent progression after receiving the robot-generated result.

### 5.7 Game Abort

Mobile → ESP32:

```json
{
  "v": 1,
  "type": "command",
  "command": "game_abort",
  "id": "abort-001",
  "payload": {}
}
```

ESP32 → Mobile:

```json
{
  "v": 1,
  "type": "ack",
  "id": "abort-001",
  "payload": {
    "accepted": true
  }
}
```

followed by a level event:

```json
{
  "v": 1,
  "type": "game_state",
  "ts": 123456789,
  "payload": {
    "game": "inverted_drive",
    "level": 1,
    "status": "aborted"
  }
}
```

When `game_abort` is received, the ESP32 must safely stop active game movement and return to the appropriate non-game state (§16). No Direction Invert-specific abort message may be introduced.

The robot also aborts the level itself, with motors stopped, when the active controller is lost or ownership changes (§7, §34). An aborted level produces no `game_result`.

### 5.8 Errors

Protocol errors use the standard `error` message (§27), copying the request `id`:

```json
{
  "v": 1,
  "type": "error",
  "id": "game-001",
  "payload": {
    "code": "LEVEL_NOT_FOUND",
    "message": "Level not available for inverted_drive"
  }
}
```

| Situation | Code |
| --------- | ---- |
| `inverted_drive` requested before the game is implemented | `GAME_NOT_IMPLEMENTED` |
| `level` outside 1–6 for `inverted_drive` | `LEVEL_NOT_FOUND` |
| `gameId` or `level` missing | `MISSING_FIELD` |
| `level` not an integer | `INVALID_FIELD` |
| `game_start` while a game is already active | `NOT_ALLOWED_IN_STATE` (§28) |
| `game_abort` with no active game | `GAME_NOT_ACTIVE` |

`message` is diagnostic only; applications use `code`.

### 5.9 Remote-only Results

A level played on the remote with BLE absent is stored by the robot and delivered after BLE connects using `results_sync` (§21), with `game: "inverted_drive"`, `level`, `score`, `stars`, `timestamp`. The mobile app replies with `results_sync_ack`. Delivery is idempotent; repeated delivery must not create duplicate progression records. Result data is never sent over ESP-NOW (§2.2).

### 5.10 Level Definition (`level_definition`)

The initial implementation uses firmware built-in level values (§2). Contract §22 task types map to the three objectives (`no_collision`, `minimum_turns`, `directional_turns`), but `level_definition` has no field for the shared level timer or for the direction mapping, and the mapping is firmware-owned. A `level_definition` for `inverted_drive` is therefore rejected with an `error` (`CONTENT_INVALID`) until its timer encoding is decided. The built-in level is never replaced by invalid content.

### Protocol Rules for Direction Invert

- Use Protocol version `1`.
- Use canonical game ID `inverted_drive`.
- Use the existing `game_start` command (GO = `game_start`).
- Use the existing `input` message for joystick input.
- Use the existing `game_state` message for objective and level state.
- Use the existing `game_result` message for authoritative results.
- Use the existing `game_abort` command and `ack` for aborting.
- Use existing `error` codes only.
- Do not create `start_task`, `task_start`, `task_result`, or `game_over`.
- Do not rename defined protocol fields or add fields to existing payloads (for example mapping, objective counters, or timer values).
- Do not use legacy messages (§38).
- Do not hard-code the level range in the protocol layer; `GameManager` validates per-game levels.
- Do not send motor/PWM commands from the mobile application.
- Keep real-time game judgement inside the ESP32 `GameEngine`.
- Keep BLE/ESP-NOW transport layers free of game logic.
- Keep controller ownership in `ControllerManager`.
- Keep sensor interpretation in `SensorManager`.
- Keep motor behavior in `MotorController`.

This keeps Direction Invert compatible with the new architecture without changing the message set of the communication contract or any existing game.

---

## 6. Telemetry

Telemetry is optional (§23). The mobile app enables it with `telemetry_config` (`enabled`, `intervalMs`); the firmware may clamp the interval. It is never required for the game to run, and Direction Invert generates no sensor stream unless telemetry is enabled (§24 rule 4).

While enabled during Direction Invert, the standard `telemetry` message (§24) is used with:

- `state: "GAME"`, `game: "inverted_drive"`, `level`.
- `task`: the lowest-numbered objective not yet resolved (omitted once all three are resolved).
- Obstacle state in the contract's four channels, `frontLeft`, `frontRight`, `rearLeft`, `rearRight` (§25), taken unchanged from `SensorManager`. The communication layer does not compute obstacle status from other sensors, and sensor thresholds stay in the sensor layer.
- Distances in millimeters (§37).

Telemetry represents the robot's current state, must not control the robot, and must not independently determine task success (§24 rules 5–6).

---

## 7. ESP-NOW Compatibility

When Direction Invert is played using the physical remote:

- The same level rules apply.
- The remote joystick supplies input as ESP-NOW `input` packets with `seq` (§29). Duplicate/stale packets are rejected by the ESP-NOW layer (§33).
- The active Direction Invert mapping is applied by the robot, never by the remote.
- A lost or stale remote must not leave motors running from the last joystick value (§30). The robot stops safely.
- The robot is responsible for task timing, direction mapping, collision detection, turn counting, and result generation.
- The robot sends `robot_status` with `state: "GAME"`, `controller: "esp_now"`, `game: "inverted_drive"` (§32).
- OLED provides task instructions and gameplay feedback. LEDs/Buzzer may provide additional feedback.
- The game may request remote haptic feedback using only the contract patterns (§31): objective passed → `success`, collision → `collision`, level failed → `failure`, level completed → `level_complete`, Level 6 mapping-change warning → `warning`. The remote only executes the pattern; it contains no game logic.
- If BLE connects while the remote is playing, ownership moves to BLE (§7, §35). The robot stops movement and aborts the local level; remote input is ignored.
- If BLE is disconnected, the result is retained and delivered later through `results_sync` (§5.9).

---

## 8. Task State Flow

Internal robot-side flow:

```text
LEVEL_SELECTED
      ↓
TASK_INSTRUCTIONS
      ↓
GO
      ↓
LEVEL_RUNNING
      ├── Safe Driving Objective
      ├── Total Turns Objective
      └── Left / Right Turns Objective
              │
              ↓
      OBJECTIVE_COMPLETED
              ↓
      OBJECTIVE_FEEDBACK
              ↓
         LEVEL_RUNNING
              │
              ├── Level Timer Ends
              │       ↓
              │   LEVEL_EVALUATION
              │       ├── All 3 Objectives Complete
              │       │        ↓
              │       │   LEVEL_COMPLETE
              │       │
              │       └── Objectives Incomplete
              │                ↓
              │           LEVEL_FAILED
              │
              └── All 3 Objectives Complete
                      ↓
                LEVEL_COMPLETE
                      ↓
                  GAME_RESULT
```

`LEVEL_SELECTED` and `TASK_INSTRUCTIONS` exist on the robot only for local OLED play. For mobile play they are app UI states, and `game_start` enters `LEVEL_RUNNING` directly.

Internal state to wire message:

| Internal state | Wire message |
| -------------- | ------------ |
| `LEVEL_RUNNING` entered | `response` / `game_started` (`status: "running"`) |
| `OBJECTIVE_COMPLETED` / `OBJECTIVE_FEEDBACK` | `game_state` with `task`, `status: "passed"` |
| Objective unachievable | `game_state` with `task`, `status: "failed"` |
| `LEVEL_COMPLETE` | `game_state` `completed` (no `task`) |
| `LEVEL_FAILED` | `game_state` `failed` (no `task`) |
| `GAME_RESULT` | `game_result` |
| Abort / controller loss | `game_state` `aborted` |

---

## 9. Implementation Requirements

- Implement Direction Invert Levels 1–6 as a new `InvertedDrive` game (`games/InvertedDrive.h/.cpp`) implementing the existing `GameEngine` interface unchanged.
- L1–L2: Forward/Backward Invert. L3–L4: Steering Invert. L5: Full Invert. L6: Dynamic Invert.
- Do not modify `ColorQuest`, `DrivingPro`, `EchoMemory`, `ReflexDash`, the `GameEngine` interface, `ControllerManager`, `MotorController`, `SensorManager`, or the contract message set. Integration is limited to registering `inverted_drive` in `GameManager`/`GameConfig.h`, and adjusting protocol-layer level validation only if it hard-codes levels 1–3.
- Use the existing Protocol v1 JSON structure used by the other games.
- Keep authoritative game logic inside the robot-side `GameEngine`.
- Mobile sends commands and normalized inputs; it does not calculate authoritative results.
- Do not send motor/PWM commands from the mobile application.
- The level timer must be non-blocking (timestamps/state transitions; no `delay()`).
- Direction mapping must be applied before the existing safety checks.
- All three objectives must be tracked simultaneously during the level.
- Turn counting must be performed by the robot, on the mapped steering direction.
- Objective 1: Track safe driving without collision for the required duration.
- Objective 2: Track the required total number of turns.
- Objective 3: Track left and right turns independently.
- Completing one objective must not stop the level.
- Successful objectives accumulate score/stars.
- Objective completion feedback must be sent/displayed while the player continues driving.
- The level completes when all three objectives are successfully completed.
- If the level timer expires before all three objectives are completed, the level ends and the current result is generated.
- The robot generates the authoritative final result.
- Stop motors on: `none` input, level end, `game_abort`, controller loss, ownership change, and stale remote input.
- Preserve the existing BLE/ESP-NOW ownership and safety architecture.
- Preserve the existing sensor and collision-detection layer.
- Do not modify the underlying safety behavior when applying Direction Invert mappings.
- Build with PlatformIO and verify that existing games still behave identically.

---

## 10. Open Items

Contract notes (the contract itself was not edited):

1. **Level enum.** Appendix A lists game levels `1, 2, 3`; Direction Invert uses 1–6. Treat the list as "currently defined" (consistent with §13), or extend Appendix A for `inverted_drive`. Confirm the Phase 5 validator does not hard-code 1–3.
2. **`dir` vocabulary.** Joystick examples use `up`; Appendix A uses `forward/backward/...`. Confirm what the implemented `BleProtocol` accepts.
3. **Two `game_result` shapes.** §15 (`response`/flat fields, Color Quest) and §20 (`game_result`/`payload`, Driving Pro). This plan uses §20 because it carries `status` and `tasks`. Confirm against the firmware serializer.
4. **Typos.** §16 shows `"type": "command "` (trailing space) and §8 says the game engine "must care" which transport an input came from; the architecture's Phase 8 and §46 say the opposite. Neither is propagated here. The architecture document also still mentions `game_input`/`game_event`, which the contract replaced with `input`/`game_state`.

Design decisions to confirm:

1. `game_result.status` is `completed`/`failed` here; Driving Pro's example uses `completed` for a finished session that contained a failed task.
2. An aborted level produces no `game_result`.
3. Telemetry `task` reports the lowest unresolved objective.
4. Turns are counted on the mapped (actual) robot direction.
5. A collision fails every unresolved objective and therefore ends the level (Task Rules 1–3 imply this).
6. Exact durations, turn counts, and Level 6 mapping-change times (§2).
7. Level 6 mapping-change warning on the mobile app has no contract message; it is robot-side/haptic only unless the contract is extended.
