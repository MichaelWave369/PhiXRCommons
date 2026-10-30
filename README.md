# Φ XR Commons

Two headsets. One shared virtual hangout. Open source under MIT.

Rung 1 provides a WebXR lounge, two-person room codes, remote avatar poses, optional microphone and WebRTC video panels. The browser share-view feature captures only the app canvas, if supported. It does not capture the whole Quest display. A consent-based native Quest capture bridge is future work.

## Development

Requires Node 20+. Install with npm install. In one terminal run npm run server; in another run npm run dev. Open two tabs at the Vite URL with the same eight-character room code. On Quest, serve the frontend over HTTPS and use a reachable wss:// signaling endpoint. Localhost on a headset is the headset itself.

GitHub Pages deploys the static frontend only. Run the WebSocket signaling backend separately (npm run server), with TLS reverse-proxy for public use, and enter its URL in the website. The signaling server has a /health endpoint.

Audio and video use WebRTC. STUN is supplied as a connectivity aid; remote networks with strict NAT often require a self-hosted TURN server (not yet configured). Room codes grant entry to any available seat and are not strong user authentication. Do not share confidential material.

Enable GitHub Actions as the Pages source under repository Settings > Pages to publish the site after merging. The site works as an offline *gallery demo* without the signaling server, but actual multiplayer requires a signaling server.

Next: Quest hardware QA, TURN support, proper spatial sound, native consent-based Quest screen capture, Gen.E.Wrist and Silicon Louvre integration.

People Above Profit. Ledger Above Ego. Φ369 Labs.
