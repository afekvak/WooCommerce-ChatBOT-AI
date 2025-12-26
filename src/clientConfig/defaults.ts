import type { ClientPrefs, ClientSettings, UiSettings } from "./types.js";

export const DEFAULT_PREFS: ClientPrefs = {
  allowRealName: true
};

export const DEFAULT_SETTINGS: ClientSettings = {
  confirmations: {} // empty for now
};

export const DEFAULT_UI: UiSettings = {
  theme: "dark",
  scale: 1,
  defaultWide: false
};
