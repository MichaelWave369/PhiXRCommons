# ΦSpace Dynamics · Rung 1 (local WebXR lab)

## Purpose
An original, MIT-compatible addressable 3D scene and illustrative physics demo inside Φ XR Commons, inspired conceptually by Jeffery's layered OMEGA inspection interface **without copying its software, claiming scientific validity, or binding to the OMEGA registry**.

### What runs
- Dedicated static route: /spacedynamics.html; built by Vite as a second HTML entry.
- Mouse + orbit camera, object selection, Quest WebXR controller point-and-trigger selection and impulse.
- Fixed-step (90 Hz simulation step) gravity, floor/wall constraints, impulse response and sphere-sphere collisions. This is **an educational simulation, not an engineering-grade validated solver**.
- Optional artistic horizontal center-attraction field, Earth/Moon/zero-gravity presets, local object cap 24, pause/reset and downloadable JSON snapshot.
- 12×12×12 uniform cells across the cube [-6,+6]³; 12 independent **metadata layers**, yielding 20,736 uniquely reversible logical addresses. IDs are spatial-index identifiers, **not 20,736 dimensions or validated physical states**.
- Node tests exercise all addresses, bounds, deterministic fixed-step updates, impulse bounds and floor containment.

### Operational truth
- Local state only. Nothing is transmitted; no WebRTC room synchronization of these objects.
- The existing XR Commons room and media permissions remain unchanged.
- No OverStrings/ΦPose commands are bound in R1. Future bridge must be opt-in, scoped and host-authorized. Never treat an XR pose as authentication.
- WebXR must be tested on real Quest 3 hardware. CI verifies math and bundling, not controller comfort or device tracking.
- Does not implement force validation, finite-element/CFD physics, Earth data, spatial anchors, passthrough, full hand tracking, portal topology or physiological safety certification.

### Roadmap
R2: defined serialized scene/event schema, deterministic authoritative host, sequence/replay protection, spectator-safe multiplayer sync with rate limits.
R3: manually enabled ΦPose input adapter with a small spatial action allowlist (select/pause/reset after confirmation), and Quest hand tracking calibration.
R4: optional passthrough anchoring and multi-layer scientific data ingest with provenance and explicit uncertainty bounds.
R5: plugin adapters for PhiOS-XR, CANOPY, BTM, Spark and research datasets, without sharing privileged input authority.

### Run
npm install
npm test
npm run dev
# visit /spacedynamics.html
npm run build

People Above Profit. Ledger Above Ego.
