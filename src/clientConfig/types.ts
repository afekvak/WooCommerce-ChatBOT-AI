export type UiTheme = "dark" | "light";

export interface ClientPrefs {
  allowRealName: boolean;
}

export interface ClientSettings {
  confirmations: Record<string, boolean>; // empty for now, future flags go here
}

export interface UiSettings {
  theme: UiTheme;
  scale: number;
  defaultWide: boolean;
}

export interface ClientConfig {
  clientKey: string;
  prefs: ClientPrefs;
  settings: ClientSettings;
  ui: UiSettings;
}
