// ============================================================================
// DJ CLUB - HUMAN CHARACTER SPRITE GENERATION ENGINE (MULTI-DANCE PRO EDITION)
// Generates ultra-high-definition procedural vector sprite frames for Male & Female
// across 4 Uniform Tiers (Regular, Top 3, Top 2, Top 1) and 3 DIVERSE DANCE STYLES:
//   - Style 1: Rave Wave & Slash (Quơ Que Sáng Quẩy Tung Nóc)
//   - Style 2: Shuffle Dance & Footwork (Giậm Chân Nhảy Shuffle & Lắc Hông)
//   - Style 3: Hands Up & Party Hype (Hai Tay Giơ Cao Quẩy & Nhảy Bật)
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
  const SPRITE_HEIGHT = 360;
  const TOTAL_FRAMES = 14;

  // Color Palettes for Genders & Uniform Tiers
  const PALETTES = {
    male: {
      skin: { base: '#fcd34d', shadow: '#d97706', highlight: '#fef3c7' },
      hair: { base: '#1e1b4b', highlight: '#06b6d4', shadow: '#0f172a' },
      regular: {
        jacket: '#18181b',
        jacketHighlight: '#27272a',
        trim: '#06b6d4',
        trim2: '#ec4899',
        pants: '#27272a',
        shoes: '#09090b',
        shoeTrim: '#06b6d4',
        lightstick: '#00f0ff',
        lightstickGlow: 'rgba(0, 240, 255, 0.85)'
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
        lightstick: '#ff7700',
        lightstickGlow: 'rgba(255, 119, 0, 0.85)'
      },
      top2: {
        jacket: '#334155',
        jacketHighlight: '#475569',
        armor: '#94a3b8',
        trim: '#00f0ff',
        trim2: '#38bdf8',
        pants: '#0f172a',
        shoes: '#1e293b',
        shoeTrim: '#00f0ff',
        lightstick: '#00f0ff',
        lightstickGlow: 'rgba(0, 240, 255, 0.95)'
      },
      top1: {
        jacket: '#78350f',
        jacketHighlight: '#92400e',
        armor: '#ffd700',
        trim: '#fffbe6',
        trim2: '#f59e0b',
        pants: '#18181b',
        shoes: '#ffd700',
        shoeTrim: '#ffffff',
        lightstick: '#ffd700',
        lightstickGlow: 'rgba(255, 215, 0, 0.95)'
      }
    },
    female: {
      skin: { base: '#fed7aa', shadow: '#ea580c', highlight: '#fff7ed' },
      hair: { base: '#c026d3', highlight: '#06b6d4', shadow: '#701a75' },
      regular: {
        top: '#ec4899',
        topHighlight: '#f472b6',
        trim: '#06b6d4',
        trim2: '#ffffff',
        skirt: '#18181b',
        boots: '#18181b',
        bootTrim: '#ec4899',
        lightstick: '#ff007f',
        lightstickGlow: 'rgba(255, 0, 127, 0.85)'
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
        lightstick: '#ff8800',
        lightstickGlow: 'rgba(255, 136, 0, 0.85)'
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
        lightstick: '#ffd700',
        lightstickGlow: 'rgba(255, 215, 0, 0.95)'
      }
    }
  };

  // Helper: Draw 4-point sparkle star
  function drawSparkle(ctx, cx, cy, radius, color, glowColor) {
    ctx.save();
    ctx.fillStyle = color || '#ffffff';
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = radius * 1.6;
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

  // Draw Glowing Rave Lightstick & Radiant Tip Flare
  function drawLightstick(ctx, hx, hy, angle, color, glowColor, length = 62, tier = 'regular', trailAngle = null) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle);

    // Dynamic Motion Trail / Speed Arc when swinging
    if (trailAngle !== null && Math.abs(trailAngle) > 0.1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, -8 - length);
      ctx.arc(0, -8, length, -Math.PI / 2, -Math.PI / 2 - trailAngle, trailAngle < 0);
      ctx.closePath();
      ctx.fillStyle = glowColor.replace('0.85', '0.22').replace('0.95', '0.25');
      ctx.fill();
      ctx.restore();
    }

    // Handle
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-3.5, -8, 7, 18);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(-3.5, -8, 7, 18);

    // Glowing Neon Baton Tube
    const grad = ctx.createLinearGradient(0, -8, 0, -8 - length);
    grad.addColorStop(0, color);
    grad.addColorStop(0.7, '#ffffff');
    grad.addColorStop(1, color);

    ctx.fillStyle = grad;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.roundRect(-5, -8 - length, 10, length, 5);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.fillRect(-2, -6 - length, 4, length - 4);

    // Top Ornament / Crown Scepter based on Tier
    if (tier === 'top1') {
      drawSparkle(ctx, 0, -8 - length, 14, '#ffffff', '#ffd700');
      ctx.beginPath();
      ctx.arc(0, -8 - length, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0055';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 12;
      ctx.fill();
    } else if (tier === 'top2') {
      drawSparkle(ctx, 0, -8 - length, 10, '#00f0ff', '#00f0ff');
    } else if (tier === 'top3') {
      drawSparkle(ctx, 0, -8 - length, 8, '#ffaa00', '#ffaa00');
    } else {
      drawSparkle(ctx, 0, -8 - length, 6, '#ffffff', color);
    }

    ctx.restore();
  }

  // ==========================================================================
  // 3 DIVERSE DANCE CHOREOGRAPHIES (14 Frames each)
  // ==========================================================================

  // STYLE 1: Rave Wave & Slash (Quơ Que Sáng - Vũ Đạo Hào Quang)
  const DANCE_STYLE_1 = [
    { bodyLean: 0.0, hipShift: 0, headTilt: 0.0, bounceY: 4, leftArm: { x: 130, y: 195, angle: -0.55, trail: 0.0 }, rightArm: { x: 190, y: 195, angle: 0.55, trail: 0.0 }, leftFoot: { x: 125, y: 335, heel: 0 }, rightFoot: { x: 195, y: 335, heel: 0 }, leftKnee: { x: 135, y: 275 }, rightKnee: { x: 185, y: 275 } },
    { bodyLean: -0.04, hipShift: 6, headTilt: -0.02, bounceY: 14, leftArm: { x: 120, y: 205, angle: -0.70, trail: -0.2 }, rightArm: { x: 175, y: 205, angle: 0.40, trail: 0.2 }, leftFoot: { x: 122, y: 335, heel: 0 }, rightFoot: { x: 192, y: 335, heel: 4 }, leftKnee: { x: 130, y: 278 }, rightKnee: { x: 180, y: 278 } },
    { bodyLean: -0.08, hipShift: 12, headTilt: -0.05, bounceY: 6, leftArm: { x: 100, y: 160, angle: -0.95, trail: -0.45 }, rightArm: { x: 155, y: 190, angle: -0.25, trail: -0.30 }, leftFoot: { x: 114, y: 335, heel: 0 }, rightFoot: { x: 196, y: 335, heel: 6 }, leftKnee: { x: 124, y: 275 }, rightKnee: { x: 178, y: 274 } },
    { bodyLean: -0.14, hipShift: 18, headTilt: -0.09, bounceY: -4, leftArm: { x: 80, y: 115, angle: -1.25, trail: -0.65 }, rightArm: { x: 135, y: 165, angle: -0.60, trail: -0.45 }, leftFoot: { x: 110, y: 335, heel: 0 }, rightFoot: { x: 198, y: 335, heel: 8 }, leftKnee: { x: 120, y: 272 }, rightKnee: { x: 175, y: 272 } },
    { bodyLean: -0.18, hipShift: 22, headTilt: -0.12, bounceY: -10, leftArm: { x: 68, y: 82, angle: -1.45, trail: -0.85 }, rightArm: { x: 115, y: 130, angle: -0.85, trail: -0.60 }, leftFoot: { x: 108, y: 335, heel: 0 }, rightFoot: { x: 202, y: 335, heel: 10 }, leftKnee: { x: 116, y: 270 }, rightKnee: { x: 172, y: 270 } },
    { bodyLean: -0.15, hipShift: 20, headTilt: -0.10, bounceY: -6, leftArm: { x: 74, y: 92, angle: -1.35, trail: 0.35 }, rightArm: { x: 122, y: 138, angle: -0.75, trail: 0.30 }, leftFoot: { x: 110, y: 335, heel: 0 }, rightFoot: { x: 200, y: 335, heel: 8 }, leftKnee: { x: 118, y: 271 }, rightKnee: { x: 174, y: 271 } },
    { bodyLean: -0.09, hipShift: 14, headTilt: -0.06, bounceY: 4, leftArm: { x: 95, y: 135, angle: -1.05, trail: 0.50 }, rightArm: { x: 142, y: 165, angle: -0.45, trail: 0.40 }, leftFoot: { x: 115, y: 335, heel: 0 }, rightFoot: { x: 196, y: 335, heel: 4 }, leftKnee: { x: 124, y: 274 }, rightKnee: { x: 178, y: 274 } },
    { bodyLean: -0.01, hipShift: 4, headTilt: -0.01, bounceY: 10, leftArm: { x: 125, y: 185, angle: -0.65, trail: 0.30 }, rightArm: { x: 175, y: 185, angle: 0.45, trail: -0.30 }, leftFoot: { x: 122, y: 335, heel: 2 }, rightFoot: { x: 192, y: 335, heel: 2 }, leftKnee: { x: 132, y: 276 }, rightKnee: { x: 182, y: 276 } },
    { bodyLean: 0.08, hipShift: -12, headTilt: 0.05, bounceY: 6, leftArm: { x: 165, y: 190, angle: 0.25, trail: 0.30 }, rightArm: { x: 220, y: 160, angle: 0.95, trail: 0.45 }, leftFoot: { x: 124, y: 335, heel: 6 }, rightFoot: { x: 206, y: 335, heel: 0 }, leftKnee: { x: 142, y: 274 }, rightKnee: { x: 196, y: 275 } },
    { bodyLean: 0.14, hipShift: -18, headTilt: 0.09, bounceY: -4, leftArm: { x: 185, y: 165, angle: 0.60, trail: 0.45 }, rightArm: { x: 240, y: 115, angle: 1.25, trail: 0.65 }, leftFoot: { x: 122, y: 335, heel: 8 }, rightFoot: { x: 210, y: 335, heel: 0 }, leftKnee: { x: 145, y: 272 }, rightKnee: { x: 200, y: 272 } },
    { bodyLean: 0.18, hipShift: -22, headTilt: 0.12, bounceY: -10, leftArm: { x: 205, y: 130, angle: 0.85, trail: 0.60 }, rightArm: { x: 252, y: 82, angle: 1.45, trail: 0.85 }, leftFoot: { x: 118, y: 335, heel: 10 }, rightFoot: { x: 212, y: 335, heel: 0 }, leftKnee: { x: 148, y: 270 }, rightKnee: { x: 204, y: 270 } },
    { bodyLean: 0.15, hipShift: -20, headTilt: 0.10, bounceY: -6, leftArm: { x: 198, y: 138, angle: 0.75, trail: -0.30 }, rightArm: { x: 246, y: 92, angle: 1.35, trail: -0.35 }, leftFoot: { x: 120, y: 335, heel: 8 }, rightFoot: { x: 210, y: 335, heel: 0 }, leftKnee: { x: 146, y: 271 }, rightKnee: { x: 202, y: 271 } },
    { bodyLean: 0.09, hipShift: -14, headTilt: 0.06, bounceY: 4, leftArm: { x: 178, y: 165, angle: 0.45, trail: -0.40 }, rightArm: { x: 225, y: 135, angle: 1.05, trail: -0.50 }, leftFoot: { x: 124, y: 335, heel: 4 }, rightFoot: { x: 205, y: 335, heel: 0 }, leftKnee: { x: 142, y: 274 }, rightKnee: { x: 196, y: 274 } },
    { bodyLean: 0.03, hipShift: -6, headTilt: 0.02, bounceY: 8, leftArm: { x: 145, y: 185, angle: -0.35, trail: -0.25 }, rightArm: { x: 200, y: 185, angle: 0.65, trail: -0.25 }, leftFoot: { x: 124, y: 335, heel: 2 }, rightFoot: { x: 198, y: 335, heel: 2 }, leftKnee: { x: 136, y: 275 }, rightKnee: { x: 190, y: 275 } }
  ];

  // STYLE 2: Shuffle Dance & Cutting Shapes (Giậm Chân Shuffle, Lắc Hông & Xoay Cổ Tay)
  // Đặc trưng: Chân bước chéo trượt sàn, tay xoay que sáng tầm thấp-trung quanh thắt lưng, nhún nảy cực dồn dập
  const DANCE_STYLE_2 = [
    { bodyLean: -0.06, hipShift: -15, headTilt: 0.04, bounceY: -6, leftArm: { x: 115, y: 210, angle: -0.85, trail: 0.3 }, rightArm: { x: 185, y: 225, angle: 0.35, trail: -0.3 }, leftFoot: { x: 140, y: 325, heel: 12 }, rightFoot: { x: 190, y: 335, heel: 0 }, leftKnee: { x: 145, y: 265 }, rightKnee: { x: 185, y: 275 } },
    { bodyLean: 0.0, hipShift: 0, headTilt: 0.0, bounceY: 12, leftArm: { x: 135, y: 220, angle: -0.45, trail: 0.2 }, rightArm: { x: 185, y: 220, angle: 0.45, trail: -0.2 }, leftFoot: { x: 125, y: 335, heel: 0 }, rightFoot: { x: 195, y: 335, heel: 0 }, leftKnee: { x: 135, y: 278 }, rightKnee: { x: 185, y: 278 } },
    { bodyLean: 0.06, hipShift: 15, headTilt: -0.04, bounceY: -8, leftArm: { x: 135, y: 225, angle: -0.35, trail: 0.3 }, rightArm: { x: 205, y: 210, angle: 0.85, trail: -0.3 }, leftFoot: { x: 130, y: 335, heel: 0 }, rightFoot: { x: 180, y: 325, heel: 12 }, leftKnee: { x: 135, y: 275 }, rightKnee: { x: 175, y: 265 } },
    { bodyLean: 0.10, hipShift: 20, headTilt: -0.06, bounceY: 8, leftArm: { x: 140, y: 215, angle: -0.25, trail: 0.2 }, rightArm: { x: 215, y: 195, angle: 1.10, trail: 0.4 }, leftFoot: { x: 125, y: 335, heel: 0 }, rightFoot: { x: 205, y: 335, heel: 4 }, leftKnee: { x: 130, y: 275 }, rightKnee: { x: 195, y: 272 } },
    { bodyLean: 0.04, hipShift: 12, headTilt: -0.02, bounceY: -10, leftArm: { x: 125, y: 195, angle: -0.65, trail: -0.3 }, rightArm: { x: 200, y: 180, angle: 1.25, trail: 0.5 }, leftFoot: { x: 135, y: 322, heel: 14 }, rightFoot: { x: 210, y: 335, heel: 0 }, leftKnee: { x: 140, y: 262 }, rightKnee: { x: 200, y: 275 } },
    { bodyLean: -0.04, hipShift: -6, headTilt: 0.03, bounceY: 6, leftArm: { x: 110, y: 185, angle: -0.95, trail: -0.4 }, rightArm: { x: 180, y: 200, angle: 0.75, trail: -0.3 }, leftFoot: { x: 128, y: 335, heel: 0 }, rightFoot: { x: 195, y: 335, heel: 0 }, leftKnee: { x: 132, y: 275 }, rightKnee: { x: 188, y: 275 } },
    { bodyLean: -0.08, hipShift: -16, headTilt: 0.05, bounceY: -6, leftArm: { x: 105, y: 180, angle: -1.15, trail: -0.5 }, rightArm: { x: 165, y: 215, angle: 0.35, trail: -0.2 }, leftFoot: { x: 120, y: 335, heel: 0 }, rightFoot: { x: 185, y: 325, heel: 10 }, leftKnee: { x: 125, y: 275 }, rightKnee: { x: 180, y: 268 } },
    { bodyLean: -0.06, hipShift: -12, headTilt: 0.04, bounceY: 10, leftArm: { x: 120, y: 205, angle: -0.75, trail: 0.3 }, rightArm: { x: 180, y: 220, angle: 0.45, trail: 0.1 }, leftFoot: { x: 122, y: 335, heel: 2 }, rightFoot: { x: 192, y: 335, heel: 2 }, leftKnee: { x: 130, y: 276 }, rightKnee: { x: 185, y: 276 } },
    { bodyLean: 0.04, hipShift: 8, headTilt: -0.03, bounceY: -8, leftArm: { x: 145, y: 215, angle: -0.25, trail: 0.3 }, rightArm: { x: 215, y: 205, angle: 0.95, trail: 0.4 }, leftFoot: { x: 138, y: 325, heel: 12 }, rightFoot: { x: 198, y: 335, heel: 0 }, leftKnee: { x: 142, y: 265 }, rightKnee: { x: 190, y: 275 } },
    { bodyLean: 0.08, hipShift: 16, headTilt: -0.05, bounceY: 4, leftArm: { x: 155, y: 200, angle: 0.10, trail: 0.4 }, rightArm: { x: 220, y: 190, angle: 1.15, trail: 0.5 }, leftFoot: { x: 132, y: 335, heel: 0 }, rightFoot: { x: 205, y: 335, heel: 0 }, leftKnee: { x: 136, y: 275 }, rightKnee: { x: 195, y: 275 } },
    { bodyLean: 0.05, hipShift: 12, headTilt: -0.03, bounceY: -10, leftArm: { x: 140, y: 185, angle: -0.45, trail: -0.3 }, rightArm: { x: 210, y: 175, angle: 1.35, trail: 0.6 }, leftFoot: { x: 140, y: 322, heel: 14 }, rightFoot: { x: 200, y: 335, heel: 0 }, leftKnee: { x: 145, y: 262 }, rightKnee: { x: 192, y: 275 } },
    { bodyLean: -0.03, hipShift: -6, headTilt: 0.02, bounceY: 6, leftArm: { x: 120, y: 195, angle: -0.85, trail: -0.4 }, rightArm: { x: 190, y: 195, angle: 0.75, trail: -0.3 }, leftFoot: { x: 125, y: 335, heel: 0 }, rightFoot: { x: 195, y: 335, heel: 0 }, leftKnee: { x: 130, y: 275 }, rightKnee: { x: 185, y: 275 } },
    { bodyLean: -0.07, hipShift: -14, headTilt: 0.05, bounceY: -6, leftArm: { x: 110, y: 185, angle: -1.05, trail: -0.5 }, rightArm: { x: 175, y: 210, angle: 0.45, trail: -0.2 }, leftFoot: { x: 120, y: 335, heel: 0 }, rightFoot: { x: 185, y: 325, heel: 10 }, leftKnee: { x: 125, y: 275 }, rightKnee: { x: 180, y: 268 } },
    { bodyLean: -0.02, hipShift: -4, headTilt: 0.01, bounceY: 8, leftArm: { x: 125, y: 205, angle: -0.65, trail: 0.2 }, rightArm: { x: 185, y: 215, angle: 0.55, trail: 0.1 }, leftFoot: { x: 124, y: 335, heel: 2 }, rightFoot: { x: 194, y: 335, heel: 2 }, leftKnee: { x: 132, y: 276 }, rightKnee: { x: 186, y: 276 } }
  ];

  // STYLE 3: Hands Up In The Air & Party Hype (Hai Tay Giơ Cao Quẩy & Nhảy Bật)
  // Đặc trưng: Cả 2 tay giơ vút lên trời tạo chữ V / quét gạt qua lại trên đỉnh đầu, nhảy tưng bừng ăn mừng
  const DANCE_STYLE_3 = [
    { bodyLean: -0.05, hipShift: 6, headTilt: -0.06, bounceY: -12, leftArm: { x: 95, y: 75, angle: -1.35, trail: -0.4 }, rightArm: { x: 155, y: 65, angle: -0.85, trail: -0.4 }, leftFoot: { x: 120, y: 328, heel: 10 }, rightFoot: { x: 195, y: 328, heel: 10 }, leftKnee: { x: 125, y: 268 }, rightKnee: { x: 190, y: 268 } },
    { bodyLean: -0.08, hipShift: 10, headTilt: -0.08, bounceY: -4, leftArm: { x: 88, y: 68, angle: -1.45, trail: -0.6 }, rightArm: { x: 145, y: 58, angle: -0.95, trail: -0.6 }, leftFoot: { x: 118, y: 335, heel: 4 }, rightFoot: { x: 198, y: 335, heel: 6 }, leftKnee: { x: 122, y: 272 }, rightKnee: { x: 188, y: 272 } },
    { bodyLean: -0.04, hipShift: 6, headTilt: -0.04, bounceY: 8, leftArm: { x: 105, y: 92, angle: -1.15, trail: 0.3 }, rightArm: { x: 165, y: 82, angle: -0.65, trail: 0.3 }, leftFoot: { x: 122, y: 335, heel: 0 }, rightFoot: { x: 194, y: 335, heel: 0 }, leftKnee: { x: 128, y: 276 }, rightKnee: { x: 186, y: 276 } },
    { bodyLean: 0.0, hipShift: 0, headTilt: 0.0, bounceY: 14, leftArm: { x: 125, y: 110, angle: -0.85, trail: 0.4 }, rightArm: { x: 195, y: 110, angle: 0.85, trail: -0.4 }, leftFoot: { x: 125, y: 335, heel: 0 }, rightFoot: { x: 195, y: 335, heel: 0 }, leftKnee: { x: 135, y: 278 }, rightKnee: { x: 185, y: 278 } },
    { bodyLean: 0.05, hipShift: -6, headTilt: 0.06, bounceY: -12, leftArm: { x: 165, y: 65, angle: 0.85, trail: 0.4 }, rightArm: { x: 225, y: 75, angle: 1.35, trail: 0.4 }, leftFoot: { x: 125, y: 328, heel: 10 }, rightFoot: { x: 200, y: 328, heel: 10 }, leftKnee: { x: 130, y: 268 }, rightKnee: { x: 195, y: 268 } },
    { bodyLean: 0.08, hipShift: -10, headTilt: 0.08, bounceY: -4, leftArm: { x: 175, y: 58, angle: 0.95, trail: 0.6 }, rightArm: { x: 232, y: 68, angle: 1.45, trail: 0.6 }, leftFoot: { x: 122, y: 335, heel: 6 }, rightFoot: { x: 202, y: 335, heel: 4 }, leftKnee: { x: 132, y: 272 }, rightKnee: { x: 198, y: 272 } },
    { bodyLean: 0.04, hipShift: -6, headTilt: 0.04, bounceY: 8, leftArm: { x: 155, y: 82, angle: 0.65, trail: -0.3 }, rightArm: { x: 215, y: 92, angle: 1.15, trail: -0.3 }, leftFoot: { x: 124, y: 335, heel: 0 }, rightFoot: { x: 198, y: 335, heel: 0 }, leftKnee: { x: 134, y: 276 }, rightKnee: { x: 192, y: 276 } },
    { bodyLean: 0.0, hipShift: 0, headTilt: 0.0, bounceY: 14, leftArm: { x: 125, y: 110, angle: -0.85, trail: -0.4 }, rightArm: { x: 195, y: 110, angle: 0.85, trail: 0.4 }, leftFoot: { x: 125, y: 335, heel: 0 }, rightFoot: { x: 195, y: 335, heel: 0 }, leftKnee: { x: 135, y: 278 }, rightKnee: { x: 185, y: 278 } },
    { bodyLean: -0.06, hipShift: 8, headTilt: -0.07, bounceY: -14, leftArm: { x: 85, y: 60, angle: -1.50, trail: -0.5 }, rightArm: { x: 150, y: 55, angle: -0.90, trail: -0.5 }, leftFoot: { x: 118, y: 326, heel: 12 }, rightFoot: { x: 196, y: 326, heel: 12 }, leftKnee: { x: 122, y: 266 }, rightKnee: { x: 188, y: 266 } },
    { bodyLean: -0.08, hipShift: 10, headTilt: -0.09, bounceY: -6, leftArm: { x: 82, y: 65, angle: -1.45, trail: -0.7 }, rightArm: { x: 142, y: 60, angle: -0.95, trail: -0.7 }, leftFoot: { x: 116, y: 335, heel: 6 }, rightFoot: { x: 200, y: 335, heel: 6 }, leftKnee: { x: 120, y: 272 }, rightKnee: { x: 190, y: 272 } },
    { bodyLean: -0.02, hipShift: 4, headTilt: -0.03, bounceY: 8, leftArm: { x: 110, y: 95, angle: -1.05, trail: 0.3 }, rightArm: { x: 170, y: 90, angle: -0.55, trail: 0.3 }, leftFoot: { x: 122, y: 335, heel: 0 }, rightFoot: { x: 196, y: 335, heel: 0 }, leftKnee: { x: 128, y: 276 }, rightKnee: { x: 188, y: 276 } },
    { bodyLean: 0.04, hipShift: -6, headTilt: 0.05, bounceY: -14, leftArm: { x: 170, y: 55, angle: 0.90, trail: 0.5 }, rightArm: { x: 235, y: 60, angle: 1.50, trail: 0.5 }, leftFoot: { x: 124, y: 326, heel: 12 }, rightFoot: { x: 202, y: 326, heel: 12 }, leftKnee: { x: 132, y: 266 }, rightKnee: { x: 198, y: 266 } },
    { bodyLean: 0.08, hipShift: -10, headTilt: 0.09, bounceY: -6, leftArm: { x: 178, y: 60, angle: 0.95, trail: 0.7 }, rightArm: { x: 238, y: 65, angle: 1.45, trail: 0.7 }, leftFoot: { x: 120, y: 335, heel: 6 }, rightFoot: { x: 204, y: 335, heel: 6 }, leftKnee: { x: 130, y: 272 }, rightKnee: { x: 200, y: 272 } },
    { bodyLean: 0.02, hipShift: -4, headTilt: 0.03, bounceY: 8, leftArm: { x: 150, y: 90, angle: 0.55, trail: -0.3 }, rightArm: { x: 210, y: 95, angle: 1.05, trail: -0.3 }, leftFoot: { x: 124, y: 335, heel: 0 }, rightFoot: { x: 198, y: 335, heel: 0 }, leftKnee: { x: 132, y: 276 }, rightKnee: { x: 192, y: 276 } }
  ];

  const DANCE_STYLES = {
    style1: DANCE_STYLE_1,
    style2: DANCE_STYLE_2,
    style3: DANCE_STYLE_3
  };

  // Render Male Character Frame for given Dance Style & Tier
  function renderMaleFrame(ctx, frameIdx, tier, styleKey = 'style1') {
    const pal = PALETTES.male;
    const tpal = pal[tier] || pal.regular;

    const stylePoses = DANCE_STYLES[styleKey] || DANCE_STYLE_1;
    const f = frameIdx % TOTAL_FRAMES;
    const pose = stylePoses[f];

    ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);

    // Floor Contact Shadow
    ctx.save();
    ctx.beginPath();
    const shadowStretch = Math.max(0.65, 1 - (pose.bounceY / 80));
    ctx.ellipse(160 + pose.hipShift * 0.3, 342, 68 * shadowStretch, 16 * shadowStretch, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.48 * shadowStretch})`;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(160, 190 + pose.bounceY);
    ctx.rotate(pose.bodyLean);

    // ==========================================
    // BACK CAPE (TOP 1 IMPERIAL DRAGON CAPE)
    // ==========================================
    if (tier === 'top1') {
      ctx.save();
      const capeWave = Math.sin(f * 0.55) * 18 - pose.bodyLean * 45;
      ctx.beginPath();
      ctx.moveTo(-36, -42);
      ctx.quadraticCurveTo(-75 + capeWave, 40, -60 + capeWave * 1.4, 115);
      ctx.lineTo(60 + capeWave * 1.4, 115);
      ctx.quadraticCurveTo(75 + capeWave, 40, 36, -42);
      ctx.closePath();

      const capeGrad = ctx.createLinearGradient(0, -42, 0, 115);
      capeGrad.addColorStop(0, '#ffd700');
      capeGrad.addColorStop(0.3, '#f59e0b');
      capeGrad.addColorStop(0.7, '#78350f');
      capeGrad.addColorStop(1, '#451a03');
      ctx.fillStyle = capeGrad;
      ctx.fill();
      ctx.strokeStyle = '#fffbe6';
      ctx.lineWidth = 3;
      ctx.stroke();

      [-60 + capeWave * 1.4, 60 + capeWave * 1.4].forEach(cx => {
        drawSparkle(ctx, cx, 115, 6, '#ffffff', '#ffd700');
      });
      ctx.restore();
    }

    // ==========================================
    // LEGS & DANCE PANTS
    // ==========================================
    ctx.save();
    ctx.translate(-160, -190);

    // Left Leg
    ctx.beginPath();
    ctx.moveTo(145 + pose.hipShift * 0.4, 215);
    ctx.quadraticCurveTo(pose.leftKnee.x, pose.leftKnee.y, pose.leftFoot.x, pose.leftFoot.y - 12 - pose.leftFoot.heel);
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.strokeStyle = tpal.pants;
    ctx.stroke();

    // Right Leg
    ctx.beginPath();
    ctx.moveTo(175 + pose.hipShift * 0.4, 215);
    ctx.quadraticCurveTo(pose.rightKnee.x, pose.rightKnee.y, pose.rightFoot.x, pose.rightFoot.y - 12 - pose.rightFoot.heel);
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.strokeStyle = tpal.pants;
    ctx.stroke();

    // Neon stripes along legs
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = tpal.trim;
    ctx.beginPath();
    ctx.moveTo(148 + pose.hipShift * 0.4, 218);
    ctx.lineTo(pose.leftKnee.x, pose.leftKnee.y);
    ctx.moveTo(172 + pose.hipShift * 0.4, 218);
    ctx.lineTo(pose.rightKnee.x, pose.rightKnee.y);
    ctx.stroke();

    // Shoes
    [pose.leftFoot, pose.rightFoot].forEach((foot, idx) => {
      ctx.save();
      ctx.translate(foot.x, foot.y - foot.heel);
      if (foot.heel > 0) ctx.rotate(idx === 0 ? 0.15 : -0.15);

      ctx.beginPath();
      ctx.roundRect(-15, -14, 30, 16, [6, 6, 4, 4]);
      ctx.fillStyle = tpal.shoes;
      ctx.fill();

      // Glowing LED Soles
      ctx.fillStyle = tpal.shoeTrim;
      ctx.shadowColor = tpal.shoeTrim;
      ctx.shadowBlur = 10;
      ctx.fillRect(-15, 0, 30, 4);

      // Sneaker details
      ctx.strokeStyle = tpal.trim2 || '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, -10); ctx.lineTo(8, -10);
      ctx.moveTo(-6, -6);  ctx.lineTo(6, -6);
      ctx.stroke();
      ctx.restore();
    });

    ctx.restore(); // Restore leg space

    // ==========================================
    // TORSO & UNIFORM
    // ==========================================
    const torsoX = pose.hipShift * 0.5;
    const torsoY = 0;

    ctx.save();
    ctx.translate(torsoX, torsoY);

    ctx.beginPath();
    ctx.moveTo(-33, -46);
    ctx.lineTo(33, -46);
    ctx.lineTo(24, 28);
    ctx.lineTo(-24, 28);
    ctx.closePath();
    ctx.fillStyle = tpal.jacket;
    ctx.fill();

    // Inner Shirt / Armor
    ctx.beginPath();
    ctx.moveTo(-16, -46);
    ctx.lineTo(16, -46);
    ctx.lineTo(12, 10);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fillStyle = tpal.armor || '#09090b';
    ctx.fill();

    // Regular Tier Club Graphics
    if (tier === 'regular') {
      ctx.strokeStyle = tpal.trim;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-24, -22); ctx.lineTo(0, 0); ctx.lineTo(24, -22);
      ctx.stroke();

      ctx.strokeStyle = tpal.trim2;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-20, -12); ctx.lineTo(0, 8); ctx.lineTo(20, -12);
      ctx.stroke();
    }
    // Top 3 Bronze Armor
    else if (tier === 'top3') {
      ctx.fillStyle = tpal.armor;
      ctx.beginPath();
      ctx.roundRect(-22, -34, 44, 38, 6);
      ctx.fill();
      ctx.strokeStyle = tpal.trim;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, -15, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8800';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 14;
      ctx.fill();
      drawSparkle(ctx, 0, -15, 7, '#ffffff', '#ffaa00');
    }
    // Top 2 Silver Cyber Trenchcoat
    else if (tier === 'top2') {
      ctx.fillStyle = tpal.armor;
      ctx.beginPath();
      ctx.roundRect(-25, -40, 50, 46, 5);
      ctx.fill();

      ctx.strokeStyle = tpal.trim;
      ctx.lineWidth = 3;
      ctx.shadowColor = tpal.trim;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(-17, -46); ctx.lineTo(-13, 20);
      ctx.moveTo(17, -46);  ctx.lineTo(13, 20);
      ctx.stroke();

      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(-12, -22, 24, 6);
    }
    // Top 1 Imperial Gold Dragon Coat
    else if (tier === 'top1') {
      const goldGrad = ctx.createLinearGradient(-30, -45, 30, 20);
      goldGrad.addColorStop(0, '#fffbe6');
      goldGrad.addColorStop(0.35, '#ffd700');
      goldGrad.addColorStop(0.7, '#f59e0b');
      goldGrad.addColorStop(1, '#b45309');
      ctx.fillStyle = goldGrad;
      ctx.beginPath();
      ctx.roundRect(-27, -42, 54, 50, 6);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;

      drawSparkle(ctx, 0, -16, 13, '#ffffff', '#ffd700');
      ctx.beginPath();
      ctx.arc(0, -16, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0055';
      ctx.fill();

      [-36, 24].forEach(px => {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.roundRect(px, -52, 14, 14, 4);
        ctx.fill();
        ctx.strokeStyle = '#fffbe6';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Rave Belt
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-25, 24, 50, 7);
    ctx.fillStyle = tpal.trim;
    ctx.fillRect(-7, 23, 14, 9);

    ctx.restore(); // Restore Torso

    // ==========================================
    // HEAD, HAIR & EXPRESSIVE ANIME FACE
    // ==========================================
    ctx.save();
    ctx.translate(torsoX, -62);
    ctx.rotate(pose.headTilt);

    // Neck
    ctx.fillStyle = pal.skin.shadow;
    ctx.fillRect(-7, 2, 14, 16);

    // Face / Head Base
    ctx.beginPath();
    ctx.ellipse(0, -6, 19, 23, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();

    // Chin taper
    ctx.beginPath();
    ctx.moveTo(-16, -6);
    ctx.quadraticCurveTo(0, 19, 16, -6);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();

    // Anime Eyes
    const eyeLookX = pose.bodyLean < -0.05 ? -3 : (pose.bodyLean > 0.05 ? 3 : 0);
    [-8, 8].forEach(ex => {
      ctx.beginPath();
      ctx.moveTo(ex - 5, -9);
      ctx.quadraticCurveTo(ex, -13, ex + 5, -9);
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ex + eyeLookX, -8, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = '#06b6d4';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ex + eyeLookX + 1, -9, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });

    // Eyebrows
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-13, -15); ctx.lineTo(-4, -13);
    ctx.moveTo(13, -15);  ctx.lineTo(4, -13);
    ctx.stroke();

    // Confident Smirk
    ctx.beginPath();
    ctx.arc(1, 3, 5, 0.1, Math.PI - 0.2);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cyber Cheek Decal
    ctx.fillStyle = tpal.trim;
    ctx.fillRect(11, -3, 5, 2.5);

    // 3D Anime Undercut Spiky Hair
    const hairSway = -pose.bodyLean * 15;
    ctx.fillStyle = pal.hair.base;
    ctx.beginPath();
    ctx.moveTo(-21, -8);
    ctx.lineTo(-25 + hairSway, -28);
    ctx.lineTo(-14 + hairSway, -37);
    ctx.lineTo(-2 + hairSway, -42);
    ctx.lineTo(13 + hairSway, -39);
    ctx.lineTo(25 + hairSway, -30);
    ctx.lineTo(21, -8);
    ctx.lineTo(17, -12);
    ctx.lineTo(12 + hairSway * 0.5, -24);
    ctx.lineTo(2 + hairSway * 0.5, -28);
    ctx.lineTo(-9 + hairSway * 0.5, -26);
    ctx.lineTo(-17, -14);
    ctx.closePath();
    ctx.fill();

    // Hair Highlight Streaks
    ctx.strokeStyle = pal.hair.highlight;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-13 + hairSway, -32);
    ctx.lineTo(-2 + hairSway, -38);
    ctx.lineTo(8 + hairSway, -34);
    ctx.stroke();

    ctx.restore(); // Restore Head

    // ==========================================
    // ARMS & LIGHTSTICKS
    // ==========================================
    ctx.save();
    ctx.translate(-160, -190);

    const shoulderL = { x: 130 + torsoX, y: 155 };
    const shoulderR = { x: 190 + torsoX, y: 155 };

    // Left Arm
    ctx.beginPath();
    ctx.moveTo(shoulderL.x, shoulderL.y);
    ctx.quadraticCurveTo(
      (shoulderL.x + pose.leftArm.x) / 2 - 10,
      (shoulderL.y + pose.leftArm.y) / 2,
      pose.leftArm.x,
      pose.leftArm.y
    );
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = tpal.jacket;
    ctx.stroke();

    // Left Hand
    ctx.beginPath();
    ctx.arc(pose.leftArm.x, pose.leftArm.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();

    drawLightstick(
      ctx,
      pose.leftArm.x,
      pose.leftArm.y,
      pose.leftArm.angle,
      tpal.lightstick,
      tpal.lightstickGlow,
      56,
      tier,
      pose.leftArm.trail
    );

    // Right Arm
    ctx.beginPath();
    ctx.moveTo(shoulderR.x, shoulderR.y);
    ctx.quadraticCurveTo(
      (shoulderR.x + pose.rightArm.x) / 2 + 10,
      (shoulderR.y + pose.rightArm.y) / 2,
      pose.rightArm.x,
      pose.rightArm.y
    );
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = tpal.jacket;
    ctx.stroke();

    // Right Hand
    ctx.beginPath();
    ctx.arc(pose.rightArm.x, pose.rightArm.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();

    drawLightstick(
      ctx,
      pose.rightArm.x,
      pose.rightArm.y,
      pose.rightArm.angle,
      tpal.lightstick,
      tpal.lightstickGlow,
      56,
      tier,
      pose.rightArm.trail
    );

    ctx.restore(); // Restore Arms

    ctx.restore(); // Restore main transform
  }

  // Render Female Character Frame for given Dance Style & Tier
  function renderFemaleFrame(ctx, frameIdx, tier, styleKey = 'style1') {
    const pal = PALETTES.female;
    const tpal = pal[tier] || pal.regular;

    const stylePoses = DANCE_STYLES[styleKey] || DANCE_STYLE_1;
    const f = frameIdx % TOTAL_FRAMES;
    const pose = stylePoses[f];

    ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);

    // Floor Contact Shadow
    ctx.save();
    ctx.beginPath();
    const shadowStretch = Math.max(0.65, 1 - (pose.bounceY / 80));
    ctx.ellipse(160 + pose.hipShift * 0.3, 342, 60 * shadowStretch, 14 * shadowStretch, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.48 * shadowStretch})`;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(160, 190 + pose.bounceY);
    ctx.rotate(pose.bodyLean);

    // ==========================================
    // FLAMBOYANT TWIN-TAILS / PONYTAIL (INERTIA)
    // ==========================================
    ctx.save();
    const hairLag = -pose.bodyLean * 25;
    const hairWave = Math.sin(f * 0.55) * 14;

    // Left Twin-Tail
    ctx.beginPath();
    ctx.moveTo(-18, -75);
    ctx.quadraticCurveTo(-55 + hairLag - hairWave, -40, -46 + hairLag * 1.5, 35);
    ctx.quadraticCurveTo(-32, -18, -14, -65);
    ctx.fillStyle = pal.hair.base;
    ctx.fill();

    // Right Twin-Tail
    ctx.beginPath();
    ctx.moveTo(18, -75);
    ctx.quadraticCurveTo(55 + hairLag - hairWave, -40, 46 + hairLag * 1.5, 35);
    ctx.quadraticCurveTo(32, -18, 14, -65);
    ctx.fillStyle = pal.hair.base;
    ctx.fill();
    ctx.restore();

    // ==========================================
    // TOP 1 CELESTIAL RIBBON (HAGOROMO)
    // ==========================================
    if (tier === 'top1') {
      ctx.save();
      const ribbonWave = Math.sin(f * 0.55) * 22 - pose.bodyLean * 40;
      ctx.beginPath();
      ctx.moveTo(-52, 45);
      ctx.quadraticCurveTo(-78 + ribbonWave, -30, 0, -95);
      ctx.quadraticCurveTo(78 + ribbonWave, -30, 52, 45);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.75)';
      ctx.lineWidth = 15;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();

      drawSparkle(ctx, 0, -95, 8, '#ffffff', '#ffd700');
      ctx.restore();
    }

    // ==========================================
    // LEGS & DANCE BOOTS
    // ==========================================
    ctx.save();
    ctx.translate(-160, -190);

    // Left Leg
    ctx.beginPath();
    ctx.moveTo(148 + pose.hipShift * 0.4, 215);
    ctx.quadraticCurveTo(pose.leftKnee.x, pose.leftKnee.y, pose.leftFoot.x, pose.leftFoot.y - 14 - pose.leftFoot.heel);
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.strokeStyle = pal.skin.base;
    ctx.stroke();

    // Right Leg
    ctx.beginPath();
    ctx.moveTo(172 + pose.hipShift * 0.4, 215);
    ctx.quadraticCurveTo(pose.rightKnee.x, pose.rightKnee.y, pose.rightFoot.x, pose.rightFoot.y - 14 - pose.rightFoot.heel);
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.strokeStyle = pal.skin.base;
    ctx.stroke();

    // Thigh-high Boots
    const bootColor = tpal.boots;
    ctx.beginPath();
    ctx.moveTo(pose.leftKnee.x, pose.leftKnee.y - 6);
    ctx.lineTo(pose.leftFoot.x, pose.leftFoot.y - pose.leftFoot.heel);
    ctx.lineWidth = 18;
    ctx.strokeStyle = bootColor;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pose.rightKnee.x, pose.rightKnee.y - 6);
    ctx.lineTo(pose.rightFoot.x, pose.rightFoot.y - pose.rightFoot.heel);
    ctx.lineWidth = 18;
    ctx.strokeStyle = bootColor;
    ctx.stroke();

    // Heels / Platform Soles
    [pose.leftFoot, pose.rightFoot].forEach((foot, idx) => {
      ctx.save();
      ctx.translate(foot.x, foot.y - foot.heel);
      if (foot.heel > 0) ctx.rotate(idx === 0 ? 0.15 : -0.15);

      ctx.beginPath();
      ctx.roundRect(-13, -13, 26, 15, [5, 7, 3, 3]);
      ctx.fillStyle = bootColor;
      ctx.fill();

      // Glowing Neon Sole
      ctx.fillStyle = tpal.bootTrim;
      ctx.shadowColor = tpal.bootTrim;
      ctx.shadowBlur = 10;
      ctx.fillRect(-13, 0, 26, 4);

      ctx.fillStyle = '#09090b';
      ctx.fillRect(-11, 4, 7, 5);
      ctx.restore();
    });

    ctx.restore(); // Restore leg space

    // ==========================================
    // TORSO & CHIC DANCE OUTFIT / SKIRT
    // ==========================================
    const torsoX = pose.hipShift * 0.5;
    const torsoY = 0;

    ctx.save();
    ctx.translate(torsoX, torsoY);

    // Slender Anime Midriff
    ctx.fillStyle = pal.skin.base;
    ctx.beginPath();
    ctx.moveTo(-16, -20);
    ctx.lineTo(16, -20);
    ctx.lineTo(18, 12);
    ctx.lineTo(-18, 12);
    ctx.closePath();
    ctx.fill();

    // Crop Top
    ctx.beginPath();
    ctx.moveTo(-27, -43);
    ctx.lineTo(27, -43);
    ctx.lineTo(19, -14);
    ctx.lineTo(-19, -14);
    ctx.closePath();
    ctx.fillStyle = tpal.top;
    ctx.fill();

    if (tier === 'regular') {
      ctx.strokeStyle = tpal.trim;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-17, -43); ctx.lineTo(0, -26); ctx.lineTo(17, -43);
      ctx.stroke();

      ctx.fillStyle = '#09090b';
      ctx.fillRect(-9, -49, 18, 4);
    } else if (tier === 'top3') {
      ctx.fillStyle = tpal.armor;
      ctx.beginPath();
      ctx.roundRect(-17, -32, 34, 28, 5);
      ctx.fill();
      ctx.strokeStyle = tpal.trim;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, -18, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8800';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 12;
      ctx.fill();
    } else if (tier === 'top2') {
      ctx.fillStyle = tpal.armor;
      ctx.beginPath();
      ctx.roundRect(-21, -39, 42, 34, 5);
      ctx.fill();
      ctx.strokeStyle = tpal.trim;
      ctx.lineWidth = 3;
      ctx.shadowColor = tpal.trim;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (tier === 'top1') {
      const goldGrad = ctx.createLinearGradient(-23, -42, 23, 10);
      goldGrad.addColorStop(0, '#fffbe6');
      goldGrad.addColorStop(0.35, '#ffd700');
      goldGrad.addColorStop(1, '#b45309');
      ctx.fillStyle = goldGrad;
      ctx.beginPath();
      ctx.roundRect(-23, -40, 46, 36, 5);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      drawSparkle(ctx, 0, -22, 11, '#ffffff', '#ffd700');
      ctx.beginPath();
      ctx.arc(0, -22, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0055';
      ctx.fill();
    }

    // Skirt
    ctx.beginPath();
    ctx.moveTo(-21, 10);
    ctx.lineTo(21, 10);
    ctx.lineTo(29, 28);
    ctx.lineTo(-29, 28);
    ctx.closePath();
    ctx.fillStyle = tpal.skirt;
    ctx.fill();

    ctx.strokeStyle = tpal.trim;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-29, 28);
    ctx.lineTo(29, 28);
    ctx.stroke();

    ctx.restore(); // Restore Torso

    // ==========================================
    // HEAD, FACE & FRONT HAIR
    // ==========================================
    ctx.save();
    ctx.translate(torsoX, -60);
    ctx.rotate(pose.headTilt);

    ctx.fillStyle = pal.skin.shadow;
    ctx.fillRect(-5, 4, 10, 14);

    ctx.beginPath();
    ctx.ellipse(0, -4, 17, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();

    // Rosy Blush
    ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-10, 2, 4.5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(10, 2, 4.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sparkling Eyes
    const eyeLookX = pose.bodyLean < -0.05 ? -2.5 : (pose.bodyLean > 0.05 ? 2.5 : 0);
    [-8, 8].forEach(ex => {
      ctx.beginPath();
      ctx.moveTo(ex - 5.5, -8);
      ctx.quadraticCurveTo(ex, -13, ex + 5.5, -8);
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(ex + eyeLookX, -6, 3.8, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ec4899';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ex + eyeLookX + 1.2, -8, 1.4, 0, Math.PI * 2);
      ctx.arc(ex + eyeLookX - 1.2, -5, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });

    // Party Smile
    ctx.beginPath();
    ctx.arc(0, 5, 4.5, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bangs
    ctx.fillStyle = pal.hair.base;
    ctx.beginPath();
    ctx.moveTo(-18, -12);
    ctx.quadraticCurveTo(-12, -27, 0, -29);
    ctx.quadraticCurveTo(12, -27, 18, -12);
    ctx.lineTo(14, -6);
    ctx.lineTo(8, -19);
    ctx.lineTo(0, -14);
    ctx.lineTo(-8, -19);
    ctx.lineTo(-14, -6);
    ctx.closePath();
    ctx.fill();

    ctx.restore(); // Restore Head

    // ==========================================
    // ARMS & LIGHTSTICKS
    // ==========================================
    ctx.save();
    ctx.translate(-160, -190);

    const shoulderL = { x: 134 + torsoX, y: 154 };
    const shoulderR = { x: 186 + torsoX, y: 154 };

    // Left Arm
    ctx.beginPath();
    ctx.moveTo(shoulderL.x, shoulderL.y);
    ctx.quadraticCurveTo(
      (shoulderL.x + pose.leftArm.x) / 2 - 8,
      (shoulderL.y + pose.leftArm.y) / 2,
      pose.leftArm.x,
      pose.leftArm.y
    );
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.strokeStyle = pal.skin.base;
    ctx.stroke();

    // Left Hand
    ctx.beginPath();
    ctx.arc(pose.leftArm.x, pose.leftArm.y, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();

    drawLightstick(
      ctx,
      pose.leftArm.x,
      pose.leftArm.y,
      pose.leftArm.angle,
      tpal.lightstick,
      tpal.lightstickGlow,
      50,
      tier,
      pose.leftArm.trail
    );

    // Right Arm
    ctx.beginPath();
    ctx.moveTo(shoulderR.x, shoulderR.y);
    ctx.quadraticCurveTo(
      (shoulderR.x + pose.rightArm.x) / 2 + 8,
      (shoulderR.y + pose.rightArm.y) / 2,
      pose.rightArm.x,
      pose.rightArm.y
    );
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.strokeStyle = pal.skin.base;
    ctx.stroke();

    // Right Hand
    ctx.beginPath();
    ctx.arc(pose.rightArm.x, pose.rightArm.y, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = pal.skin.base;
    ctx.fill();

    drawLightstick(
      ctx,
      pose.rightArm.x,
      pose.rightArm.y,
      pose.rightArm.angle,
      tpal.lightstick,
      tpal.lightstickGlow,
      50,
      tier,
      pose.rightArm.trail
    );

    ctx.restore(); // Restore Arms

    ctx.restore(); // Restore main transform
  }

  // Pre-render all 336 sprite combinations: 2 Genders x 4 Tiers x 3 Dance Styles x 14 Frames
  function generateSpriteCache(targetCache) {
    const genders = ['male', 'female'];
    const tiers = ['regular', 'top3', 'top2', 'top1'];
    const styles = ['style1', 'style2', 'style3'];

    console.log('[HumanSpriteSystem] Generating 3 Diverse Dance Styles Sprite Cache...');
    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    let count = 0;

    genders.forEach(gender => {
      tiers.forEach(tier => {
        styles.forEach(styleKey => {
          // Both specific style key and default style1 fallback key
          const key = `human_${gender}_${tier}_${styleKey}`;
          targetCache[key] = [];

          // Also set default alias for style1
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
