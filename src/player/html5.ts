/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { playableUrl } from "../data/http";
import type { PlayerState, Rect, VideoPlayer } from "./player";

/**
 * `<video>`-based player for LG webOS and desktop browsers.
 *
 * webOS plays HLS and MPEG-TS natively through its media pipeline. A desktop browser does not
 * play HLS natively (except Safari), so the browser build attaches hls.js. hls.js is only ever
 * bundled into the browser build — the `__PLATFORM__` check is resolved at build time.
 */
export class Html5Player implements VideoPlayer {
  private readonly video: HTMLVideoElement;
  private hls: { destroy(): void } | null = null;
  private listener: (s: PlayerState) => void = () => undefined;

  constructor() {
    const video = document.createElement("video");
    video.id = "video-layer";
    video.autoplay = true;
    video.setAttribute("playsinline", "");
    document.getElementById("stage")!.insertBefore(video, document.getElementById("stage")!.firstChild);
    video.addEventListener("waiting", () => this.listener({ kind: "loading" }));
    video.addEventListener("playing", () => this.listener({ kind: "playing" }));
    video.addEventListener("pause", () => {
      if (video.src || this.hls) this.listener({ kind: "paused" });
    });
    video.addEventListener("error", () => {
      const err = video.error;
      if (!video.getAttribute("src") && !this.hls) return;
      this.listener({ kind: "error", message: err ? `media error ${err.code} ${err.message || ""}` : "error" });
    });
    this.video = video;
  }

  onState(listener: (s: PlayerState) => void): void {
    this.listener = listener;
  }

  play(url: string): void {
    this.reset();
    this.listener({ kind: "loading" });
    const src = playableUrl(url);
    const isHls = /\.m3u8(\?|$)/i.test(url);
    if (__PLATFORM__ === "browser" && isHls && !this.video.canPlayType("application/vnd.apple.mpegurl")) {
      this.playWithHlsJs(src);
      return;
    }
    this.video.src = src;
    this.tryPlay();
  }

  private playWithHlsJs(src: string): void {
    // The call site sits behind a build-time constant, so the TV bundles never include hls.js.
    import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) {
        this.listener({ kind: "error", message: "format not supported" });
        return;
      }
      const hls = new Hls({ lowLatencyMode: false });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        const code = data.response && data.response.code ? ` ${data.response.code}` : "";
        this.listener({ kind: "error", message: `${data.type} ${data.details}${code}` });
      });
      hls.loadSource(src);
      hls.attachMedia(this.video);
      this.hls = hls;
      this.tryPlay();
    });
  }

  private tryPlay(): void {
    const p = this.video.play();
    // Autoplay can be refused in a desktop browser until the page has had a key press.
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  }

  stop(): void {
    this.reset();
    this.listener({ kind: "idle" });
  }

  pause(): void {
    this.video.pause();
  }

  resume(): void {
    this.tryPlay();
  }

  setRect(r: Rect): void {
    const s = this.video.style;
    s.left = r.x + "px";
    s.top = r.y + "px";
    s.width = r.w + "px";
    s.height = r.h + "px";
  }

  private reset(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.video.removeAttribute("src");
    try {
      this.video.load();
    } catch {
      /* ignore */
    }
  }
}
