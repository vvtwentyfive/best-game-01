// Particles, floating damage numbers and screen shake: the feedback layer
// that makes every hit, pickup and explosion read instantly.
export function spawnHitSparks(session, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = session.rng() * Math.PI * 2;
    const speed = 60 + session.rng() * 220;
    session.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.25 + session.rng() * 0.3,
      maxLife: 0.55,
      size: 2 + session.rng() * 3.5,
      color,
      drag: 0.9,
      gravity: 0,
    });
  }
}

export function spawnExplosionBurst(session, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = session.rng() * Math.PI * 2;
    const speed = 40 + session.rng() * 320;
    session.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + session.rng() * 0.5,
      maxLife: 0.85,
      size: 3 + session.rng() * 6,
      color: i % 3 === 0 ? '#fff7cc' : color,
      drag: 0.88,
      gravity: 60,
    });
  }
  session.shake = Math.min(18, session.shake + 7);
}

export function spawnAmbientSand(session, dt) {
  session.sandTimer = (session.sandTimer || 0) + dt;
  while (session.sandTimer > 0.08) {
    session.sandTimer -= 0.08;
    session.particles.push({
      x: -10, y: session.rng() * 720,
      vx: 90 + session.rng() * 160, vy: 12 + session.rng() * 26,
      life: 2.2, maxLife: 2.2, size: 1 + session.rng() * 2,
      color: 'rgba(255,220,160,0.5)', drag: 1, gravity: 0, ambient: true,
    });
  }
}

export function spawnDamageNumber(session, x, y, amount, kind) {
  if (session.floaters.length > 40) session.floaters.shift();
  session.floaters.push({
    x: x + (session.rng() - 0.5) * 18,
    y: y - 8,
    vy: -64,
    life: 0.8,
    maxLife: 0.8,
    text: kind === 'crit' ? `${Math.round(amount)}!` : String(Math.round(amount)),
    color: kind === 'crit' ? '#ffd23f' : kind === 'heal' ? '#4ade80' : kind === 'burn' ? '#fb923c' : '#ffffff',
    size: kind === 'crit' ? 22 : 15,
  });
}

export function spawnPickupText(session, x, y, text, color) {
  session.floaters.push({
    x, y: y - 16, vy: -46, life: 1.1, maxLife: 1.1, text, color: color || '#ffd23f', size: 17,
  });
}

export function updateParticles(session, dt) {
  for (let i = session.particles.length - 1; i >= 0; i -= 1) {
    const p = session.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      session.particles.splice(i, 1);
      continue;
    }
    const drag = Math.pow(p.drag, dt * 60);
    p.vx *= drag;
    p.vy = p.vy * drag + p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = session.floaters.length - 1; i >= 0; i -= 1) {
    const f = session.floaters[i];
    f.life -= dt;
    f.y += f.vy * dt;
    f.vy *= 0.96;
    if (f.life <= 0) session.floaters.splice(i, 1);
  }
  session.shake = Math.max(0, session.shake - dt * 34);
}

export function shakeOffset(session) {
  if (session.shake <= 0.2) return { x: 0, y: 0 };
  return {
    x: (session.rng() - 0.5) * session.shake,
    y: (session.rng() - 0.5) * session.shake,
  };
}

export function drawParticles(ctx, session) {
  for (const p of session.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = p.ambient ? alpha * 0.6 : alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawDamageNumbers(ctx, session) {
  ctx.textAlign = 'center';
  for (const f of session.floaters) {
    const alpha = Math.max(0, f.life / f.maxLife);
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${f.size}px Verdana, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,10,0,0.8)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
