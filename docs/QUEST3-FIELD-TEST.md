# Φ XR Commons | Rung 2 Quest 3 Field Test

This is a **physical headset acceptance plan**, not evidence that physical hardware testing has happened.

## 0. Preparation

- Both Quest 3 units are updated and can open a public HTTPS site in Meta Quest Browser.
- The website is published on GitHub Pages (or another HTTPS host).
- A self-hosted signaling server is available at a public **wss://** address. GitHub Pages only serves static files.
- For restrictive home/mobile networks, configure a separately hosted TURN server, preferably TLS with short-lived credentials.
- Never paste real TURN passwords into issue reports, screenshots, or console logs. The Rung 2 form keeps them in tab memory only.
- Create an eight-character room code on headset A and copy/share it with B, preferably through a private channel.

## 1. Join and rejoin

1. Open the exact same site on both Quest browsers. Both may inspect the offline gallery before connecting.
2. Enter the signaling WSS endpoint and same room code on both; use separate explorer names.
3. Join A, then join B. Expect 2/2 occupancy, distinct seats, and remote avatars.
4. Try a third browser tab joining the room. It must receive a "room full" error.
5. Leave from A while B remains. Verify B keeps the room and becomes seat 1. Join A again; B must be able to initiate a **new** peer connection.
6. Repeat with B leaving first and returning.

## 2. Video lifecycle

1. Join both clients **without** sharing media, and wait for WebRTC connected.
2. On A, choose Share View. Expect B's panel to switch from waiting to video, assuming Quest Browser supports canvas capture.
3. Stop sharing and ensure B's screen stops displaying video.
4. Start sharing again without rejoining. This checks the late-track mute/unmute fix.
5. Try Share Window / Tab only on a browser that exposes getDisplayMedia. Browser support may be absent on Quest.
6. Repeat in reverse from B.
7. Verify none of these actions attempts headset-wide capture. Native Meta Quest capture is a separate rung requiring explicit permission.

## 3. Voice

1. Enable the microphone separately on each headset and grant permission.
2. Confirm each user hears only their peer, not a loop of their own audio.
3. Mute, unmute, and leave the room. Confirm the microphone stops after leaving.
4. If playback is blocked by autoplay policy, tap the page to unlock media and note the headset/browser version.

## 4. Controls and comfort

1. Enter VR after joining. Left thumbstick moves slowly relative to gaze, right thumbstick snap-turns 30 degrees per distinct push.
2. Release the right thumbstick to center before attempting another turn.
3. Verify the trigger ray can select the microphone / share / stop-share objects in the lounge.
4. Headset should not flash on turning, abruptly teletransport, or drift when sticks are neutral.
5. Verify the in-world Field Link status board is readable; note clipping, size or eye strain.
6. Verify no in-world objects obscure the live screens from the default viewpoint.
7. Exit and reenter immersive VR; the browser control panel should remain usable.

## 5. Network matrix

| Client A | Client B | Expected |
| --- | --- | --- |
| Same Wi-Fi | Same Wi-Fi | Usually succeeds with direct candidates; measure |
| Home Wi-Fi | Different home Wi-Fi | May need STUN/TURN; measure |
| Home Wi-Fi | Mobile hotspot | May need TURN; measure |
| TURN configured on both | Restricted networks | Should be testable; relay availability still depends on firewall/TLS |

Record WebRTC state and ICE state on each headset. "Connected" is not guaranteed in every NAT/firewall arrangement, even with STUN.

## Bug reporting

Include: headset firmware/browser version, date, site SHA, WSS server location at city/country granularity, whether TURN was configured (without credentials), both WebRTC/ICE states, user-action sequence, and headset screenshots captured with consent. Avoid storing voice/video or sensitive metadata.

## Rung 2 exit criteria

- Desktop npm test and npm run build pass.
- Two physical Quest 3 headsets can join, leave, rejoin, and render the space without severe discomfort.
- Audio and opt-in video are verified under at least one supported browser/network combination.
- Connection failures show actionable diagnostics rather than silently hanging.
- Remaining browser-capture limitations are clearly separated from native headset-wide capture.

**No claim of physical-headset acceptance without completing these steps.**
