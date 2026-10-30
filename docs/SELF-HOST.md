# Sovereign hosting notes

This repository has two different services:

1. **Frontend**: pure static Vite/WebXR assets hosted over HTTPS, including GitHub Pages.
2. **Signaling**: a small Node WebSocket server that exchanges room and SDP/ICE messages. GitHub Pages cannot host it. Room media uses encrypted WebRTC; the signaling server does not receive the audio/video payloads.

## Example signaling setup

On a Linux host with Node 20+, run:

    npm install --omit=dev
    HOST=127.0.0.1 PORT=8787 npm run server

Health endpoint: http://127.0.0.1:8787/health

Use a reverse proxy such as Caddy with a real DNS name and working certificate:

    commons-signal.example.org {
        reverse_proxy 127.0.0.1:8787
    }

Caddy automatically handles the WebSocket upgrade and TLS when DNS and port access are configured. On the public frontend, enter wss://commons-signal.example.org as the signaling URL. Avoid exposing an unencrypted ws:// server on the public internet.

## TURN for difficult networks

The Advanced Connection panel accepts one TURN relay URL, username and credential, for example:

    turns:relay.example.org:5349?transport=tcp

You must provision that server separately (for example coturn). **There is no built-in free TURN service.** Use temporary credentials, firewalls, bandwidth accounting and rate limits. The UI stores credentials only in memory for this tab, never in the GitHub repository or the signaling packets.

The default STUN is Google's public stun:stun.l.google.com:19302. This is an external dependency. You can replace the STUN address with your own server or disable STUN when TURN is present. Browsers will still perform ICE and may reveal network metadata to the chosen ICE infrastructure.

## Security boundary

- Eight-character room codes are private links, not authenticated user identities. Anyone who learns a room code and connects before the second explorer can occupy a seat.
- Public deployments should add real user admission and moderation before confidential use.
- The signaling service rejects extra seats and overly large messages but is not a security perimeter. Restrict publicly accessible traffic.
- Never log SDP or ICE exchanges indiscriminately; they may contain private IP/network information.
- Video capture is opt-in. There is no background recording or headset-wide capture.
- The Quest browser may reject screen/window capture even when other browsers permit it.

## Operational checks

- Verify HTTPS for website and WSS for signaling.
- Watch health and service logs for non-sensitive errors.
- Verify both browsers can establish ICE (connected/completed) and WebRTC (connected).
- If WebRTC says failed, check TURN URL, credentials, firewall and TLS and rejoin.
- Do not declare Quest hardware compatibility until physical headset testing passes docs/QUEST3-FIELD-TEST.md.
