/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { useEffect, useState } from "preact/hooks";
import type { Channel } from "../data/models";
import { bootstrap, useAppData } from "../state";
import { About } from "./About";
import { AddProvider } from "./AddProvider";
import { LiveTv } from "./LiveTv";
import { PlayerScreen } from "./PlayerScreen";
import { Settings } from "./Settings";

export type Screen = "live" | "settings" | "about" | "add";

export interface PlayRequest {
  channels: Channel[];
  index: number;
  /** Set for catch-up playback of a past programme. */
  catchup?: { url: string; title: string };
}

export function App() {
  const data = useAppData();
  const [screen, setScreen] = useState<Screen>(data.sources.length ? "live" : "add");
  const [play, setPlay] = useState<PlayRequest | null>(null);
  /** The channel the player was on when closed, so the guide lands on what was being watched. */
  const [returnTo, setReturnTo] = useState<{ key: string } | null>(null);

  useEffect(() => {
    bootstrap();
  }, []);

  const onboarding = data.sources.length === 0;

  return (
    <div class="app">
      {screen === "live" && (
        // Kept mounted under the player so the guide is exactly where it was on Back.
        <div class={play ? "hidden" : ""}>
          <LiveTv active={!play} onNavigate={setScreen} onPlay={setPlay} returnTo={returnTo} />
        </div>
      )}
      {screen === "settings" && <Settings onNavigate={setScreen} />}
      {screen === "about" && <About onBack={() => setScreen("settings")} />}
      {screen === "add" && (
        <AddProvider
          onboarding={onboarding}
          onDone={() => setScreen("live")}
          onCancel={() => setScreen(onboarding ? "add" : "settings")}
        />
      )}
      {play && screen === "live" && (
        <PlayerScreen
          request={play}
          onClose={(key) => {
            setPlay(null);
            setReturnTo({ key });
          }}
        />
      )}
    </div>
  );
}
