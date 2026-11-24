// Shared renderer (browser canvas or @napi-rs/canvas). drawFrame(ctx, W, H, state, prevState, t, ov)
// t in [0,1] = interpolation between prevState and state; ov = overlay info {title, subtitle, banner, footer, layout}
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.NSRender = f(); })(this, function () {
  const LCD_BG = '#0d1f10', LCD_OFF = '#14301a', LCD_ON = '#7dff7a', INK = '#b9ffb0', FONT = '"DejaVu Sans Mono", "JetBrains Mono", monospace';
  function layout(W, H, st) {
    const vertical = H > W; const hud = vertical ? H * 0.13 : H * 0.11;
    const area = vertical ? { x: W * 0.04, y: hud, w: W * 0.92, h: H * 0.56 } : { x: W * 0.03, y: hud, w: W * 0.6, h: H - hud - H * 0.05 };
    const cell = Math.floor(Math.min(area.w / st.w, area.h / st.h)); const bw = cell * st.w, bh = cell * st.h;
    return { vertical, hud, cell, bx: Math.round(area.x + (area.w - bw) / 2), by: Math.round(area.y + (area.h - bh) / 2), bw, bh,
      panel: vertical ? { x: W * 0.06, y: area.y + area.h + H * 0.02, w: W * 0.88 } : { x: W * 0.66, y: hud + H * 0.02, w: W * 0.31 } };
  }
  function drawFrame(ctx, W, H, st, prev, t, ov = {}) {
    prev = prev || st; const L = layout(W, H, st), c = L.cell, U = Math.min(W, H) / 1080;
    ctx.fillStyle = '#050a06'; ctx.fillRect(0, 0, W, H);
    // device bezel
    ctx.fillStyle = '#10140f'; rr(ctx, L.bx - 24 * U, L.by - 24 * U, L.bw + 48 * U, L.bh + 48 * U, 28 * U); ctx.fill();
    ctx.fillStyle = LCD_BG; ctx.fillRect(L.bx, L.by, L.bw, L.bh);
    ctx.fillStyle = LCD_OFF; for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) ctx.fillRect(L.bx + x * c + 1, L.by + y * c + 1, c - 2, c - 2);
    // food (pulsing pixels)
    const pulse = 0.6 + 0.4 * Math.sin((st.tick + t) * 0.9);
    for (const [x, y] of st.food) { ctx.fillStyle = LCD_ON; ctx.shadowColor = LCD_ON; ctx.shadowBlur = 18 * U * pulse; ctx.fillRect(L.bx + x * c + c * 0.18, L.by + y * c + c * 0.18, c * 0.64, c * 0.64); }
    ctx.shadowBlur = 0;
    for (const s of st.snakes) {
      const ps = prev.snakes[s.id]; const dying = !s.alive && ps.alive; if (!s.alive && !dying) { // ghost of dead snake
        ctx.globalAlpha = 0.18; ctx.fillStyle = s.color; for (const [x, y] of ps.body) ctx.fillRect(L.bx + x * c + 2, L.by + y * c + 2, c - 4, c - 4); ctx.globalAlpha = 1; continue; }
      const body = dying ? ps.body : s.body; ctx.fillStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 14 * U;
      body.forEach(([x, y], i) => {
        let px = x, py = y; if (!dying && i === 0 && ps.alive) { const [ox, oy] = ps.body[0]; px = ox + (x - ox) * t; py = oy + (y - oy) * t; }
        if (dying) ctx.globalAlpha = (Math.floor(t * 6) % 2) ? 0.25 : 1;
        ctx.fillRect(L.bx + px * c + 1, L.by + py * c + 1, c - 2, c - 2);
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      if (!dying) { const [hx, hy] = s.body[0]; ctx.fillStyle = '#000'; ctx.fillRect(L.bx + hx * c + c * 0.35, L.by + hy * c + c * 0.35, c * 0.3, c * 0.3); }
    }
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = L.by; y < L.by + L.bh; y += 4) ctx.fillRect(L.bx, y, L.bw, 2);
    // HUD
    ctx.textAlign = 'center'; ctx.fillStyle = LCD_ON; ctx.shadowColor = LCD_ON; ctx.shadowBlur = 20 * U;
    ctx.font = `bold ${(L.vertical ? 92 : 64) * U}px ${FONT}`; ctx.fillText(ov.title || 'NEON SNAKE 2084', W / 2, L.hud * (L.vertical ? 0.42 : 0.52)); ctx.shadowBlur = 0;
    ctx.fillStyle = INK; ctx.font = `${(L.vertical ? 42 : 30) * U}px ${FONT}`; ctx.fillText(ov.subtitle || '', W / 2, L.hud * (L.vertical ? 0.68 : 0.85));
    // scoreboard
    const p = L.panel; let y = p.y; ctx.textAlign = 'left';
    const fs = (L.vertical ? 40 : 38) * U, rowH = L.vertical ? 1.75 : 2.0; ctx.font = `bold ${fs * 0.8}px ${FONT}`; ctx.fillStyle = INK;
    ctx.fillText(`TICK ${String(st.tick).padStart(4, '0')}   ${ov.round || ''}`, p.x, y + fs * 0.8); y += fs * 1.6;
    const rows = [...st.snakes].sort((a, b) => b.score - a.score || (b.diedAt ?? 1e9) - (a.diedAt ?? 1e9));
    for (const s of rows) {
      ctx.globalAlpha = s.alive ? 1 : 0.45; ctx.fillStyle = s.color; ctx.fillRect(p.x, y, fs * 0.9, fs * 0.9);
      ctx.font = `bold ${fs}px ${FONT}`; ctx.fillText(s.name, p.x + fs * 1.3, y + fs * 0.82);
      ctx.textAlign = 'right'; ctx.fillText(String(s.score), p.x + p.w, y + fs * 0.82); ctx.textAlign = 'left';
      if (!s.alive) { ctx.font = `${fs * 0.55}px ${FONT}`; ctx.fillStyle = '#ff6b6b'; ctx.fillText(`✖ ${s.cause} @${s.diedAt}`, p.x + fs * 1.3, y + fs * 1.45); }
      else if (s.blurb) { ctx.font = `${fs * 0.55}px ${FONT}`; ctx.fillStyle = INK; ctx.fillText(s.blurb, p.x + fs * 1.3, y + fs * 1.45); }
      ctx.globalAlpha = 1; y += fs * rowH;
    }
    if (ov.footer) { ctx.font = `${fs * 0.6}px ${FONT}`; ctx.fillStyle = INK; ov.footer.split('\n').forEach((ln, i) => ctx.fillText(ln, p.x, y + fs * 0.4 + i * fs * 0.85)); }
    if (ov.banner) { // centered banner over board
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, L.by + L.bh * 0.36, W, L.bh * 0.28); ctx.textAlign = 'center';
      ctx.fillStyle = ov.bannerColor || LCD_ON; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 24 * U;
      ctx.font = `bold ${(L.vertical ? 96 : 84) * U}px ${FONT}`; ctx.fillText(ov.banner, W / 2, L.by + L.bh * 0.5); ctx.shadowBlur = 0;
      if (ov.banner2) { ctx.fillStyle = INK; ctx.font = `${(L.vertical ? 44 : 38) * U}px ${FONT}`; ctx.fillText(ov.banner2, W / 2, L.by + L.bh * 0.58); }
    }
    if (ov.tag) { ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.font = `${(L.vertical ? 34 : 26) * U}px ${FONT}`; ctx.fillText(ov.tag, W / 2, H - (L.vertical ? 40 : 24) * U); }
    if (ov.cornerNote) { ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(185,255,176,0.55)'; ctx.font = `${18 * U}px ${FONT}`; ctx.fillText(ov.cornerNote, W - 20 * U, H - 14 * U); }
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  return { drawFrame, layout };
});
