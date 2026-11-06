// ============================================================================
// DJ CLUB - SUPERSTAR HUMAN DJ DANCER GENERATION ENGINE (COOL EDISCO PRO)
// Generates ultra-high-definition, badass cyberpunk DJ dancers for Male & Female
// across 4 Uniform Tiers (Regular, Top 3, Top 2, Top 1) and 3 DIVERSE DANCE STYLES:
//   - Style 1: Rave Wave & Slash (Quơ Que Sáng Quẩy Tung Nóc)
//   - Style 2: Shuffle Dance & Cutting Shapes (Giậm Chân Nhảy Shuffle & Lắc Hông)
//   - Style 3: Hands Up & Party Hype (Hai Tay Giơ Cao Quẩy & Nhảy Bật)
// Features: Signature DJ Dual-Lens Sunglasses, DJ Headphones, Cuban Chain,
//           Glowing Equalizer T-Shirt, 2-Bone Non-Stretching Joint Kinematics!
// ============================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HumanSpriteSystem = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SPRITE_WIDTH = 320;
  const SPRITE_HEIGHT = 320;
  const TOTAL_FRAMES = 14;

  // Natural anime skin tones & stylish club palettes
  const PALETTES = {
    male: {
      skin: { base: '#fed7aa', shadow: '#f97316', highlight: '#fff7ed' },
      hair: { base: '#18181b', highlight: '#00f0ff', shadow: '#09090b' },
      regular: {
        jacket: '#18181b',
        jacketHighlight: '#27272a',
        trim: '#00f0ff',
        trim2: '#ec4899',
        pants: '#18181b',
        shoes: '#09090b',
        shoeTrim: '#00f0ff',
        glassesFrame: '#00f0ff',
        glassesGlow: 'rgba(0, 240, 255, 0.9)',
        lightstick: '#00f0ff',
        lightstickGlow: 'rgba(0, 240, 255, 0.9)'
      },
      top3: {
        jacket: '#78350f',
        jacketHighlight: '#92400e',
        armor: '#b45309',
        trim: '#f59e0b',
        trim2: '#fbbf24',
        pants: '#1c1917',
        shoes: '#451a03',
        shoeTrim: '#f59e0b',
        glassesFrame: '#f59e0b',
        glassesGlow: 'rgba(245, 158, 11, 0.9)',
        lightstick: '#ff7700',
        lightstickGlow: 'rgba(255, 119, 0, 0.9)'
      },
      top2: {
        jacket: '#1e293b',
        jacketHighlight: '#334155',
        armor: '#94a3b8',
        trim: '#00f0ff',
        trim2: '#38bdf8',
        pants: '#0f172a',
        shoes: '#1e293b',
        shoeTrim: '#00f0ff',
        glassesFrame: '#e2e8f0',
        glassesGlow: 'rgba(0, 240, 255, 0.95)',
        lightstick: '#00f0ff',
        lightstickGlow: 'rgba(0, 240, 255, 0.95)'
      },
      top1: {
        jacket: '#78350f',
        jacketHighlight: '#92400e',
        armor: '#ffd700',
        trim: '#fffbe6',
        trim2: '#ffd700',
        pants: '#18181b',
        shoes: '#ffd700',
        shoeTrim: '#ffffff',
        glassesFrame: '#ffd700',
        glassesGlow: 'rgba(255, 215, 0, 0.95)',
        lightstick: '#ffd700',
        lightstickGlow: 'rgba(255, 215, 0, 0.95)'
      }
    },
    female: {
      skin: { base: '#ffe4e6', shadow: '#fb7185', highlight: '#fff1f2' },
      hair: { base: '#831843', highlight: '#f43f5e', shadow: '#500724' },
      regular: {
        top: '#ec4899',
        topHighlight: '#f472b6',
        trim: '#00f0ff',
        trim2: '#ffffff',
        skirt: '#18181b',
        boots: '#18181b',
        bootTrim: '#ec4899',
        glassesFrame: '#ec4899',
        glassesGlow: 'rgba(236, 72, 153, 0.9)',
        lightstick: '#ff007f',
        lightstickGlow: 'rgba(255, 0, 127, 0.9)'
      },
      top3: {
        top: '#b45309',
        topHighlight: '#d97706',
        armor: '#d97706',
        trim: '#f59e0b',
        trim2: '#fde68a',
        skirt: '#451a03',
        boots: '#292524',
        bootTrim: '#f59e0b',
        glassesFrame: '#f59e0b',
        glassesGlow: 'rgba(245, 158, 11, 0.9)',
        lightstick: '#ff8800',
        lightstickGlow: 'rgba(255, 136, 0, 0.9)'
      },
      top2: {
        top: '#cbd5e1',
        topHighlight: '#f1f5f9',
        armor: '#f8fafc',
        trim: '#00f0ff',
        trim2: '#38bdf8',
        skirt: '#1e293b',
        boots: '#0f172a',
        bootTrim: '#00f0ff',
        glassesFrame: '#e2e8f0',
        glassesGlow: 'rgba(0, 240, 255, 0.95)',
        lightstick: '#00f0ff',
        lightstickGlow: 'rgba(0, 240, 255, 0.95)'
      },
      top1: {
        top: '#ffd700',
        topHighlight: '#fffbe6',
        armor: '#fffbe6',
        trim: '#ffd700',
        trim2: '#ffffff',
        skirt: '#451a03',
        boots: '#ffd700',
        bootTrim: '#ffffff',
        glassesFrame: '#ffd700',
        glassesGlow: 'rgba(255, 215, 0, 0.95)',
        lightstick: '#ffd700',
        lightstickGlow: 'rgba(255, 215, 0, 0.95)'
      }
    }
  };

  // Helper: 4-pointed sparkle star
  function drawSparkle(ctx, cx, cy, radius, color, glowColor) {
    ctx.save();
    ctx.fillStyle = color || '#ffffff';
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = radius * 1.5;
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.quadraticCurveTo(cx, cy, cx + radius, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + radius);
    ctx.quadraticCurveTo(cx, cy, cx - radius, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - radius);
    ctx.fill();
    ctx.restore();
  }

  // Draw Glowing Rave Lightstick with Tip Sparkle & Trail
  function drawLightstick(ctx, hx, hy, angle, color, glowColor, length = 46, tier = 'regular', trailAngle = null) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle);

    // Dynamic motion trail
    if (trailAngle !== null && Math.abs(trailAngle) > 0.08) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(0, -6 - length);
      ctx.arc(0, -6, length, -Math.PI / 2, -Math.PI / 2 - trailAngle, trailAngle < 0);
      ctx.closePath();
      ctx.fillStyle = (glowColor || 'rgba(0,240,255,0.85)').replace('0.9', '0.2').replace('0.95', '0.25');
      ctx.fill();
      ctx.restore();
    }

    // Handle
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-3, -6, 6, 14);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, -6, 6, 14);

    // Glowing Neon Baton Tube
    const grad = ctx.createLinearGradient(0, -6, 0, -6 - length);
    grad.addColorStop(0, color);
    grad.addColorStop(0.65, '#ffffff');
    grad.addColorStop(1, color);

    ctx.fillStyle = grad;
    ctx.shadowColor = glowColor || color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.roundRect(-4.5, -6 - length, 9, length, 4.5);
    ctx.fill();

    // Inner bright white core
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.fillRect(-1.5, -4 - length, 3, length - 4);

    // Top Tip Flare
    if (tier === 'top1') {
      drawSparkle(ctx, 0, -6 - length, 10, '#ffffff', '#ffd700');
    } else {
      drawSparkle(ctx, 0, -6 - length, 6, '#ffffff', color);
    }

    ctx.restore();
  }

  // Draw Iconic Cool DJ Dual-Lens Sunglasses
  function drawDJSunglasses(ctx, cx, cy, frameColor, glowColor, tier, fIdx) {
    ctx.save();
    const lensW = 19;
    const lensH = 15;
    const spacing = 8;
    const leftX = cx - spacing - lensW / 2;
    const rightX = cx + spacing + lensW / 2;

    // Curved Bridge across nose
    ctx.beginPath();
    ctx.moveTo(leftX + lensW * 0.45, cy - 2);
    ctx.quadraticCurveTo(cx, cy - 6, rightX - lensW * 0.45, cy - 2);
    ctx.strokeStyle = frameColor || '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw both lenses
    [leftX, rightX].forEach((lx, idx) => {
      const isL = idx === 0;

      // Hexagonal Aviator Shape
      ctx.beginPath();
      ctx.moveTo(lx - lensW * 0.48 * (isL ? -1 : 1), cy - lensH * 0.42);
      ctx.lineTo(lx + lensW * 0.48 * (isL ? -1 : 1), cy - lensH * 0.38);
      ctx.lineTo(lx + lensW * 0.44 * (isL ? -1 : 1), cy + lensH * 0.25);
      ctx.lineTo(lx + lensW * 0.12 * (isL ? -1 : 1), cy + lensH * 0.48);
      ctx.lineTo(lx - lensW * 0.38 * (isL ? -1 : 1), cy + lensH * 0.38);
      ctx.closePath();

      // Obsidian Mirror Fill
      ctx.fillStyle = '#090a12';
      ctx.fill();

      // Outer Glowing Frame
      ctx.strokeStyle = frameColor || '#00f0ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = glowColor || frameColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Diagonal Glossy Mirror Reflection
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lx - 12, cy + 10);
      ctx.lineTo(lx + 8, cy - 12);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lx - 6, cy + 12);
      ctx.lineTo(lx + 14, cy - 10);
      ctx.stroke();

      // Equalizer bars in lens!
      const eqBarH = 2 + Math.abs(Math.sin((fIdx + idx * 2) * 0.8)) * 6;
      ctx.fillStyle = idx === 0 ? '#00f0ff' : '#ec4899';
      ctx.fillRect(lx - 4, cy + 2 - eqBarH, 3, eqBarH);
      ctx.fillRect(lx + 1, cy + 4 - eqBarH * 0.8, 3, eqBarH * 0.8);
      ctx.restore();
    });

    // Star sparkle flash on right corner
    if (fIdx % 4 === 0) {
      drawSparkle(ctx, rightX + lensW * 0.45, cy - lensH * 0.35, 6, '#ffffff', frameColor);
    }

    ctx.restore();
  }

  // Draw Over-Ear DJ Headphones around neck
  function drawDJHeadphones(ctx, cx, cy, neonColor) {
    ctx.save();
    // Neckband
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 26, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Ear Cups
    [-26, 26].forEach(hx => {
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.roundRect(cx + hx - 6.5, cy - 12, 13, 18, 4.5);
      ctx.fill();

      ctx.fillStyle = neonColor || '#00f0ff';
      ctx.shadowColor = neonColor || '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx + hx, cy - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  // Draw Golden Cuban Link Chain
  function drawCubanChain(ctx, cx, cy, tier) {
    ctx.save();
    ctx.strokeStyle = (tier === 'top1' || tier === 'top3') ? '#ffd700' : '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 16, 0.3, Math.PI - 0.3);
    ctx.stroke();

    // Medallion
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy + 9, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ==========================================================================
  // 3 COOL DANCE CHOREOGRAPHIES (2-Bone Angles, 14 Frames / 2 Beats EDM)
  // ==========================================================================
  // Each pose specifies:
  // - bodyTilt (rad), hipShift (px), bounceY (px)
  // - Arm 1 & 2: { shoulderAngle (rad), elbowAngle (rad), trail (rad) }
  // - Leg 1 & 2: { hipAngle (rad), kneeAngle (rad), footLift (px) }
  // ==========================================================================

  // STYLE 1: Rave Wave & Slash (Quơ Que Sáng - Vung Tay Bắt Trống Kick)
  const DANCE_STYLE_1 = [];
  for (let f = 0; f < 14; f++) {
    const isL = f < 7;
    const p = isL ? (f / 7) : ((f - 7) / 7);
    const sign = isL ? -1 : 1;
    const sinP = Math.sin(p * Math.PI);
    const bounce = -Math.sin(p * Math.PI * 2) * 8;

    // Left arm waves high on left phase, right arm on right phase
    const waveArm = -Math.PI * 0.45 - sinP * 0.95;
    const chillArm = Math.PI * 0.3 + sinP * 0.2;

    DANCE_STYLE_1.push({
      bodyTilt: sign * sinP * 0.14,
      hipShift: sign * sinP * 16,
      bounceY: bounce,
      headTilt: -sign * sinP * 0.08,
      armL: {
        shoulder: isL ? waveArm : chillArm,
        elbow: isL ? -0.35 : 0.65,
        stickAngle: isL ? waveArm - 0.35 : chillArm + 0.45,
        trail: isL ? -sinP * 0.6 : 0
      },
      armR: {
        shoulder: isL ? (Math.PI - chillArm) : (Math.PI - waveArm),
        elbow: isL ? -0.65 : 0.35,
        stickAngle: isL ? (Math.PI - chillArm - 0.45) : (Math.PI - waveArm + 0.35),
        trail: isL ? 0 : sinP * 0.6
      },
      legL: {
        hip: isL ? 0.05 : (-sinP * 0.35),
        knee: isL ? 0.08 : (sinP * 0.55),
        lift: isL ? 0 : (sinP * 14)
      },
      legR: {
        hip: isL ? (sinP * 0.35) : -0.05,
        knee: isL ? (sinP * 0.55) : 0.08,
        lift: isL ? (sinP * 14) : 0
      }
    });
  }

  // STYLE 2: Shuffle Dance & Cutting Shapes (Giậm Chân Running Man, Lắc Hông & Xoay Que Sáng Tầm Eo)
  const DANCE_STYLE_2 = [];
  for (let f = 0; f < 14; f++) {
    const isL = f < 7;
    const p = isL ? (f / 7) : ((f - 7) / 7);
    const sign = isL ? -1 : 1;
    const sinP = Math.sin(p * Math.PI);
    const bounce = -Math.sin(p * Math.PI * 2) * 12;

    // Running man high knee lift!
    const liftL = isL ? (sinP * 24) : 0;
    const liftR = isL ? 0 : (sinP * 24);

    // Hands low around waist, twirling lightsticks
    const twirlL = Math.PI * 0.55 + Math.sin(f * 0.9) * 0.45;
    const twirlR = Math.PI * 0.45 - Math.sin(f * 0.9) * 0.45;

    DANCE_STYLE_2.push({
      bodyTilt: -sign * sinP * 0.08,
      hipShift: sign * sinP * 18,
      bounceY: bounce,
      headTilt: sign * sinP * 0.05,
      armL: {
        shoulder: Math.PI * 0.4 + sinP * 0.25,
        elbow: 0.85,
        stickAngle: twirlL,
        trail: -0.3
      },
      armR: {
        shoulder: Math.PI * 0.6 - sinP * 0.25,
        elbow: -0.85,
        stickAngle: twirlR,
        trail: 0.3
      },
      legL: {
        hip: isL ? (sinP * 0.65) : (-sinP * 0.2),
        knee: isL ? (sinP * 1.15) : 0.1,
        lift: liftL
      },
      legR: {
        hip: isL ? (-sinP * 0.2) : (sinP * 0.65),
        knee: isL ? 0.1 : (sinP * 1.15),
        lift: liftR
      }
    });
  }

  // STYLE 3: Hands Up In The Air & Party Hype (Cả Hai Tay Giơ Cao Vút Chữ V, Nhảy Bật Tưng Bừng)
  const DANCE_STYLE_3 = [];
  for (let f = 0; f < 14; f++) {
    const isL = f < 7;
    const p = isL ? (f / 7) : ((f - 7) / 7);
    const sign = isL ? -1 : 1;
    const sinP = Math.sin(p * Math.PI);
    // Big jump: entire body airborne on peak frames!
    const jumpApex = Math.sin(p * Math.PI) * 18;
    const bounce = -jumpApex;

    // Both arms raised high in V-shape, waving left & right in unison
    const swayAngle = sign * sinP * 0.45;
    const armBaseL = -Math.PI * 0.75 + swayAngle;
    const armBaseR = -Math.PI * 0.25 + swayAngle;

    DANCE_STYLE_3.push({
      bodyTilt: sign * sinP * 0.12,
      hipShift: sign * sinP * 12,
      bounceY: bounce,
      headTilt: -sign * sinP * 0.10,
      armL: {
        shoulder: armBaseL,
        elbow: -0.25,
        stickAngle: armBaseL - 0.25,
        trail: -sign * sinP * 0.5
      },
      armR: {
        shoulder: armBaseR,
        elbow: 0.25,
        stickAngle: armBaseR + 0.25,
        trail: -sign * sinP * 0.5
      },
      legL: {
        hip: 0.12,
        knee: sinP * 0.45,
        lift: jumpApex > 8 ? (jumpApex - 8) * 1.2 : 0
      },
      legR: {
        hip: -0.12,
        knee: sinP * 0.45,
        lift: jumpApex > 8 ? (jumpApex - 8) * 1.2 : 0
      }
    });
  }

  const DANCE_STYLES = {
    style1: DANCE_STYLE_1,
    style2: DANCE_STYLE_2,
    style3: DANCE_STYLE_3
  };

  // ==========================================================================
  // RENDER MALE DJ DANCER FRAME
  // ==========================================================================
  function renderMaleFrame(ctx, frameIdx, tier = 'regular', styleKey = 'style1') {
    const pal = PALETTES.male;
    const tpal = pal[tier] || pal.regular;
    const stylePoses = DANCE_STYLES[styleKey] || DANCE_STYLE_1;
    const f = frameIdx % TOTAL_FRAMES;
    const pose = stylePoses[f];

    ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);

    // Floor Contact Shadow
    ctx.save();
    ctx.beginPath();
    const shadowStretch = Math.max(0.5, 1 - (pose.bounceY / 80));
    ctx.ellipse(160 + pose.hipShift * 0.4, 305, 58 * shadowStretch, 12 * shadowStretch, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * shadowStretch})`;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(160 + pose.hipShift * 0.4, 160 + pose.bounceY);
    ctx.rotate(pose.bodyTilt);

    // TOP 1 IMPERIAL DRAGON CAPE
    if (tier === 'top1') {
      ctx.save();
      const capeWave = Math.sin(f * 0.55) * 14 - pose.bodyTilt * 35;
      ctx.beginPath();
      ctx.moveTo(-28, -32);
      ctx.quadraticCurveTo(-65 + capeWave, 40, -50 + capeWave * 1.2, 110);
      ctx.lineTo(50 + capeWave * 1.2, 110);
      ctx.quadraticCurveTo(65 + capeWave, 40, 28, -32);
      ctx.closePath();

      const capeGrad = ctx.createLinearGradient(0, -32, 0, 110);
      capeGrad.addColorStop(0, '#ffd700');
      capeGrad.addColorStop(0.35, '#f59e0b');
      capeGrad.addColorStop(0.8, '#78350f');
      capeGrad.addColorStop(1, '#451a03');
      ctx.fillStyle = capeGrad;
      ctx.fill();
      ctx.strokeStyle = '#fffbe6';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      [-50 + capeWave * 1.2, 50 + capeWave * 1.2].forEach(cx => {
        drawSparkle(ctx, cx, 110, 6, '#ffffff', '#ffd700');
      });
      ctx.restore();
    }

    // 1. LEGS & JOGGER PANTS (2-Bone FK: Thigh L1=38, Calf L2=38 -> Constant 76px!)
    const hipL = { x: -14, y: 32 };
    const hipR = { x: 14, y: 32 };
    const thighLen = 38, calfLen = 38;

    // Left Leg FK
    const kneeL = {
      x: hipL.x + Math.sin(pose.legL.hip) * thighLen,
      y: hipL.y + Math.cos(pose.legL.hip) * thighLen - pose.legL.lift * 0.5
    };
    const footL = {
      x: kneeL.x + Math.sin(pose.legL.hip + pose.legL.knee) * calfLen,
      y: kneeL.y + Math.cos(pose.legL.hip + pose.legL.knee) * calfLen - pose.legL.lift * 0.5
    };

    // Right Leg FK
    const kneeR = {
      x: hipR.x + Math.sin(pose.legR.hip) * thighLen,
      y: hipR.y + Math.cos(pose.legR.hip) * thighLen - pose.legR.lift * 0.5
    };
    const footR = {
      x: kneeR.x + Math.sin(pose.legR.hip + pose.legR.knee) * calfLen,
      y: kneeR.y + Math.cos(pose.legR.hip + pose.legR.knee) * calfLen - pose.legR.lift * 0.5
    };

    // Draw Pants (Thighs + Calves with smooth bend)
    [
      { hip: hipL, knee: kneeL, foot: footL },
      { hip: hipR, knee: kneeR, foot: footR }
    ].forEach(leg => {
      ctx.beginPath();
      ctx.moveTo(leg.hip.x, leg.hip.y);
      ctx.lineTo(leg.knee.x, leg.knee.y);
      ctx.lineTo(leg.foot.x, leg.foot.y);
      ctx.lineWidth = 17;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tpal.pants;
      ctx.stroke();

      // Neon Trim Line
      ctx.beginPath();
      ctx.moveTo(leg.hip.x, leg.hip.y + 4);
      ctx.lineTo(leg.knee.x, leg.knee.y);
      ctx.lineTo(leg.foot.x, leg.foot.y - 6);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = tpal.trim;
      ctx.stroke();
    });

    // High-Top Sneakers
    [
      { foot: footL, lift: pose.legL.lift },
      { foot: footR, lift: pose.legR.lift }
    ].forEach((s, idx) => {
      ctx.save();
      ctx.translate(s.foot.x, s.foot.y);
      if (s.lift > 2) ctx.rotate(idx === 0 ? 0.25 : -0.25);

      // Sneaker body
      ctx.fillStyle = tpal.shoes;
      ctx.beginPath();
      ctx.roundRect(-14, -13, 28, 15, [5, 6, 3, 3]);
      ctx.fill();

      // Glowing LED Soles
      ctx.fillStyle = tpal.shoeTrim;
      ctx.shadowColor = tpal.shoeTrim;
      ctx.shadowBlur = 10;
      ctx.fillRect(-14, 2, 28, 4);

      // White Toe Cap & Laces
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.fillRect(idx === 0 ? -14 : 7, -10, 7, 7);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-8, -10, 16, 5);

      ctx.restore();
    });

    // 2. TORSO & BOMBER JACKET
    ctx.save();
    // Jacket base
    ctx.beginPath();
    ctx.moveTo(-26, -34);
    ctx.lineTo(26, -34);
    ctx.lineTo(21, 28);
    ctx.lineTo(-21, 28);
    ctx.closePath();
    ctx.fillStyle = tpal.jacket;
    ctx.fill();
    ctx.strokeStyle = tpal.jacketHighlight;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner Tee with Pulsing Equalizer
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-11, -30, 22, 54);

    const eqColors = ['#00f0ff', '#00ff88', '#ffe600', '#ff007f'];
    for (let b = 0; b < 4; b++) {
      const barH = 4 + Math.abs(Math.sin((f + b * 2) * 0.9)) * 18;
      ctx.fillStyle = eqColors[b];
      ctx.fillRect(-9 + b * 5, 20 - barH, 3.5, barH);
    }

    // Neon trim edges on collar & hem
    ctx.fillStyle = tpal.trim;
    ctx.fillRect(-22, 26, 44, 3.5);
    ctx.fillStyle = tpal.trim2 || '#00f0ff';
    ctx.fillRect(-26, -34, 6, 58);
    ctx.fillRect(20, -34, 6, 58);

    // Cuban Chain on Chest
    drawCubanChain(ctx, 0, -22, tier);

    ctx.restore();

    // 3. HEAD & COOL DJ SHADES
    ctx.save();
    ctx.translate(0, -68);
    ctx.rotate(pose.headTilt);

    // Neck
    ctx.fillStyle = pal.skin.shadow;
    ctx.fillRect(-7, 24, 14, 12);

    // Jaw & Face Base
    ctx.beginPath();
    ctx.ellipse(0, 4, 21, 25, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();

    // Angular Chin
    ctx.beginPath();
    ctx.moveTo(-17, 6);
    ctx.lineTo(0, 26);
    ctx.lineTo(17, 6);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();

    // Confident Smirk Mouth
    ctx.beginPath();
    ctx.arc(1, 16, 5, 0.15, Math.PI - 0.2);
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 2;
    ctx.stroke();

    // SIGNATURE SUPERSTAR DJ SUNGLASSES!
    drawDJSunglasses(ctx, 0, 4, tpal.glassesFrame, tpal.glassesGlow, tier, f);

    // Cool Spiky Undercut Anime Hair
    const hairLag = -pose.bodyTilt * 15;
    ctx.fillStyle = pal.hair.base;
    ctx.beginPath();
    ctx.moveTo(-23, 2);
    ctx.lineTo(-28 + hairLag, -16);
    ctx.lineTo(-18 + hairLag, -32);
    ctx.lineTo(-4 + hairLag, -38);
    ctx.lineTo(12 + hairLag, -35);
    ctx.lineTo(26 + hairLag, -22);
    ctx.lineTo(23, 2);
    ctx.lineTo(18, -4);
    ctx.lineTo(10 + hairLag * 0.4, -18);
    ctx.lineTo(0 + hairLag * 0.4, -22);
    ctx.lineTo(-10 + hairLag * 0.4, -18);
    ctx.lineTo(-18, -4);
    ctx.closePath();
    ctx.fill();

    // Cyan Neon Hair Streaks
    ctx.strokeStyle = pal.hair.highlight;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-14 + hairLag, -26);
    ctx.lineTo(-2 + hairLag, -32);
    ctx.lineTo(10 + hairLag, -28);
    ctx.stroke();

    // DJ Over-Ear Headphones around neck
    drawDJHeadphones(ctx, 0, 24, tpal.trim);

    ctx.restore(); // end head

    // 4. ARMS & GLOWSTICKS (2-Bone FK: Upper Arm L1=30, Forearm L2=28 -> Constant 58px!)
    const shoulderL = { x: -26, y: -26 };
    const shoulderR = { x: 26, y: -26 };
    const upperLen = 30, foreLen = 28;

    // Left Arm FK
    const elbowL = {
      x: shoulderL.x + Math.cos(pose.armL.shoulder) * upperLen,
      y: shoulderL.y + Math.sin(pose.armL.shoulder) * upperLen
    };
    const handL = {
      x: elbowL.x + Math.cos(pose.armL.shoulder + pose.armL.elbow) * foreLen,
      y: elbowL.y + Math.sin(pose.armL.shoulder + pose.armL.elbow) * foreLen
    };

    // Right Arm FK
    const elbowR = {
      x: shoulderR.x + Math.cos(pose.armR.shoulder) * upperLen,
      y: shoulderR.y + Math.sin(pose.armR.shoulder) * upperLen
    };
    const handR = {
      x: elbowR.x + Math.cos(pose.armR.shoulder + pose.armR.elbow) * foreLen,
      y: elbowR.y + Math.sin(pose.armR.shoulder + pose.armR.elbow) * foreLen
    };

    // Draw Left Arm & Glove
    ctx.beginPath();
    ctx.moveTo(shoulderL.x, shoulderL.y);
    ctx.lineTo(elbowL.x, elbowL.y);
    ctx.lineTo(handL.x, handL.y);
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tpal.jacket;
    ctx.stroke();

    // Left Hand & DJ Glove
    ctx.fillStyle = pal.skin.base;
    ctx.beginPath();
    ctx.arc(handL.x, handL.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#09090b';
    ctx.fillRect(handL.x - 4, handL.y - 4, 8, 5);

    // Left Glowstick
    drawLightstick(ctx, handL.x, handL.y, pose.armL.stickAngle, tpal.lightstick, tpal.lightstickGlow, 48, tier, pose.armL.trail);

    // Draw Right Arm & Glove
    ctx.beginPath();
    ctx.moveTo(shoulderR.x, shoulderR.y);
    ctx.lineTo(elbowR.x, elbowR.y);
    ctx.lineTo(handR.x, handR.y);
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tpal.jacket;
    ctx.stroke();

    // Right Hand & DJ Glove
    ctx.fillStyle = pal.skin.base;
    ctx.beginPath();
    ctx.arc(handR.x, handR.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#09090b';
    ctx.fillRect(handR.x - 4, handR.y - 4, 8, 5);

    // Right Glowstick
    drawLightstick(ctx, handR.x, handR.y, pose.armR.stickAngle, tpal.lightstick, tpal.lightstickGlow, 48, tier, pose.armR.trail);

    ctx.restore(); // end character transform
  }

  // ==========================================================================
  // RENDER FEMALE CYBER RAVE DIVA FRAME
  // ==========================================================================
  function renderFemaleFrame(ctx, frameIdx, tier = 'regular', styleKey = 'style1') {
    const pal = PALETTES.female;
    const tpal = pal[tier] || pal.regular;
    const stylePoses = DANCE_STYLES[styleKey] || DANCE_STYLE_1;
    const f = frameIdx % TOTAL_FRAMES;
    const pose = stylePoses[f];

    ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);

    // Floor Contact Shadow
    ctx.save();
    ctx.beginPath();
    const shadowStretch = Math.max(0.5, 1 - (pose.bounceY / 80));
    ctx.ellipse(160 + pose.hipShift * 0.4, 305, 52 * shadowStretch, 11 * shadowStretch, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * shadowStretch})`;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(160 + pose.hipShift * 0.4, 160 + pose.bounceY);
    ctx.rotate(pose.bodyTilt);

    // TOP 1 CELESTIAL RIBBON
    if (tier === 'top1') {
      ctx.save();
      const ribbonWave = Math.sin(f * 0.55) * 18 - pose.bodyTilt * 35;
      ctx.beginPath();
      ctx.moveTo(-45, 40);
      ctx.quadraticCurveTo(-70 + ribbonWave, -35, 0, -85);
      ctx.quadraticCurveTo(70 + ribbonWave, -35, 45, 40);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.75)';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      drawSparkle(ctx, 0, -85, 8, '#ffffff', '#ffd700');
      ctx.restore();
    }

    // 1. LEGS & THIGH-HIGH BOOTS (2-Bone FK: Thigh L1=36, Calf L2=36 -> Constant 72px!)
    const hipL = { x: -12, y: 32 };
    const hipR = { x: 12, y: 32 };
    const thighLen = 36, calfLen = 36;

    // Left Leg FK
    const kneeL = {
      x: hipL.x + Math.sin(pose.legL.hip) * thighLen,
      y: hipL.y + Math.cos(pose.legL.hip) * thighLen - pose.legL.lift * 0.5
    };
    const footL = {
      x: kneeL.x + Math.sin(pose.legL.hip + pose.legL.knee) * calfLen,
      y: kneeL.y + Math.cos(pose.legL.hip + pose.legL.knee) * calfLen - pose.legL.lift * 0.5
    };

    // Right Leg FK
    const kneeR = {
      x: hipR.x + Math.sin(pose.legR.hip) * thighLen,
      y: hipR.y + Math.cos(pose.legR.hip) * thighLen - pose.legR.lift * 0.5
    };
    const footR = {
      x: kneeR.x + Math.sin(pose.legR.hip + pose.legR.knee) * calfLen,
      y: kneeR.y + Math.cos(pose.legR.hip + pose.legR.knee) * calfLen - pose.legR.lift * 0.5
    };

    // Bare Thighs
    [
      { hip: hipL, knee: kneeL },
      { hip: hipR, knee: kneeR }
    ].forEach(leg => {
      ctx.beginPath();
      ctx.moveTo(leg.hip.x, leg.hip.y);
      ctx.lineTo(leg.knee.x, leg.knee.y);
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.strokeStyle = pal.skin.base;
      ctx.stroke();
    });

    // Thigh-High Boots / Stockings
    [
      { knee: kneeL, foot: footL },
      { knee: kneeR, foot: footR }
    ].forEach(leg => {
      ctx.beginPath();
      ctx.moveTo(leg.knee.x, leg.knee.y - 4);
      ctx.lineTo(leg.foot.x, leg.foot.y);
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.strokeStyle = tpal.boots;
      ctx.stroke();

      // Neon Top Rim
      ctx.fillStyle = tpal.bootTrim;
      ctx.fillRect(leg.knee.x - 7, leg.knee.y - 7, 14, 3);
    });

    // Platform Boots
    [
      { foot: footL, lift: pose.legL.lift },
      { foot: footR, lift: pose.legR.lift }
    ].forEach((s, idx) => {
      ctx.save();
      ctx.translate(s.foot.x, s.foot.y);
      if (s.lift > 2) ctx.rotate(idx === 0 ? 0.25 : -0.25);

      ctx.fillStyle = tpal.boots;
      ctx.beginPath();
      ctx.roundRect(-12, -12, 24, 15, [5, 6, 3, 3]);
      ctx.fill();

      // Glowing Neon Sole
      ctx.fillStyle = tpal.bootTrim;
      ctx.shadowColor = tpal.bootTrim;
      ctx.shadowBlur = 10;
      ctx.fillRect(-12, 3, 24, 4);

      // Chunky heel
      ctx.fillStyle = '#09090b';
      ctx.shadowBlur = 0;
      ctx.fillRect(idx === 0 ? -11 : 4, 5, 7, 5);

      ctx.restore();
    });

    // 2. TORSO, CROP TOP & PLEATED SKIRT
    ctx.save();
    // Bare Midriff
    ctx.fillStyle = pal.skin.base;
    ctx.fillRect(-12, -2, 24, 24);

    // Crop Top
    ctx.beginPath();
    ctx.moveTo(-21, -30);
    ctx.lineTo(21, -30);
    ctx.lineTo(15, -4);
    ctx.lineTo(-15, -4);
    ctx.closePath();
    ctx.fillStyle = tpal.top;
    ctx.fill();
    ctx.strokeStyle = tpal.topHighlight;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pleated Mini Skirt
    ctx.fillStyle = tpal.skirt;
    ctx.beginPath();
    ctx.moveTo(-18, 14);
    ctx.lineTo(18, 14);
    ctx.lineTo(26, 34);
    ctx.lineTo(-26, 34);
    ctx.closePath();
    ctx.fill();

    // Neon Skirt Hem
    ctx.fillStyle = tpal.trim;
    ctx.fillRect(-26, 32, 52, 3.5);

    // Cuban Chain / Choker
    drawCubanChain(ctx, 0, -20, tier);

    ctx.restore();

    // 3. HEAD & CYBER RAVE DIVA SHADES
    ctx.save();
    ctx.translate(0, -64);
    ctx.rotate(pose.headTilt);

    // Flowing Twin-Tails behind head
    const hairLag = -pose.bodyTilt * 22;
    const twinWave = Math.sin(f * 0.55) * 12;

    ctx.fillStyle = pal.hair.base;
    // Left Twin-tail
    ctx.beginPath();
    ctx.moveTo(-18, -16);
    ctx.quadraticCurveTo(-52 + hairLag - twinWave, 6, -38 + hairLag * 1.3, 56);
    ctx.quadraticCurveTo(-30, 24, -14, -6);
    ctx.fill();

    // Right Twin-tail
    ctx.beginPath();
    ctx.moveTo(18, -16);
    ctx.quadraticCurveTo(52 + hairLag - twinWave, 6, 38 + hairLag * 1.3, 56);
    ctx.quadraticCurveTo(30, 24, 14, -6);
    ctx.fill();

    // Neck
    ctx.fillStyle = pal.skin.shadow;
    ctx.fillRect(-6, 22, 12, 10);

    // Sweet Chibi Face Base
    ctx.beginPath();
    ctx.ellipse(0, 2, 19, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();

    // Rosy Blush Cheeks
    ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.beginPath();
    ctx.ellipse(-14, 9, 6, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(14, 9, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sassy Smile
    ctx.beginPath();
    ctx.arc(0, 15, 4.5, 0.15, Math.PI - 0.15);
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // SIGNATURE CYBER RAVE SUNGLASSES
    drawDJSunglasses(ctx, 0, 2, tpal.glassesFrame, tpal.glassesGlow, tier, f);

    // Front Bangs
    ctx.fillStyle = pal.hair.base;
    ctx.beginPath();
    ctx.moveTo(-22, -6);
    ctx.quadraticCurveTo(-16, -26, 0, -28);
    ctx.quadraticCurveTo(16, -26, 22, -6);
    ctx.lineTo(16, -10);
    ctx.lineTo(10, -18);
    ctx.lineTo(0, -12);
    ctx.lineTo(-10, -18);
    ctx.lineTo(-16, -10);
    ctx.closePath();
    ctx.fill();

    // Neko Cat-Ear Headband / Headphones
    ctx.save();
    ctx.translate(0, -22);
    [-18, 18].forEach(nx => {
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.moveTo(nx - 7, 4);
      ctx.lineTo(nx, -15);
      ctx.lineTo(nx + 7, 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = tpal.trim;
      ctx.shadowColor = tpal.trim;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(nx - 3.5, 2);
      ctx.lineTo(nx, -10);
      ctx.lineTo(nx + 3.5, 2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();

    ctx.restore(); // end head

    // 4. ARMS & GLOWSTICKS (2-Bone FK: Upper Arm L1=28, Forearm L2=26 -> Constant 54px!)
    const shoulderL = { x: -21, y: -24 };
    const shoulderR = { x: 21, y: -24 };
    const upperLen = 28, foreLen = 26;

    // Left Arm FK
    const elbowL = {
      x: shoulderL.x + Math.cos(pose.armL.shoulder) * upperLen,
      y: shoulderL.y + Math.sin(pose.armL.shoulder) * upperLen
    };
    const handL = {
      x: elbowL.x + Math.cos(pose.armL.shoulder + pose.armL.elbow) * foreLen,
      y: elbowL.y + Math.sin(pose.armL.shoulder + pose.armL.elbow) * foreLen
    };

    // Right Arm FK
    const elbowR = {
      x: shoulderR.x + Math.cos(pose.armR.shoulder) * upperLen,
      y: shoulderR.y + Math.sin(pose.armR.shoulder) * upperLen
    };
    const handR = {
      x: elbowR.x + Math.cos(pose.armR.shoulder + pose.armR.elbow) * foreLen,
      y: elbowR.y + Math.sin(pose.armR.shoulder + pose.armR.elbow) * foreLen
    };

    // Draw Left Arm
    ctx.beginPath();
    ctx.moveTo(shoulderL.x, shoulderL.y);
    ctx.lineTo(elbowL.x, elbowL.y);
    ctx.lineTo(handL.x, handL.y);
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = pal.skin.base;
    ctx.stroke();

    // Left Hand & Rave Wristband
    ctx.fillStyle = pal.skin.base;
    ctx.beginPath();
    ctx.arc(handL.x, handL.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tpal.trim;
    ctx.fillRect(handL.x - 3.5, handL.y - 3.5, 7, 4);

    // Left Glowstick
    drawLightstick(ctx, handL.x, handL.y, pose.armL.stickAngle, tpal.lightstick, tpal.lightstickGlow, 44, tier, pose.armL.trail);

    // Draw Right Arm
    ctx.beginPath();
    ctx.moveTo(shoulderR.x, shoulderR.y);
    ctx.lineTo(elbowR.x, elbowR.y);
    ctx.lineTo(handR.x, handR.y);
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = pal.skin.base;
    ctx.stroke();

    // Right Hand & Rave Wristband
    ctx.fillStyle = pal.skin.base;
    ctx.beginPath();
    ctx.arc(handR.x, handR.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tpal.trim;
    ctx.fillRect(handR.x - 3.5, handR.y - 3.5, 7, 4);

    // Right Glowstick
    drawLightstick(ctx, handR.x, handR.y, pose.armR.stickAngle, tpal.lightstick, tpal.lightstickGlow, 44, tier, pose.armR.trail);

    ctx.restore(); // end female character transform
  }

  // Pre-render all 336 combinations: 2 Genders x 4 Tiers x 3 Dance Styles x 14 Frames
  function generateSpriteCache(targetCache) {
    const genders = ['male', 'female'];
    const tiers = ['regular', 'top3', 'top2', 'top1'];
    const styles = ['style1', 'style2', 'style3'];

    console.log('[HumanSpriteSystem] Generating 3 Diverse Dance Styles Sprite Cache with DJ Shades...');
    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    let count = 0;

    genders.forEach(gender => {
      tiers.forEach(tier => {
        styles.forEach(styleKey => {
          const key = `human_${gender}_${tier}_${styleKey}`;
          targetCache[key] = [];

          if (styleKey === 'style1') {
            targetCache[`human_${gender}_${tier}`] = targetCache[key];
          }

          for (let f = 0; f < TOTAL_FRAMES; f++) {
            let canvas;
            if (typeof OffscreenCanvas !== 'undefined') {
              canvas = new OffscreenCanvas(SPRITE_WIDTH, SPRITE_HEIGHT);
            } else if (typeof document !== 'undefined') {
              canvas = document.createElement('canvas');
              canvas.width = SPRITE_WIDTH;
              canvas.height = SPRITE_HEIGHT;
            } else {
              return;
            }

            const ctx = canvas.getContext('2d');
            if (gender === 'male') {
              renderMaleFrame(ctx, f, tier, styleKey);
            } else {
              renderFemaleFrame(ctx, f, tier, styleKey);
            }

            targetCache[key].push(canvas);
            count++;
          }
        });
      });

      // Default base aliases
      targetCache[`human_${gender}`] = targetCache[`human_${gender}_regular_style1`];
    });

    const elapsed = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime).toFixed(1);
    console.log(`[HumanSpriteSystem] Generated ${count} high-definition frames across 3 diverse dance styles in ${elapsed}ms!`);
  }

  return {
    SPRITE_WIDTH,
    SPRITE_HEIGHT,
    TOTAL_FRAMES,
    DANCE_STYLES,
    renderMaleFrame,
    renderFemaleFrame,
    generateSpriteCache
  };
});
