/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { render } from "preact";
import { initLanguage } from "./i18n";
import { installKeyRouter } from "./nav/keys";
import { initPlatform, platform } from "./platform";
import { App } from "./ui/App";
import "./styles.css";

/**
 * The whole UI is laid out on a fixed 1920×1080 stage, the coordinate space both TV platforms
 * use, and scaled to whatever the window really is (a 1280-wide webOS panel, a desktop browser).
 */
function fitStage(stage: HTMLElement): void {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.transform = scale === 1 ? "" : `scale(${scale})`;
}

function start(): void {
  document.documentElement.className = "platform-" + platform;
  initPlatform();
  initLanguage();
  installKeyRouter();
  const stage = document.getElementById("stage")!;
  fitStage(stage);
  window.addEventListener("resize", () => fitStage(stage));
  render(<App />, document.getElementById("ui")!);
}

start();
