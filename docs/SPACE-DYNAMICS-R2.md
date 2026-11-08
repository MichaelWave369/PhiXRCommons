# ΦSpace Dynamics Rung 2: shared, server-authoritative rooms

## The implemented flow
The standalone \`/spacedynamics.html\` lab now optionally joins a two-explorer physics room via the existing Commons server using \`wss://your-server/space\`. Both explorers see the **same canonical server-simulated world**. Unlike WebRTC voice/video signaling, the physics snapshots travel through the separate WebSocket route; neither client can upload its own physics snapshot.

The server simulates a 90Hz fixed-step illustrative world on a 100ms dispatch loop (10 state updates per second). Clients interpolate the displayed orb positions. Frame rendering and headset motion remain entirely local.

Both participants can **push** or **add** (up to 24) objects. Only the current role-1 host can change gravity, switch the artistic force field, pause or reset. If the host disconnects, the guest becomes host without resetting the world. Every reconnect starts a fresh connection sequence. Room state exists only in server memory and disappears after the final participant leaves.

The protocol is \`phi.space.sync.v1\` with an independently generated room epoch, monotonic revisions, and per-socket monotonic command sequences. A strict validator bounds command types, vector components, presets, identifiers, and snapshot sizes. The /space server has a 20-msg/sec per-socket ingress limit; it broadcasts authoritative snapshots at 10Hz. An individual room is limited to two sockets.

## Use
Run \`npm install\`, \`npm run server\` and \`npm run dev\` locally. Open the lab from the Commons launcher in two separate browser tabs, enter the same eight-character code and \`ws://localhost:8787\` in **Space server** (local development only), and select **LINK SPACE**.

When publicly hosted, the frontend must use HTTPS and the server must be reverse-proxied under WSS; GitHub Pages alone does **not** provide the backend. The URL must preserve the \`/space\` WebSocket path. Enter the same server URL and code in both Quest browsers.

## Operational truth and safety
- **No identity authentication:** Anyone who knows the room code can occupy a free seat. No confidential or untrusted public-room use.
- No persistence, cross-server federation, networked voice/video changes, WAN physics benchmarking, encrypted end-to-end physics packets, private matchmaking, or TURN provisioning. This is **not** a security perimeter.
- No positional tracking transmitted by the Space Lab. Only physics room commands and snapshots. The existing Commons lounge remains on the original WebSocket path.
- The model is an illustrative educational simulation, **not** an engineering-grade solver or proof of Jeffery's OMEGA physics.
- The 20,736 logical address slots remain a 12×12×12 3D grid × 12 metadata layers, **not** 20,736 physical dimensions.
- Headset pose, safety boundary and locomotion do not respond to world gravity or peer pushes.
- Real Quest 3 field testing, accessibility and latency/comfort measurement remain outstanding.
- No OverStrings/ΦPose binding. Rung 3 must require explicit enabling and allowlisted UI-only gesture requests.

## Future
Authentication and scoped invitations; reconnection and resumable sessions; network interpolation under packet loss; physics energy tests and more accurate collision physics; governed gesture interface; downstream app adapters.
