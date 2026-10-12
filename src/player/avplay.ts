/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import type { PlayerState, Rect, VideoPlayer } from "./player";

/**
 * Samsung AVPlay player. AVPlay decodes in hardware and handles HLS, MPEG-TS and DASH far more
 * reliably than Tizen's `<video>`. It draws on a video plane *behind* the web page, which is why
 * every screen leaves a transparent window where the picture should show.
 *
 * `setDisplayRect` takes coordinates in a 1920×1080 space regardless of the app's resolution,
 * which matches the app's own coordinate space.
 */
declare const webapis: any;

export class AvPlayPlayer implements VideoPlayer {
  private listener: (s: PlayerState) => void = () => undefined;
  private rect: Rect = { x: 0, y: 0, w: 1920, h: 1080 };
  private generation = 0;

  constructor() {
    // AVPlay needs this element in the document to bind its video plane.
    const obj = document.createElement("object");
    obj.id = "av-player";
    obj.setAttribute("type", "application/avplayer");
    obj.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px;";
    document.getElementById("stage")!.insertBefore(obj, document.getElementById("stage")!.firstChild);
  }

  onState(listener: (s: PlayerState) => void): void {
    this.listener = listener;
  }

  private get av(): any {
    return typeof webapis !== "undefined" ? webapis.avplay : null;
  }

  play(url: string): void {
    const av = this.av;
    if (!av) {
      this.listener({ kind: "error", message: "AVPlay is not available" });
      return;
    }
    const gen = ++this.generation;
    this.closeQuietly();
    this.listener({ kind: "loading" });
    try {
      av.open(url);
      av.setListener({
        onbufferingstart: () => gen === this.generation && this.listener({ kind: "loading" }),
        onbufferingcomplete: () => gen === this.generation && this.listener({ kind: "playing" }),
        onerror: (e: unknown) =>
          gen === this.generation && this.listener({ kind: "error", message: "playback " + String(e) }),
        onstreamcompleted: () => gen === this.generation && this.listener({ kind: "idle" }),
      });
      this.applyRect();
      // Live streams need a little more buffer than the default to survive jittery providers.
      try {
        av.setBufferingParam("PLAYER_BUFFER_FOR_PLAY", "PLAYER_BUFFER_SIZE_IN_SECOND", 3);
      } catch {
        /* not supported on older firmware */
      }
      av.prepareAsync(
        () => {
          if (gen !== this.generation) return;
          try {
            av.play();
            this.listener({ kind: "playing" });
          } catch (e) {
            this.listener({ kind: "error", message: "playback " + String(e) });
          }
        },
        (e: unknown) => gen === this.generation && this.listener({ kind: "error", message: "network " + String(e) }),
      );
    } catch (e) {
      this.listener({ kind: "error", message: "playback " + String(e) });
    }
  }

  stop(): void {
    this.generation++;
    this.closeQuietly();
    this.listener({ kind: "idle" });
  }

  pause(): void {
    try {
      this.av && this.av.pause();
      this.listener({ kind: "paused" });
    } catch {
      /* ignore */
    }
  }

  resume(): void {
    try {
      this.av && this.av.play();
      this.listener({ kind: "playing" });
    } catch {
      /* ignore */
    }
  }

  setRect(r: Rect): void {
    this.rect = r;
    this.applyRect();
  }

  private applyRect(): void {
    const av = this.av;
    if (!av) return;
    try {
      const state = av.getState();
      if (state === "NONE") return;
      av.setDisplayRect(Math.round(this.rect.x), Math.round(this.rect.y), Math.round(this.rect.w), Math.round(this.rect.h));
    } catch {
      /* ignore: called before open */
    }
  }

  private closeQuietly(): void {
    const av = this.av;
    if (!av) return;
    try {
      av.stop();
    } catch {
      /* ignore */
    }
    try {
      av.close();
    } catch {
      /* ignore */
    }
  }
}
