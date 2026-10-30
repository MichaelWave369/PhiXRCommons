// ICE settings never leave the browser through signaling; keep relay secrets out of URLs.
export const DEFAULT_STUN = 'stun:stun.l.google.com:19302';

export function makeIceServers({
  stunUrl = DEFAULT_STUN,
  turnUrl = '',
  turnUsername = '',
  turnCredential = '',
} = {}) {
  const servers = [];
  const stun = String(stunUrl).trim();
  const turn = String(turnUrl).trim();
  if (stun) {
    if (!/^stuns?:[^\s/?#@]+$/i.test(stun) || stun.length > 256)
      throw new Error('Enter a valid stun: or stuns: address, or leave STUN empty.');
    servers.push({ urls: stun });
  }
  if (turn) {
    if (!/^turns?:[^\s/?#@]+(?:\?transport=(?:tcp|udp))?$/i.test(turn) || turn.length > 256)
      throw new Error('TURN relay must start with turn: or turns: and contain no embedded credentials.');
    if (!String(turnUsername) || !String(turnCredential))
      throw new Error('TURN relay needs both username and password.');
    servers.push({
      urls: turn,
      username: String(turnUsername),
      credential: String(turnCredential),
    });
  } else if (turnUsername || turnCredential) {
    throw new Error('Enter a TURN relay URL if providing TURN credentials.');
  }
  if (!servers.length) throw new Error('Configure a STUN or TURN server to establish WebRTC.');
  return servers;
}
