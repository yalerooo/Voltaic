// Maps a browser KeyboardEvent.code to an X11 keysym for VNC (RFB) key events.
// Printable characters are sent via their Latin-1 char code by the caller; this
// table covers the non-printable / special keys.

export const KEYSYMS: Record<string, number> = {
  Backspace: 0xff08,
  Tab: 0xff09,
  Enter: 0xff0d,
  NumpadEnter: 0xff8d,
  Escape: 0xff1b,
  Delete: 0xffff,
  Insert: 0xff63,
  Home: 0xff50,
  End: 0xff57,
  PageUp: 0xff55,
  PageDown: 0xff56,
  ArrowLeft: 0xff51,
  ArrowUp: 0xff52,
  ArrowRight: 0xff53,
  ArrowDown: 0xff54,
  Space: 0x20,
  F1: 0xffbe,
  F2: 0xffbf,
  F3: 0xffc0,
  F4: 0xffc1,
  F5: 0xffc2,
  F6: 0xffc3,
  F7: 0xffc4,
  F8: 0xffc5,
  F9: 0xffc6,
  F10: 0xffc7,
  F11: 0xffc8,
  F12: 0xffc9,
  ShiftLeft: 0xffe1,
  ShiftRight: 0xffe2,
  ControlLeft: 0xffe3,
  ControlRight: 0xffe4,
  CapsLock: 0xffe5,
  AltLeft: 0xffe9,
  AltRight: 0xffea,
  MetaLeft: 0xffeb,
  MetaRight: 0xffec,
  ContextMenu: 0xff67,
};

/** Resolve a KeyboardEvent to an X11 keysym, or null if it can't be mapped. */
export function keysymFor(e: KeyboardEvent | React.KeyboardEvent): number | null {
  const special = KEYSYMS[e.code];
  if (special !== undefined) return special;
  if (e.key.length === 1) return e.key.charCodeAt(0); // printable (Latin-1)
  return null;
}
