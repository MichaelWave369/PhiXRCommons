# ΦSpace Dynamics R4 · Evidence Lens

The Space Dynamics lab adds **local, noninteractive-with-physics** research markers. It is a visualization interface, not an experimental validation system. The overlay makes research claims inspectable while leaving R1 physics, R2 room synchronization and R3 gestures untouched.

## Schema
\`phi.space.evidence.v1\`, with exactly:
- \`title\`: bounded dataset label
- \`mapping\`: \`illustrative-lab-meters-v1\`, explicitly *visual mapping*, not real laboratory geometry
- \`unit\`: the reported measurement unit (e.g., Pa, Hz, arbitrary)
- \`provenance\`: \`{kind,source,sourceUrl,method}\`
- \`points\`: 1–96 entries \`{id,label,position:{x,y,z},value,uncertainty}\`. \`uncertainty\` may be null.

Provenance kinds are \`synthetic\`, \`reported-measurement\`, \`model-output\`, and \`hypothesis\`. Every category is rendered with an explicit non-verified label. Reported measurements require an HTTPS source URL; this is **traceability, not independent corroboration**.

Coordinates are clamped by validation, not by mutating the input: X/Z in [-5.7,5.7], Y in [.25,5.7], making evidence-layer addresses fit the existing 12³ grid. The unit is dataset-wide and numeric values/uncertainty are bounded. The parser rejects oversized JSON (72 KB), unexpected keys, duplicate IDs, invalid metadata, nonfinite numbers, non-HTTPS reference URLs, and out-of-volume points.

## Try it
Run \`npm run dev\`, visit \`/spacedynamics.html\` and open the Evidence Lens panel. An **obviously labeled synthetic example** starts loaded, showing 18 invented markers. Click **LOAD SYNTHETIC DEMO** to restore it, **CLEAR** to remove it, or select a local JSON file to import. Click a marker in desktop view or point + trigger in VR to inspect its logical address, value, uncertainty, source, and method. Toggle visibility separately. Export any loaded dataset to the same schema for reuse. No network fetches, browser storage or upload occur.

## Boundary
- The incoming source URL is displayed **as text**, not fetched, followed automatically or treated as authoritative.
- Incoming plain text is shown with \`textContent\`, never interpreted as HTML.
- No evidence marker changes any physics state, shared-server room, network role, headset location, or gesture authority.
- Shared spatial physics still requires its separate WSS server; evidence is **never synchronized** to peers.
- The 20,736 slots are 12×12×12 spatial cells × 12 metadata layers, not physical dimensions, proven states or Jeffery's OMEGA implementation.
- Native passthrough anchoring, field-calibrated coordinate mapping, external source verification, error propagation and Quest headset acceptance remain future work.

## Next
Provenance-linked research adapters, uncertainty visualization with explicit units and model calibration, plus opt-in passthrough anchoring after Quest 3 hardware tests.
