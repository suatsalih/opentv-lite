/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import qrcode from "qrcode-generator";
import { useMemo } from "preact/hooks";

/** A QR code drawn as one SVG path, generated on the TV — no image is fetched. */
export function Qr({ text, size }: { text: string; size: number }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
    return { path: d, count: n };
  }, [text]);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`-2 -2 ${count + 4} ${count + 4}`}
      shape-rendering="crispEdges"
      style={{ background: "#fff", borderRadius: "16px" }}
    >
      <path d={path} fill="#000" />
    </svg>
  );
}
