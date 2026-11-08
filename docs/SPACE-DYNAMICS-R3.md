# ΦSpace Dynamics Rung 3 · OverStrings ΦPose pilot

The local spatial lab now incorporates the **unmodified MIT-licensed** OverStrings files \`web/calibration.mjs\`, \`web/gesture.mjs\`, and \`web/phipose.mjs\` as \`src/spacedynamics/overstrings/\`. Upstream: [MichaelWave369/OverStrings](https://github.com/MichaelWave369/OverStrings), tree SHA \`20ef7a6d60fcdc5fea8c87a93ba2e38d1b06dd2f\`, inspected November 8, 2026. Preserve attribution and compare upstream changes when updating.

## Runtime
Reads 25 WebXR joints per hand via \`XRFrame.getJointPose\` when WebXR hand tracking is active, feeds the existing OverStrings \`GestureTracker\` and \`PhiPoseInterpreter\`, and routes a completed **advisory** phrase through the lab's exact local action allowlist. No global CustomEvent, postMessage transport, password, shell operation or user pose telemetry. Gesture patterns do not authenticate users.

- \`spacedynamics.select-next\`: L:open > R:pinch. Changes only the current local orb selection.
- \`spacedynamics.push\`: R:open > R:pinch. Sends one bounded push command to the existing R2 authoritative room **if joined**, otherwise applies the illustrative local simulation impulse.

An operator must first click **ENABLE 2 MIN**, then **ARM ONCE** for the selected action. Each phrase is one-shot and its arm expires after 45 seconds. Hand tracking loss, XR session end, permission expiry or explicit DISABLE revokes the attempt. No gestures reset worlds, navigate the OS, or enable microphones. The R2 backend continues independently validating every push.

## How to try
Open \`/spacedynamics.html\` in desktop or Quest Browser. Select the action, enable, and enter VR. After enablement, you can activate a new one-shot arm by pointing a controller trigger at the visible in-world **ARM ΦPOSE** panel. For hand-only setups, arm from the browser interface before entering VR. Complete the two-step phrase with your tracked hands. To test the logic without tracking, tick the separately labeled **synthetic button demo** before enabling, then press the L:open/R:open/R:pinch buttons. Synthetic results are *not* evidence of functional Quest hand tracking.

## Truth and limitations
- No evidence of real Quest 3 accuracy yet: physical headset testing, calibration and accessibility acceptance are **pending**.
- In-world re-arming currently requires a controller. A safe, intentional hand-only alternative is future work.
- The UI is not a privileged security boundary against malicious same-origin scripts; no OS or file authority exists here.
- Input is not persistent. Raw hand joints are not sent to the shared-world server.
- 20,736 logical addresses are a constructed indexing scheme, not a scientific or physical-dimension claim.

## Verification
\`npm test\`; \`npm run build\`. Follow up with an actual Quest 3 two-person test for false triggers, lost tracking, controller switching, accessibility, comfort, and frame rate.
