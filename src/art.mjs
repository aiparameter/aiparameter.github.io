// Original generative editorial illustrations. Deterministic from (motif, seed).
const W = 1200, H = 675;
const INK = "#12161b", BLUE = "#0052ff", CYAN = "#00b8e6", PALE = "#d3e0f4", BG = "#eef2f8";

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;

const motifs = {
  layers(r) {
    let out = "";
    const widths = [560, 600, 640, 600, 560];
    for (let i = 0; i < 5; i++) {
      const cx = 600 + (r() - 0.5) * 40, cy = 175 + i * 82, w = widths[i], h = 78;
      const pts = `${f(cx - w / 2)},${cy} ${cx},${cy - h} ${f(cx + w / 2)},${cy} ${cx},${cy + h}`;
      const fill = i === 2 ? BLUE : i === 4 ? "none" : "#ffffff";
      const stroke = i === 4 ? CYAN : INK;
      out += `<polygon points="${pts}" fill="${fill}" fill-opacity="${i === 2 ? 0.92 : 0.78}" stroke="${stroke}" stroke-width="${i === 4 ? 3 : 1.5}"/>`;
    }
    return out;
  },
  grid(r) {
    let out = "";
    const cols = 25, rows = 13, sx = 44, ox = 50, oy = 62;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
      out += `<circle cx="${ox + x * sx}" cy="${oy + y * sx}" r="2.4" fill="${INK}" fill-opacity="0.35"/>`;
    let x = 3 + Math.floor(r() * 4), y = 2 + Math.floor(r() * 8);
    const pts = [[x, y]];
    while (x < cols - 4) {
      const d = r();
      if (d < 0.5) x += 1 + Math.floor(r() * 3); else if (d < 0.75 && y > 1) y -= 1 + Math.floor(r() * 2); else if (y < rows - 2) y += 1 + Math.floor(r() * 2); else x += 1;
      pts.push([x, y]);
    }
    const path = pts.map(([a, b]) => `${ox + a * sx},${oy + b * sx}`).join(" ");
    out += `<polyline points="${path}" fill="none" stroke="${CYAN}" stroke-width="4" stroke-linejoin="round"/>`;
    pts.forEach(([a, b], i) => { out += `<circle cx="${ox + a * sx}" cy="${oy + b * sx}" r="${i % 3 === 0 ? 9 : 5}" fill="${i % 3 === 0 ? BLUE : "#fff"}" stroke="${INK}" stroke-width="1.5"/>`; });
    return out;
  },
  paths(r) {
    let out = "";
    const tx = 1010, ty = 337;
    for (let i = 0; i < 15; i++) {
      const y0 = 70 + i * 38, c1 = 380 + r() * 160, c2 = 640 + r() * 160;
      const hi = i === 7;
      out += `<path d="M90,${y0} C${f(c1)},${y0} ${f(c2)},${ty} ${tx},${ty}" fill="none" stroke="${hi ? BLUE : INK}" stroke-opacity="${hi ? 1 : 0.4}" stroke-width="${hi ? 5 : 1.5}"/>`;
      out += `<circle cx="90" cy="${y0}" r="4" fill="${hi ? BLUE : INK}" fill-opacity="${hi ? 1 : 0.55}"/>`;
    }
    out += `<circle cx="${tx}" cy="${ty}" r="16" fill="${CYAN}" stroke="${INK}" stroke-width="2"/>`;
    return out;
  },
  stack(r) {
    let out = "";
    for (let i = 0; i < 5; i++) {
      const y = 100 + i * 100, w = 360 + r() * 560;
      out += `<rect x="120" y="${y}" width="${f(w)}" height="46" fill="${i === 1 ? BLUE : "#fff"}" stroke="${INK}" stroke-width="1.5"/>`;
      out += `<rect x="120" y="${y}" width="${f(w * (0.35 + r() * 0.4))}" height="46" fill="${i === 1 ? "#fff" : PALE}" fill-opacity="${i === 1 ? 0.25 : 1}"/>`;
      out += `<circle cx="${f(120 + w + 28)}" cy="${y + 23}" r="9" fill="${i === 3 ? CYAN : INK}"/>`;
    }
    return out;
  },
  scale(r) {
    let out = "";
    const tilt = (r() - 0.5) * 70, cx = 600, cy = 230;
    const x1 = cx - 380, y1 = cy - tilt / 2, x2 = cx + 380, y2 = cy + tilt / 2;
    out += `<polygon points="${cx},${cy} ${cx - 44},560 ${cx + 44},560" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`;
    out += `<line x1="${x1}" y1="${f(y1)}" x2="${x2}" y2="${f(y2)}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="14" fill="${BLUE}" stroke="${INK}" stroke-width="2"/>`;
    [[x1, y1, 0], [x1 + 140, y1 + (140 / 760) * (y2 - y1), 1], [x2 - 140, y2 - (140 / 760) * (y2 - y1), 2], [x2, y2, 3]].forEach(([x, y], i) => {
      const len = 90 + r() * 130, rad = 24 + r() * 30;
      out += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(y + len)}" stroke="${INK}" stroke-width="1.5"/>`;
      out += `<circle cx="${f(x)}" cy="${f(y + len + rad)}" r="${f(rad)}" fill="${i === 2 ? CYAN : "#fff"}" stroke="${INK}" stroke-width="1.5"/>`;
    });
    return out;
  },
  funnel(r) {
    let out = "";
    for (let i = 0; i < 26; i++) {
      const x0 = 90 + i * 42 + (r() - 0.5) * 20, hi = i === 13;
      out += `<line x1="${f(x0)}" y1="50" x2="${f(570 + (i - 13) * 4)}" y2="560" stroke="${hi ? BLUE : INK}" stroke-opacity="${hi ? 1 : 0.4}" stroke-width="${hi ? 4 : 1.2}"/>`;
    }
    [130, 250, 370, 470].forEach((y, i) => {
      const hw = 480 - i * 105;
      out += `<ellipse cx="600" cy="${y}" rx="${hw}" ry="${16 + i * 2}" fill="none" stroke="${i === 2 ? CYAN : INK}" stroke-width="${i === 2 ? 3 : 1}" stroke-opacity="${i === 2 ? 1 : 0.5}"/>`;
    });
    out += `<circle cx="600" cy="590" r="18" fill="${CYAN}" stroke="${INK}" stroke-width="2"/>`;
    return out;
  },
  waves(r) {
    let out = "";
    for (let i = 0; i < 7; i++) {
      const amp = 40 + r() * 90, ph = r() * 6.28, fr = 0.006 + r() * 0.01, base = 130 + i * 70;
      let d = "";
      for (let x = 0; x <= 1200; x += 12) d += `${x === 0 ? "M" : "L"}${x},${f(base + Math.sin(x * fr + ph) * amp)} `;
      const col = i === 3 ? BLUE : i === 5 ? CYAN : INK;
      out += `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${i === 3 || i === 5 ? 1 : 0.35}" stroke-width="${i === 3 ? 4 : i === 5 ? 3 : 1.5}"/>`;
    }
    return out;
  },
  shield(r) {
    let out = "";
    for (let i = 0; i < 7; i++) {
      const w = 760 - i * 100, h = 520 - i * 70;
      out += `<rect x="${f(600 - w / 2)}" y="${f(337 - h / 2)}" width="${w}" height="${h}" rx="${40 + i * 6}" fill="${i === 6 ? BLUE : "none"}" stroke="${i === 3 ? CYAN : INK}" stroke-width="${i === 3 ? 4 : 1.4}" stroke-opacity="${i === 3 ? 1 : 0.6}" ${i % 2 === 1 ? `stroke-dasharray="${8 + Math.floor(r() * 18)} 10"` : ""}/>`;
    }
    out += `<circle cx="600" cy="337" r="10" fill="#fff"/>`;
    return out;
  },
  steps(r) {
    let out = "";
    const pts = [];
    for (let i = 0; i < 7; i++) {
      const x = 110 + i * 150, h = 80 + i * 62 + r() * 14, y = 600 - h;
      out += `<rect x="${x}" y="${f(y)}" width="140" height="${f(h)}" fill="${i === 5 ? BLUE : "#fff"}" fill-opacity="${i === 5 ? 0.92 : 0.8}" stroke="${INK}" stroke-width="1.5"/>`;
      pts.push(`${x + 70},${f(y - 22)}`);
    }
    out += `<polyline points="${pts.join(" ")}" fill="none" stroke="${CYAN}" stroke-width="4" stroke-linejoin="round"/>`;
    pts.forEach((p, i) => { const [x, y] = p.split(","); out += `<circle cx="${x}" cy="${y}" r="${i === 6 ? 12 : 6}" fill="${i === 6 ? CYAN : "#fff"}" stroke="${INK}" stroke-width="1.5"/>`; });
    return out;
  },
  horizon(r) {
    let out = `<line x1="0" y1="470" x2="1200" y2="470" stroke="${INK}" stroke-width="2"/>`;
    for (let i = 0; i < 11; i++) {
      const rad = 70 + i * 36 + r() * 6, hi = i === 5, cy = i === 8;
      out += `<path d="M${f(600 - rad)},470 A${f(rad)},${f(rad)} 0 0 1 ${f(600 + rad)},470" fill="none" stroke="${hi ? BLUE : cy ? CYAN : INK}" stroke-opacity="${hi || cy ? 1 : 0.4}" stroke-width="${hi ? 5 : cy ? 3 : 1.4}"/>`;
    }
    out += `<circle cx="600" cy="470" r="14" fill="${BLUE}" stroke="${INK}" stroke-width="2"/>`;
    for (let i = 0; i < 9; i++) out += `<line x1="${60 + i * 140}" y1="500" x2="${60 + i * 140 + 70}" y2="500" stroke="${INK}" stroke-opacity="0.25"/>`;
    return out;
  }
};

export function artSvg(motif, seed) {
  const r = rng(seed * 7919 + 13);
  let hair = "";
  for (let x = 0; x <= W; x += 60) hair += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = 0; y <= H; y += 60) hair += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${BG}"/><g stroke="${INK}" stroke-opacity="0.05" stroke-width="1">${hair}</g>${motifs[motif](r)}</svg>`;
}

export const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="4" fill="${INK}"/><g stroke="#fff" stroke-width="2" stroke-linecap="round"><line x1="6" y1="10" x2="26" y2="10"/><line x1="6" y1="16" x2="26" y2="16"/><line x1="6" y1="22" x2="26" y2="22"/></g><circle cx="20" cy="10" r="3.5" fill="${CYAN}"/><circle cx="11" cy="16" r="3.5" fill="#fff"/><circle cx="17" cy="22" r="3.5" fill="${BLUE}"/></svg>`;
