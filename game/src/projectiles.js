// Projectiles: the player's sunlance bolts and the enemies' returning fire.
// Bolts carry pierce and crit; enemy shots are slower, glowing and dodgeable.
export function fireSunlance(session) {
  const p = session.player;
  const baseAngle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  const count = p.multishot;
  const spread = 0.09;
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * spread;
    const angle = baseAngle + offset;
    session.bullets.push({
      x: p.x + Math.cos(angle) * 26,
      y: p.y + Math.sin(angle) * 26,
      vx: Math.cos(angle) * 640,
      vy: Math.sin(angle) * 640,
      damage: p.damage,
      pierce: p.pierce,
      radius: 5,
      life: 1.1,
      hitIds: [],
      crit: session.rng() < p.critChance,
    });
  }
  session.stats.shotsFired += 1;
}

export function fireEnemyBolt(session, x, y, targetX, targetY, speed, damage, color) {
  const angle = Math.atan2(targetY - y, targetX - x);
  session.enemyBullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage,
    radius: 6,
    life: 4,
    color: color || '#f472b6',
    pulse: session.rng() * Math.PI * 2,
  });
}

export function fireRadialBurst(session, x, y, count, speed, damage, color, offsetAngle) {
  for (let i = 0; i < count; i += 1) {
    const angle = offsetAngle + (i / count) * Math.PI * 2;
    session.enemyBullets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      radius: 6,
      life: 4.5,
      color: color || '#f472b6',
      pulse: session.rng() * Math.PI * 2,
    });
  }
}

export function updateProjectiles(session, dt) {
  for (let i = session.bullets.length - 1; i >= 0; i -= 1) {
    const b = session.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > 1300 || b.y < -20 || b.y > 740) {
      session.bullets.splice(i, 1);
    }
  }
  for (let i = session.enemyBullets.length - 1; i >= 0; i -= 1) {
    const b = session.enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    b.pulse += dt * 6;
    if (b.life <= 0 || b.x < -20 || b.x > 1300 || b.y < -20 || b.y > 740) {
      session.enemyBullets.splice(i, 1);
    }
  }
}

export function drawProjectiles(ctx, session) {
  for (const b of session.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = '#fff7cc';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const b of session.enemyBullets) {
    const glow = 1 + Math.sin(b.pulse) * 0.25;
    ctx.fillStyle = b.color;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 2 * glow, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
