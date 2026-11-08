# ΦSpace Dynamics Rung 5 · Portable Local Workspaces

## Purpose
Turn the local WebXR physics scene, inspection state and optional Evidence Lens dataset into **one human-portable JSON workspace**. This feature only operates on the local page; it does not use browser storage, services, GitHub APIs or background networking.

The schema is \`phi.space.workspace.v1\`. A bundle contains:
- \`truth\`: the fixed literal \`LOCAL_PORTABLE_UNVERIFIED_SIMULATION\`
- A bounded workspace title.
- Solo physics: simulation schema, elapsed seconds, gravity/field presets, paused state, next stable orb ID and up to 24 bounded bodies with radius/mass/position/velocity.
- Optional evidence dataset in \`phi.space.evidence.v1\` schema, with provenance categories still treated as **unverified source claims**.
- Local view state: selected orb, inspector layer, whether evidence markers are visible.

No passwords, networking URLs or room invitation codes are stored. Research source URLs *inside the optional evidence dataset* remain displayed as text and are never fetched automatically.

## How to use
In \`/spacedynamics.html\`, give the workspace a title and click **SAVE TO FILE**. A JSON file is downloaded using standard browser download behavior. Closing the page without saving discards the scene.

To restore, click **OPEN LOCAL WORKSPACE**, choose a file at most 128 KB, and review the title, orb count and evidence count. **CONFIRM OPEN & REPLACE SOLO SCENE** explicitly replaces the local simulation only after full validation. This confirmation disarms/revokes any armed gesture session.

During room joining or an active shared-room connection, workspace saving and loading are disabled. Imported physics **never overwrite** the R2 server's authoritative room state. Evidence continues to be local-only.

## Validation and security
The contract accepts only known properties and versioned fields; it rejects malformed/oversized payloads, nonfinite or out-of-range numbers, duplicate body IDs, unstable nextId values, unsupported physics presets, invalid selected object references, and unapproved provenance types. It reconstructs model objects from explicit numeric data; no dynamic imports, eval, executable scripts, network fetches or file-system privileges.

A workspace records a local **illustrative** physics state, not a calibrated physical result or externally verified scientific dataset. The 20,736 addresses remain logical indexes.

## Later work
A cross-app interoperable adapter contract for CANOPY/PhiOS XR and other applications, durable offline filesystem workflow with explicit user choice, and headset acceptance. No Quest 3 hardware verification is asserted in this rung.

Run: \`npm test\`; \`npm run build\`.
