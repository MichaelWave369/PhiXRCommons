# ΦSpace Dynamics Rung 6: ΦSpatial Scene Interchange

## Goal and implementation status
A **file-level** cross-application visualization contract, not a live PhiOS XR/CANOPY/BTM/Spark integration. The Spatial Lab exports a passive scene package. The same lab also imports and renders any valid R6 package as translucent **read-only ghosts**, demonstrating consumer behavior without changing a simulated body.

The schema is \`phi.spatial.scene.v1\` with a strict root shape: \`{schema,truth,creator,title,coordinateFrame,nodes}\`. Its only accepted truth label is \`UNVERIFIED_VISUALIZATION_ONLY\`. Coordinate frame is explicit and fixed: right-handed, Y up, meters, illustrative-local origin. A file cannot specify a different frame or privileged capability.

Up to **120 nodes** are accepted: \`{id,kind,label,position,radius,metadata}\`.
- \`sphere\` has a location/radius and \`metadata: null\`.
- \`evidence-marker\` has a location/radius and bounded metadata: \`{kind,unit,value,uncertainty,source,sourceUrl,method}\`. Values in the reported-measurement category must contain a canonical HTTPS source URL. A source URL is text only, not an auto-opened link, remote fetch or proof.
- Coordinates must lie within the illustrative lab volume, with bounded radii/values and finite numbers. Names, IDs and sources have length/character constraints.

The R5 local workspace exporter translates the four standard sample orbs (or up to 24 edited orbs) into passive spheres, plus up to 96 optional R4 evidence markers. It **does not export velocities, gravity, active force fields, gesture grants, room codes, camera pose, user data, device permissions or executable scripts**. Source categories are unverified.

## Using the R6 interface
In \`spacedynamics.html\`, use **EXPORT PASSIVE SCENE JSON** to save the current local/displayed spatial state as a local scene file. To view an exported file, select **INSPECT IMPORTED SCENE** (maximum 96 KB) and review the staging summary. Click **SHOW READ-ONLY GHOSTS** to show translucent markers. Toggle visibility or clear without modifying the real simulation. Click a ghost on desktop or point+trigger in WebXR to inspect its source and visual attributes.

The visual group has its own meshes, materials, and selection state. It does not touch the authoritative WebSocket simulation, local world, data claims, OverStrings permission, physical Guardian boundary, or headset camera.

## For consumers
An application may implement this schema by validating via \`parseSceneText\`, mapping \`sphere\` to a rendering primitive and \`evidence-marker\` to a clearly labeled marker, with a visually isolated, non-collidable scene layer. Do not trust scene metadata as instructions, proof, device authority or authentication. Never automatically load remote URLs from a source field. Do not apply physics or assume source coordinate calibration.

A future PhiOS XR/CANOPY adapter can import the schema through a user-selected file and explicit preview; code in those repos must be implemented separately, with their own tests. This rung provides **interoperable format and a local demo consumer**, not a claim that those integrations already exist.

## Verification
\`npm test\`, \`npm run build\`. 9 schema/roundtrip security tests cover strict bounds, cross-creator input, forbidden truth strings and provenance claims. Real Quest 3 controller/presentation acceptance remains untested.
