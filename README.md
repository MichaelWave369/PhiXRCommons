# Φ XR Commons

Two headsets. One shared virtual hangout. Open source under MIT.

Rung 2 builds on the original WebXR lounge with improved headset comfort, two-person seat recovery, configurable ICE servers and more dependable late-started peer video. The browser share-view feature captures only the app canvas, if supported. It does not capture the whole Quest display. A consent-based native Quest capture bridge is future work.

### Rung 2 upgrades

- Left Touch controller stick: slow gaze-relative locomotion. Right stick: 30-degree snap turn, once per push.
- A live Field Link status screen within the 3D lounge and WebRTC/ICE diagnostics in the HTML controls.
- Room-code copy, survivor promotion when the first explorer disconnects, and correct re-pairing with a replacement explorer.
- Opt-in video that responds to remote track mute/unmute, including starting a screen broadcast after the WebRTC connection has already been negotiated.
- Advanced Connection field for optional private STUN and TURN relay, with TURN credentials kept in browser memory only.
- Automated tests for seat rejoin, receiver activation, ICE configuration and controller utilities.

For real hardware acceptance, use [Quest 3 field test](docs/QUEST3-FIELD-TEST.md). For deployment, use [Sovereign hosting](docs/SELF-HOST.md).

## Development

Requires Node 20+. Install with npm install. In one terminal run npm run server; in another run npm run dev. Open two tabs at the Vite URL with the same eight-character room code. On Quest, serve the frontend over HTTPS and use a reachable wss:// signaling endpoint. Localhost on a headset is the headset itself.

GitHub Pages deploys the static frontend only. Run the WebSocket signaling backend separately (npm run server), with TLS reverse-proxy for public use, and enter its URL in the website. The signaling server has a /health endpoint.

Audio and video use WebRTC. An optional self-hosted TURN relay can now be entered in the Advanced Connection panel; you must deploy the actual TURN service separately. Default Google STUN remains an external dependency unless replaced. Room codes grant entry to any available seat and are not strong user authentication. Do not share confidential material.

Enable GitHub Actions as the Pages source under repository Settings > Pages to publish the site after merging. The site works as an offline *gallery demo* without the signaling server, but actual multiplayer requires a signaling server.

Next: physical two-Quest hardware QA, authenticated room admission, TURN production hardening, spatial sound, native consent-based Quest screen capture, Gen.E.Wrist and Silicon Louvre integration.

People Above Profit. Ledger Above Ego. Φ369 Labs.
