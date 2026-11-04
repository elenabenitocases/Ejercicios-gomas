/**
 * BIOMECH ENGINE - Motor Gráfico Biomecánico Vectorial 2D (60 FPS)
 * 24 Ejercicios Técnicos con Banda Elástica + Modelos de Atleta Mujer y Hombre
 * Mapeo de activación muscular dinámica (Heatmap incandescente), HUD articular y exportador WebM
 * Diseñado para Elena Benito Cases - Atlas Biomecánico
 */

(function () {
  'use strict';

  // --- CONFIGURACIÓN Y ESTADO GLOBAL ---
  const state = {
    gender: 'female', // 'female' | 'male'
    speed: 1.0,
    isLooping: true,
    activeMasterEx: 1,
    masterIsPlaying: true,
    masterProgress: 0,
    cardPlayers: {}, // { [exId]: { isPlaying, progress, viewMode: 'video'|'svg'|'both', gender } }
    lastTimestamp: performance.now(),
    cycleDurationMs: 6000 // 6 segundos por repetición completa (3s concéntrica, 1s pico isométrico, 2s excéntrica)
  };

  // --- PALETAS DE COLOR ANATÓMICAS Y ATLETAS ---
  function getPalette(gender) {
    const isFem = gender === 'female';
    return {
      isFem,
      skin: isFem ? '#f6c3a5' : '#e8b08d',
      skinShadow: isFem ? '#e0a385' : '#cf9370',
      hair: isFem ? '#381e11' : '#1e293b',
      top: isFem ? '#e11d48' : '#1e3a8a',
      topAccent: isFem ? '#fb7185' : '#3b82f6',
      bottom: isFem ? '#0f172a' : '#334155',
      bottomAccent: isFem ? '#38bdf8' : '#94a3b8',
      shoeBase: '#ffffff',
      shoeSole: '#1e293b',
      shoeAccent: isFem ? '#f43f5e' : '#2563eb',
      band: '#06b6d4',
      bandGlow: 'rgba(6, 182, 212, 0.85)',
      postureLine: '#10b981',
      agonistMin: 'rgb(245, 158, 11)',
      agonistMax: 'rgb(239, 68, 68)',
      synergist: '#f59e0b'
    };
  }

  // --- CÁLCULO DE FASE Y DINÁMICA DE CONTRACCIÓN ---
  function calcKinematics(prog) {
    // 0.00 - 0.45: Fase Concéntrica (aceleración y contracción máxima)
    // 0.45 - 0.60: Pico Isométrico (tensión máxima sostenida)
    // 0.60 - 1.00: Fase Excéntrica (retorno controlado decelerado)
    let tNorm = 0;
    let phase = 'CONCÉNTRICA';
    let phaseColor = '#f59e0b'; // Amber

    if (prog <= 0.45) {
      const t = prog / 0.45;
      // Smoothstep easing
      tNorm = t * t * (3 - 2 * t);
      phase = 'Fase Concéntrica';
      phaseColor = '#f59e0b';
    } else if (prog <= 0.60) {
      tNorm = 1.0;
      phase = 'Pico Isométrico';
      phaseColor = '#ef4444'; // Red hot
    } else {
      const t = (prog - 0.60) / 0.40;
      tNorm = 1.0 - (t * t * (3 - 2 * t));
      phase = 'Fase Excéntrica';
      phaseColor = '#10b981'; // Green control
    }

    return { tNorm, phase, phaseColor };
  }

  // --- DIBUJO DE ELEMENTOS ANATÓMICOS REUTILIZABLES ---
  function drawSneaker(ctx, x, y, angle, length, pal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Suela
    ctx.fillStyle = pal.shoeSole;
    ctx.beginPath();
    ctx.roundRect(-length * 0.25, 1, length * 1.3, 5, 2);
    ctx.fill();
    // Mediasuela amortiguación
    ctx.fillStyle = pal.shoeBase;
    ctx.beginPath();
    ctx.roundRect(-length * 0.2, -3, length * 1.25, 4, 1);
    ctx.fill();
    // Cuerpo zapatilla
    ctx.fillStyle = pal.bottom;
    ctx.beginPath();
    ctx.moveTo(-length * 0.15, -3);
    ctx.lineTo(length * 0.95, -3);
    ctx.lineTo(length * 0.75, -11);
    ctx.lineTo(length * 0.2, -11);
    ctx.lineTo(-length * 0.15, -8);
    ctx.closePath();
    ctx.fill();
    // Acento deportivo
    ctx.fillStyle = pal.shoeAccent;
    ctx.fillRect(length * 0.15, -9, length * 0.35, 3);
    ctx.restore();
  }

  function drawHeadSide(ctx, x, y, radius, facingDir, pal) {
    ctx.save();
    ctx.translate(x, y);

    // Cabello base
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
    ctx.fill();

    // Rostro y cuello
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.arc(facingDir * 2, 2, radius - 1, 0, Math.PI * 2);
    ctx.fill();

    // Perfil facial sutil
    ctx.fillStyle = pal.skinShadow;
    ctx.beginPath();
    ctx.arc(facingDir * (radius - 2), 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Peinado femenino (Coleta deportiva dinámica) vs Masculino (Corte atlético)
    if (pal.isFem) {
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      const px = -facingDir * (radius * 0.7);
      const py = -radius * 0.3;
      ctx.moveTo(px, py);
      ctx.bezierCurveTo(
        px - facingDir * 18, py - 4,
        px - facingDir * 24, py + 18,
        px - facingDir * 28, py + 30
      );
      ctx.quadraticCurveTo(px - facingDir * 16, py + 18, px - facingDir * 4, py + 6);
      ctx.closePath();
      ctx.fill();
      // Coletero
      ctx.fillStyle = pal.shoeAccent;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Corte masculino
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.arc(0, -radius * 0.3, radius + 2.5, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHeadFront(ctx, x, y, radius, pal) {
    ctx.save();
    ctx.translate(x, y);

    // Cabello posterior
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.arc(0, -1, radius + 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Cara
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.ellipse(0, 3, radius * 0.85, radius * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cabello frontal
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.5, radius * 0.9, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (pal.isFem) {
      // Mechones laterales femeninos
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.ellipse(-radius * 0.85, 2, 4, 12, -0.2, 0, Math.PI * 2);
      ctx.ellipse(radius * 0.85, 2, 4, 12, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawElasticBand(ctx, x1, y1, x2, y2, tNorm, baseWidth = 5) {
    ctx.save();
    ctx.strokeStyle = '#06b6d4';
    // La goma se vuelve ligeramente más fina al estirarse por tensión
    ctx.lineWidth = Math.max(2.5, baseWidth - tNorm * 1.5);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(6, 182, 212, 0.85)';
    ctx.shadowBlur = 8 + tNorm * 8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Brillo central de tensión
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawMuscleContraction(ctx, pathCallback, tNorm, label, lx, ly) {
    ctx.save();
    // Brillo incandescente dinámico según activación
    const glowAlpha = 0.45 + tNorm * 0.55;
    const blur = 8 + tNorm * 18;
    ctx.shadowColor = `rgba(239, 68, 68, ${glowAlpha})`;
    ctx.shadowBlur = blur;

    // Gradiente dinámico de calor
    const r = 239;
    const g = Math.round(68 + (1 - tNorm) * 90);
    const b = 68;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

    ctx.beginPath();
    pathCallback(ctx);
    ctx.fill();
    ctx.restore();

    if (label && lx !== undefined && ly !== undefined) {
      ctx.save();
      ctx.fillStyle = '#fee2e2';
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(label, lx, ly);
      ctx.restore();
    }
  }

  // --- CATÁLOGO DE LOS 24 EJERCICIOS CON KINEMÁTICA REAL ---
  const EXERCISES = [
    {
      id: 1,
      name: 'Extensión de Rodilla Terminal (TKE)',
      category: 'piernas',
      target: 'Cuádriceps (Vasto Medial)',
      synergists: 'Glúteo mayor, Gemelos',
      angleName: 'Ángulo Rodilla',
      angleMin: 140,
      angleMax: 180,
      tensionMin: 3.5,
      tensionMax: 12.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.82;
        const anchorX = w * 0.84;
        const postY = groundY - 55;

        // Suelo y poste de anclaje
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.1, groundY, w * 0.8, 6);
        ctx.fillStyle = '#475569';
        ctx.fillRect(anchorX - 4, groundY - 140, 8, 140);

        const hipX = w * 0.42;
        const hipY = groundY - 120;
        const shoulderX = hipX + 4;
        const shoulderY = hipY - 60;
        const footX = hipX + 10;
        const footY = groundY;

        // Rodilla: de 145° flexionada hacia adelante a 180° recta
        const kneeX = hipX + 22 - tNorm * 18;
        const kneeY = groundY - 60;

        // Banda elástica anclada al poste y abrazando la corva/hueco poplíteo
        drawElasticBand(ctx, anchorX, postY, kneeX, kneeY, tNorm, 6);

        // Pierna soporte (trasera recta)
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(hipX - 25, groundY);
        ctx.lineTo(hipX - 10, hipY);
        ctx.stroke();
        drawSneaker(ctx, hipX - 30, groundY - 2, 0, 16, pal);

        // Pierna activa (delantera)
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
        drawSneaker(ctx, footX - 4, groundY - 2, 0, 18, pal);

        // Contracción Vasto Medial (Cuádriceps)
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(kneeX - 4, kneeY - 16, 10 + tNorm * 4, 18, -0.2, 0, Math.PI * 2);
        }, tNorm, 'VASTO MEDIAL', kneeX - 80, kneeY - 20);

        // Torso y cabeza
        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 10, shoulderY, 20, hipY - shoulderY);
        drawHeadSide(ctx, shoulderX + 2, shoulderY - 20, 13, 1, pal);
      }
    },
    {
      id: 2,
      name: 'Sentadilla Frontal con Goma Pisada',
      category: 'piernas',
      target: 'Cuádriceps y Glúteos',
      synergists: 'Core, Aductores',
      angleName: 'Ángulo Rodilla',
      angleMin: 85,
      angleMax: 175,
      tensionMin: 5.0,
      tensionMax: 18.5,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.50;

        // tNorm 0 = abajo en sentadilla, tNorm 1 = arriba de pie
        const hipDrop = (1 - tNorm) * 65;
        const hipX = centerX - (1 - tNorm) * 22;
        const hipY = groundY - 110 + hipDrop;
        const kneeX = centerX + 18 + (1 - tNorm) * 10;
        const kneeY = groundY - 55 + hipDrop * 0.45;
        const footX = centerX;
        const footY = groundY;
        const shoulderX = hipX + 16;
        const shoulderY = hipY - 62;

        // Banda pisada por el pie y sujeta en hombros
        drawElasticBand(ctx, footX, footY, shoulderX, shoulderY + 12, tNorm, 6);

        // Pierna
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
        drawSneaker(ctx, footX - 8, footY - 2, 0, 20, pal);

        // Músculo Cuádriceps (Anterior muslo)
        drawMuscleContraction(ctx, (c) => {
          c.ellipse((hipX + kneeX) / 2 + 5, (hipY + kneeY) / 2, 12 + tNorm * 5, 22, -0.3, 0, Math.PI * 2);
        }, tNorm, 'CUÁDRICEPS', centerX + 30, kneeY - 30);

        // Glúteo mayor
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(hipX - 10, hipY + 6, 14 + tNorm * 3, 12, 0.2, 0, Math.PI * 2);
        }, tNorm);

        // Torso atlético
        ctx.fillStyle = pal.top;
        ctx.beginPath();
        ctx.moveTo(hipX - 8, hipY);
        ctx.lineTo(shoulderX - 10, shoulderY);
        ctx.lineTo(shoulderX + 12, shoulderY);
        ctx.lineTo(hipX + 10, hipY);
        ctx.closePath();
        ctx.fill();

        // Brazos en posición Front Rack
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(shoulderX + 14, shoulderY + 16);
        ctx.lineTo(shoulderX + 2, shoulderY + 12);
        ctx.stroke();

        drawHeadSide(ctx, shoulderX, shoulderY - 20, 13, 1, pal);
      }
    },
    {
      id: 3,
      name: 'Sentadilla Isométrica en Pared (Wall Sit)',
      category: 'piernas',
      target: 'Cuádriceps (Isometría)',
      synergists: 'Glúteo medio, Core',
      angleName: 'Ángulo Rodilla',
      angleMin: 90,
      angleMax: 90,
      tensionMin: 8.0,
      tensionMax: 12.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const wallX = w * 0.32;

        // Pared
        ctx.fillStyle = '#334155';
        ctx.fillRect(wallX - 15, groundY - 180, 15, 180);

        const hipX = wallX + 12;
        const hipY = groundY - 80;
        const kneeX = hipX + 75;
        const kneeY = hipY; // Paralelo 90°
        const footX = kneeX;
        const footY = groundY;
        const shoulderX = hipX + 4;
        const shoulderY = hipY - 65;

        // Miniband entre rodillas con micro-abducción
        drawElasticBand(ctx, kneeX - 8, kneeY, kneeX + 8 + tNorm * 6, kneeY, tNorm, 7);

        // Pierna en escuadra 90°
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
        drawSneaker(ctx, footX - 8, footY - 2, 0, 20, pal);

        // Cuádriceps bajo fuego isométrico
        drawMuscleContraction(ctx, (c) => {
          c.ellipse((hipX + kneeX) / 2, hipY - 10, 28, 12 + tNorm * 3, 0, 0, Math.PI * 2);
        }, tNorm, 'CUÁDRICEPS EN TENSIÓN', kneeX - 40, hipY - 25);

        // Torso apoyado
        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 6, shoulderY, 18, hipY - shoulderY);

        // Línea verde de alineación postural neutra
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wallX + 2, groundY - 150);
        ctx.lineTo(wallX + 2, hipY);
        ctx.stroke();
        ctx.restore();

        drawHeadSide(ctx, shoulderX + 2, shoulderY - 20, 13, 1, pal);
      }
    },
    {
      id: 4,
      name: 'Zancadas / Lunges con Goma Pisada',
      category: 'piernas',
      target: 'Cuádriceps y Glúteo Mayor',
      synergists: 'Isquios, Core',
      angleName: 'Rodilla Delantera',
      angleMin: 90,
      angleMax: 165,
      tensionMin: 4.0,
      tensionMax: 15.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const drop = (1 - tNorm) * 55;

        const frontFootX = w * 0.58;
        const rearFootX = w * 0.28;
        const hipX = w * 0.44;
        const hipY = groundY - 105 + drop;
        const frontKneeX = frontFootX - 8;
        const frontKneeY = groundY - 55 + drop * 0.5;
        const rearKneeX = rearFootX + 25;
        const rearKneeY = groundY - 25 + drop * 0.6;
        const shoulderX = hipX;
        const shoulderY = hipY - 60;

        // Goma pisada por pie delantero
        drawElasticBand(ctx, frontFootX, groundY, shoulderX + 10, shoulderY + 15, tNorm, 5);

        // Pierna trasera
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(hipX - 4, hipY);
        ctx.lineTo(rearKneeX, rearKneeY);
        ctx.lineTo(rearFootX, groundY);
        ctx.stroke();
        drawSneaker(ctx, rearFootX - 4, groundY - 2, 0.4, 16, pal);

        // Pierna delantera
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(frontKneeX, frontKneeY);
        ctx.lineTo(frontFootX, groundY);
        ctx.stroke();
        drawSneaker(ctx, frontFootX - 6, groundY - 2, 0, 18, pal);

        // Cuádriceps delantero
        drawMuscleContraction(ctx, (c) => {
          c.ellipse((hipX + frontKneeX) / 2 + 4, (hipY + frontKneeY) / 2, 12 + tNorm * 4, 18, -0.4, 0, Math.PI * 2);
        }, tNorm, 'CUÁDRICEPS UNILATERAL', frontFootX + 15, frontKneeY - 15);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 8, shoulderY, 18, hipY - shoulderY);
        drawHeadSide(ctx, shoulderX + 2, shoulderY - 20, 13, 1, pal);
      }
    },
    {
      id: 5,
      name: 'Curl Femoral con Goma (Prono / Suelo)',
      category: 'piernas',
      target: 'Isquiotibiales (Bíceps Femoral)',
      synergists: 'Gastrocnemio, Glúteos',
      angleName: 'Flexión Rodilla',
      angleMin: 175,
      angleMax: 60,
      tensionMin: 3.0,
      tensionMax: 14.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.76;
        const anchorX = w * 0.88;

        // Esterilla
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.12, groundY, w * 0.74, 8);

        const headX = w * 0.24;
        const headY = groundY - 14;
        const shoulderX = w * 0.33;
        const hipX = w * 0.52;
        const kneeX = w * 0.68;
        const tibiaLen = w * 0.15;
        // Ángulo de flexión hacia arriba
        const angleRad = 0.08 + tNorm * 1.85;
        const ankleX = kneeX - Math.cos(angleRad) * tibiaLen;
        const ankleY = groundY - 8 - Math.sin(angleRad) * tibiaLen;

        // Banda elástica del anclaje al tobillo
        drawElasticBand(ctx, anchorX, groundY - 4, ankleX, ankleY, tNorm, 5);

        // Pierna base en suelo
        ctx.fillStyle = '#334155';
        ctx.fillRect(hipX, groundY - 6, w * 0.28, 7);
        drawSneaker(ctx, w * 0.80, groundY - 2, 0, 16, pal);

        // Torso prono
        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 4, groundY - 14, hipX - shoulderX + 8, 12);
        drawHeadSide(ctx, headX, headY, 12, 1, pal);

        // Isquiotibiales (Posterior muslo en contracción)
        drawMuscleContraction(ctx, (c) => {
          const midX = (hipX + kneeX) / 2;
          const midY = (groundY - 12) - (8 + tNorm * 10);
          c.moveTo(hipX, groundY - 8);
          c.quadraticCurveTo(midX, midY, kneeX, groundY - 8);
          c.lineTo(hipX, groundY - 2);
          c.closePath();
        }, tNorm, 'ISQUIOTIBIALES', (hipX + kneeX) / 2 - 40, groundY - 28);

        // Pierna activa
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(kneeX, groundY - 8);
        ctx.lineTo(ankleX, ankleY);
        ctx.stroke();
        drawSneaker(ctx, ankleX, ankleY, angleRad - 1.2, 18, pal);
      }
    },
    {
      id: 6,
      name: 'Pasos Laterales con Miniband (Monster Walk)',
      category: 'piernas',
      target: 'Glúteo Medio y Mínimo',
      synergists: 'Tensor Fascia Lata, Cuádriceps',
      angleName: 'Abducción Cadera',
      angleMin: 15,
      angleMax: 45,
      tensionMin: 4.5,
      tensionMax: 16.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.50;
        const leftFootX = centerX - 55;
        const rightFootX = centerX + 25 + tNorm * 65;
        const kneeY = h * 0.66;
        const hipY = h * 0.48;

        // Miniband entre rodillas
        drawElasticBand(ctx, centerX - 38, kneeY + 10, centerX + 18 + tNorm * 48, kneeY + 10, tNorm, 8);

        // Piernas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(centerX - 16, hipY);
        ctx.lineTo(centerX - 38, kneeY);
        ctx.lineTo(leftFootX, groundY);
        ctx.moveTo(centerX + 16, hipY);
        ctx.lineTo(centerX + 18 + tNorm * 48, kneeY);
        ctx.lineTo(rightFootX, groundY);
        ctx.stroke();

        drawSneaker(ctx, leftFootX - 8, groundY - 2, 0, 18, pal);
        drawSneaker(ctx, rightFootX - 8, groundY - 2, 0, 18, pal);

        // Glúteo medio (Abductor en pico)
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(centerX + 22, hipY + 2, 16 + tNorm * 4, 13, 0.3, 0, Math.PI * 2);
        }, tNorm, 'GLÚTEO MEDIO', centerX + 40, hipY - 10);

        // Torso frontal
        ctx.fillStyle = pal.top;
        ctx.fillRect(centerX - 20, h * 0.30, 40, hipY - h * 0.30);
        drawHeadFront(ctx, centerX, h * 0.22, 14, pal);
      }
    },
    {
      id: 7,
      name: 'Puente de Glúteo / Hip Thrust con Banda',
      category: 'piernas',
      target: 'Glúteo Mayor (Extensión)',
      synergists: 'Isquios, Erectores Espinales',
      angleName: 'Extensión Cadera',
      angleMin: 100,
      angleMax: 180,
      tensionMin: 6.0,
      tensionMax: 20.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.78;
        const shoulderX = w * 0.28;
        const feetX = w * 0.68;

        // tNorm 0 = cadera en suelo, tNorm 1 = cadera elevada en puente completo
        const hipY = groundY - 10 - tNorm * 52;
        const hipX = w * 0.48;

        // Banda transversal en caderas anclada
        drawElasticBand(ctx, hipX - 18, groundY, hipX, hipY, tNorm, 7);
        drawElasticBand(ctx, hipX, hipY, hipX + 18, groundY, tNorm, 7);

        // Muslo y pantorrilla
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(shoulderX, groundY - 10);
        ctx.lineTo(hipX, hipY);
        ctx.lineTo(feetX - 10, hipY + 15);
        ctx.lineTo(feetX, groundY);
        ctx.stroke();
        drawSneaker(ctx, feetX - 4, groundY - 2, 0, 18, pal);

        // Glúteo Mayor
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(hipX - 8, hipY + 4, 18 + tNorm * 5, 14, -0.2, 0, Math.PI * 2);
        }, tNorm, 'GLÚTEO MAYOR', hipX - 45, hipY - 20);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.beginPath();
        ctx.moveTo(shoulderX - 4, groundY - 14);
        ctx.lineTo(hipX, hipY);
        ctx.lineTo(hipX - 10, hipY + 8);
        ctx.lineTo(shoulderX - 4, groundY - 6);
        ctx.closePath();
        ctx.fill();

        drawHeadSide(ctx, shoulderX - 18, groundY - 14, 12, -1, pal);
      }
    },
    {
      id: 8,
      name: 'Peso Muerto Rumano con Banda (RDL)',
      category: 'piernas',
      target: 'Isquiotibiales y Cadena Posterior',
      synergists: 'Glúteos, Erectores Lumbares',
      angleName: 'Bisagra de Cadera',
      angleMin: 80,
      angleMax: 175,
      tensionMin: 5.5,
      tensionMax: 19.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const feetX = w * 0.50;

        // tNorm 0 = abajo en flexión cadera (hinge), tNorm 1 = arriba de pie
        const hipX = feetX - 25 - (1 - tNorm) * 45;
        const hipY = groundY - 110 + (1 - tNorm) * 15;
        const kneeX = feetX - 12;
        const kneeY = groundY - 55;
        const shoulderX = hipX + 15 + tNorm * 10 + (1 - tNorm) * 48;
        const shoulderY = hipY - 65 + (1 - tNorm) * 35;
        const handX = feetX + 5;
        const handY = groundY - 45 + tNorm * 35;

        // Banda pisada por ambos pies y sujeta en manos
        drawElasticBand(ctx, feetX, groundY, handX, handY, tNorm, 6);

        // Piernas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(feetX, groundY);
        ctx.stroke();
        drawSneaker(ctx, feetX - 8, groundY - 2, 0, 20, pal);

        // Isquiotibiales (Estiramiento bajo carga y contracción concéntrica)
        drawMuscleContraction(ctx, (c) => {
          c.ellipse((hipX + kneeX) / 2 - 4, (hipY + kneeY) / 2, 12 + tNorm * 4, 22, 0.3, 0, Math.PI * 2);
        }, tNorm, 'ISQUIOTIBIALES', hipX - 80, (hipY + kneeY) / 2);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.beginPath();
        ctx.moveTo(hipX - 8, hipY);
        ctx.lineTo(shoulderX - 6, shoulderY);
        ctx.lineTo(shoulderX + 12, shoulderY);
        ctx.lineTo(hipX + 10, hipY);
        ctx.closePath();
        ctx.fill();

        // Brazos estirados sujetando la banda
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shoulderX + 4, shoulderY + 8);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        // Línea verde de columna neutra protegida
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hipX - 10, hipY);
        ctx.lineTo(shoulderX, shoulderY);
        ctx.stroke();
        ctx.restore();

        drawHeadSide(ctx, shoulderX + 4, shoulderY - 18, 13, 1, pal);
      }
    },
    {
      id: 9,
      name: 'Remo Horizontal con Goma',
      category: 'espalda',
      target: 'Dorsal Ancho y Romboides',
      synergists: 'Bíceps, Trapecio medio',
      angleName: 'Ángulo Codo',
      angleMin: 170,
      angleMax: 70,
      tensionMin: 4.0,
      tensionMax: 17.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.82;
        const hipX = w * 0.34;
        const shoulderX = hipX + 8;
        const shoulderY = groundY - 100;
        const feetX = w * 0.66;
        const anchorX = w * 0.86;

        // tNorm 0 = brazos estirados hacia adelante, tNorm 1 = codos atrás
        const elbowX = shoulderX + (1 - tNorm) * 55 - tNorm * 18;
        const elbowY = shoulderY + 16;
        const handX = elbowX + (1 - tNorm) * 50 + tNorm * 18;

        // Goma del anclaje a las manos
        drawElasticBand(ctx, anchorX, groundY - 50, handX, elbowY, tNorm, 5);

        // Piernas sentadas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, groundY - 16);
        ctx.lineTo(feetX, groundY - 4);
        ctx.stroke();
        drawSneaker(ctx, feetX - 4, groundY - 4, -0.2, 18, pal);

        // Dorsal Ancho (Espalda media en fuego)
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(shoulderX - 6, (shoulderY + groundY - 20) / 2, 14 + tNorm * 4, 22, 0, 0, Math.PI * 2);
        }, tNorm, 'DORSAL ANCHO', shoulderX - 85, shoulderY + 10);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.fillRect(hipX - 10, shoulderY, 20, groundY - 16 - shoulderY);

        // Brazos jalando
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY + 4);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(handX, elbowY);
        ctx.stroke();

        drawHeadSide(ctx, shoulderX + 2, shoulderY - 20, 13, 1, pal);
      }
    },
    {
      id: 10,
      name: 'Jalón al Pecho con Goma (Lat Pulldown)',
      category: 'espalda',
      target: 'Dorsal Ancho (Tracción Vertical)',
      synergists: 'Redondo Mayor, Bíceps',
      angleName: 'Ángulo Hombro',
      angleMin: 170,
      angleMax: 70,
      tensionMin: 4.5,
      tensionMax: 16.5,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.50;
        const anchorY = h * 0.12;
        const shoulderY = h * 0.44;

        // tNorm 0 = brazos arriba en V, tNorm 1 = codos abajo pegados a dorsales
        const elbowY = shoulderY + (1 - tNorm) * -45 + tNorm * 22;
        const leftElbowX = centerX - 35 - (1 - tNorm) * 25;
        const rightElbowX = centerX + 35 + (1 - tNorm) * 25;
        const leftHandX = centerX - 45 - (1 - tNorm) * 25;
        const rightHandX = centerX + 45 + (1 - tNorm) * 25;
        const handY = anchorY + 35 + tNorm * 55;

        // Bandas desde anclaje alto superior
        drawElasticBand(ctx, centerX, anchorY, leftHandX, handY, tNorm, 5);
        drawElasticBand(ctx, centerX, anchorY, rightHandX, handY, tNorm, 5);

        // Piernas de rodillas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(centerX - 18, groundY);
        ctx.lineTo(centerX - 12, groundY - 45);
        ctx.lineTo(centerX + 12, groundY - 45);
        ctx.lineTo(centerX + 18, groundY);
        ctx.stroke();

        // Dorsales laterales
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(centerX - 24, shoulderY + 18, 12 + tNorm * 4, 18, -0.3, 0, Math.PI * 2);
          c.ellipse(centerX + 24, shoulderY + 18, 12 + tNorm * 4, 18, 0.3, 0, Math.PI * 2);
        }, tNorm, 'DORSALES EN PICO', centerX + 40, shoulderY + 15);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.fillRect(centerX - 20, shoulderY, 40, 50);

        // Brazos traccionando
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(centerX - 20, shoulderY);
        ctx.lineTo(leftElbowX, elbowY);
        ctx.lineTo(leftHandX, handY);
        ctx.moveTo(centerX + 20, shoulderY);
        ctx.lineTo(rightElbowX, elbowY);
        ctx.lineTo(rightHandX, handY);
        ctx.stroke();

        drawHeadFront(ctx, centerX, shoulderY - 22, 14, pal);
      }
    },
    {
      id: 11,
      name: 'Band Pull-Apart (Separaciones Horizontales)',
      category: 'espalda',
      target: 'Deltoides Posterior y Romboides',
      synergists: 'Trapecio Medio, Infraespinoso',
      angleName: 'Abducción Horizontal',
      angleMin: 0,
      angleMax: 90,
      tensionMin: 2.5,
      tensionMax: 11.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.50;
        const shoulderY = h * 0.38;

        // tNorm 0 = manos juntas al frente, tNorm 1 = brazos abiertos en cruz
        const armSpread = 25 + tNorm * 85;
        const leftHandX = centerX - armSpread;
        const rightHandX = centerX + armSpread;

        // Banda elástica horizontal estirándose
        drawElasticBand(ctx, leftHandX, shoulderY + 4, rightHandX, shoulderY + 4, tNorm, 6);

        // Piernas de pie
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(centerX - 16, groundY);
        ctx.lineTo(centerX - 8, groundY - 95);
        ctx.lineTo(centerX + 8, groundY - 95);
        ctx.lineTo(centerX + 16, groundY);
        ctx.stroke();
        drawSneaker(ctx, centerX - 24, groundY - 2, 0, 18, pal);
        drawSneaker(ctx, centerX + 8, groundY - 2, 0, 18, pal);

        // Deltoides Posterior y Romboides
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(centerX - 24, shoulderY + 2, 11 + tNorm * 3, 10, 0, 0, Math.PI * 2);
          c.ellipse(centerX + 24, shoulderY + 2, 11 + tNorm * 3, 10, 0, 0, Math.PI * 2);
        }, tNorm, 'DELTOIDES POSTERIOR', centerX + 38, shoulderY - 14);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.fillRect(centerX - 18, shoulderY, 36, 60);

        // Brazos abiertos
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(centerX - 18, shoulderY);
        ctx.lineTo(leftHandX, shoulderY + 4);
        ctx.moveTo(centerX + 18, shoulderY);
        ctx.lineTo(rightHandX, shoulderY + 4);
        ctx.stroke();

        drawHeadFront(ctx, centerX, shoulderY - 22, 13, pal);
      }
    },
    {
      id: 12,
      name: 'Face Pull con Banda',
      category: 'hombros',
      target: 'Deltoides Posterior y Rotadores Externos',
      synergists: 'Trapecio, Romboides',
      angleName: 'Rotación Externa',
      angleMin: 0,
      angleMax: 75,
      tensionMin: 3.0,
      tensionMax: 12.5,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const hipX = w * 0.38;
        const shoulderX = hipX + 6;
        const shoulderY = groundY - 125;
        const anchorX = w * 0.85;
        const anchorY = shoulderY - 15;

        // tNorm 0 = brazos estirados hacia la goma, tNorm 1 = codos altos y manos a la cara
        const handX = anchorX - 50 - (1 - tNorm) * 90 - tNorm * 105;
        const handY = shoulderY - 15 - tNorm * 12;
        const elbowX = shoulderX - 10 + (1 - tNorm) * 45;
        const elbowY = shoulderY - 10 - tNorm * 18;

        // Banda elástica del anclaje a las manos
        drawElasticBand(ctx, anchorX, anchorY, handX, handY, tNorm, 5);

        // Piernas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX - 15, groundY);
        ctx.lineTo(hipX, groundY - 70);
        ctx.lineTo(hipX + 15, groundY);
        ctx.stroke();
        drawSneaker(ctx, hipX - 22, groundY - 2, 0, 18, pal);
        drawSneaker(ctx, hipX + 8, groundY - 2, 0, 18, pal);

        // Deltoides posterior y manguito rotador
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(shoulderX - 4, shoulderY - 4, 12 + tNorm * 4, 12, 0.4, 0, Math.PI * 2);
        }, tNorm, 'MANGUITO ROTADOR', shoulderX - 95, shoulderY - 25);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 10, shoulderY, 20, 60);

        // Brazos en tracción alta
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        drawHeadSide(ctx, shoulderX + 2, shoulderY - 22, 13, 1, pal);
      }
    },
    {
      id: 13,
      name: 'Zancada Split con Banda Pisada',
      category: 'piernas',
      target: 'Cuádriceps y Glúteo Mayor Unilateral',
      synergists: 'Estabilizadores de Pelvis',
      angleName: 'Rodilla Delantera',
      angleMin: 85,
      angleMax: 170,
      tensionMin: 5.0,
      tensionMax: 17.0,
      draw: function (ctx, w, h, tNorm, gender) {
        // Similar al Lunge pero con postura split fija estricta
        EXERCISES[3].draw(ctx, w, h, tNorm, gender);
      }
    },
    {
      id: 14,
      name: 'Buenos Días con Banda (Good Mornings)',
      category: 'piernas',
      target: 'Bisagra de Cadera, Isquios y Lumbar',
      synergists: 'Glúteos, Erectores de Columna',
      angleName: 'Flexión Cadera',
      angleMin: 85,
      angleMax: 175,
      tensionMin: 4.5,
      tensionMax: 16.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const feetX = w * 0.46;

        // tNorm 0 = abajo en flexión de cadera, tNorm 1 = arriba de pie
        const hipX = feetX - 30 - (1 - tNorm) * 45;
        const hipY = groundY - 110 + (1 - tNorm) * 15;
        const shoulderX = hipX + 16 + tNorm * 10 + (1 - tNorm) * 55;
        const shoulderY = hipY - 65 + (1 - tNorm) * 40;

        // Banda pisada y rodeando el cuello/trapecios
        drawElasticBand(ctx, feetX, groundY, shoulderX, shoulderY, tNorm, 6);

        // Piernas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(feetX - 10, groundY - 55);
        ctx.lineTo(feetX, groundY);
        ctx.stroke();
        drawSneaker(ctx, feetX - 8, groundY - 2, 0, 18, pal);

        // Isquios y erectores
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(hipX - 12, hipY - 10, 14 + tNorm * 4, 20, 0.4, 0, Math.PI * 2);
        }, tNorm, 'CADENA POSTERIOR', hipX - 85, hipY - 30);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.beginPath();
        ctx.moveTo(hipX - 8, hipY);
        ctx.lineTo(shoulderX - 8, shoulderY);
        ctx.lineTo(shoulderX + 12, shoulderY);
        ctx.lineTo(hipX + 10, hipY);
        ctx.closePath();
        ctx.fill();

        // Línea neutra lumbar
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hipX - 6, hipY);
        ctx.lineTo(shoulderX, shoulderY);
        ctx.stroke();
        ctx.restore();

        drawHeadSide(ctx, shoulderX + 4, shoulderY - 18, 13, 1, pal);
      }
    },
    {
      id: 15,
      name: 'Curl Femoral de Pie con Banda Elástica',
      category: 'piernas',
      target: 'Isquiotibiales (Aislamiento)',
      synergists: 'Gastrocnemio',
      angleName: 'Flexión Rodilla',
      angleMin: 170,
      angleMax: 65,
      tensionMin: 3.5,
      tensionMax: 13.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const supportX = w * 0.65;
        const hipX = w * 0.45;
        const hipY = groundY - 115;
        const anchorX = w * 0.30;

        // Barra o pared de apoyo
        ctx.fillStyle = '#475569';
        ctx.fillRect(supportX + 15, groundY - 160, 6, 160);

        // Rodilla flexionándose hacia atrás
        const kneeY = groundY - 58;
        const angleRad = 0.1 + tNorm * 1.8;
        const ankleX = hipX - Math.sin(angleRad) * 45;
        const ankleY = kneeY + Math.cos(angleRad) * 45;

        // Banda elástica del anclaje delantero al tobillo
        drawElasticBand(ctx, anchorX, groundY - 8, ankleX, ankleY, tNorm, 5);

        // Pierna soporte
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(hipX + 5, hipY);
        ctx.lineTo(hipX + 5, groundY);
        ctx.stroke();
        drawSneaker(ctx, hipX - 2, groundY - 2, 0, 18, pal);

        // Pierna activa
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(hipX - 5, hipY);
        ctx.lineTo(hipX - 5, kneeY);
        ctx.lineTo(ankleX, ankleY);
        ctx.stroke();
        drawSneaker(ctx, ankleX, ankleY, angleRad, 16, pal);

        // Isquiotibiales
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(hipX - 12, (hipY + kneeY) / 2, 12 + tNorm * 4, 18, 0, 0, Math.PI * 2);
        }, tNorm, 'ISQUIOTIBIALES', hipX - 90, (hipY + kneeY) / 2);

        // Torso y manos apoyadas
        ctx.fillStyle = pal.top;
        ctx.fillRect(hipX - 10, hipY - 60, 20, 60);
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY - 55);
        ctx.lineTo(supportX + 15, hipY - 45);
        ctx.stroke();

        drawHeadSide(ctx, hipX + 2, hipY - 78, 13, 1, pal);
      }
    },
    {
      id: 16,
      name: 'Elevaciones Laterales en Plano Escapular',
      category: 'hombros',
      target: 'Deltoides Lateral (Scaption)',
      synergists: 'Supraespinoso, Serrato',
      angleName: 'Abducción Brazo',
      angleMin: 15,
      angleMax: 90,
      tensionMin: 2.0,
      tensionMax: 9.5,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.50;
        const shoulderY = h * 0.38;
        const feetX1 = centerX - 24;
        const feetX2 = centerX + 24;

        // tNorm 0 = brazos abajo, tNorm 1 = brazos elevados a 90°
        const armAngle = 0.15 + tNorm * 1.45;
        const armLen = 65;
        const lHandX = centerX - 20 - Math.sin(armAngle) * armLen;
        const lHandY = shoulderY + Math.cos(armAngle) * armLen;
        const rHandX = centerX + 20 + Math.sin(armAngle) * armLen;
        const rHandY = shoulderY + Math.cos(armAngle) * armLen;

        // Bandas elásticas pisadas por los pies
        drawElasticBand(ctx, feetX1, groundY, lHandX, lHandY, tNorm, 5);
        drawElasticBand(ctx, feetX2, groundY, rHandX, rHandY, tNorm, 5);

        // Piernas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(feetX1, groundY);
        ctx.lineTo(centerX - 8, groundY - 90);
        ctx.lineTo(centerX + 8, groundY - 90);
        ctx.lineTo(feetX2, groundY);
        ctx.stroke();
        drawSneaker(ctx, feetX1 - 8, groundY - 2, 0, 18, pal);
        drawSneaker(ctx, feetX2 - 8, groundY - 2, 0, 18, pal);

        // Deltoides lateral
        drawMuscleContraction(ctx, (c) => {
          c.arc(centerX - 20, shoulderY + 4, 12 + tNorm * 4, 0, Math.PI * 2);
          c.arc(centerX + 20, shoulderY + 4, 12 + tNorm * 4, 0, Math.PI * 2);
        }, tNorm, 'DELTOIDES LATERAL', centerX + 35, shoulderY - 14);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.fillRect(centerX - 18, shoulderY, 36, 60);

        // Brazos
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(centerX - 18, shoulderY);
        ctx.lineTo(lHandX, lHandY);
        ctx.moveTo(centerX + 18, shoulderY);
        ctx.lineTo(rHandX, rHandY);
        ctx.stroke();

        drawHeadFront(ctx, centerX, shoulderY - 22, 13, pal);
      }
    },
    {
      id: 17,
      name: 'Aperturas Posteriores (Band Pull-Apart Avanzado)',
      category: 'espalda',
      target: 'Retracción Escapular y Deltoides Post.',
      synergists: 'Trapecio, Manguito',
      angleName: 'Apertura Escapular',
      angleMin: 0,
      angleMax: 95,
      tensionMin: 3.0,
      tensionMax: 12.0,
      draw: function (ctx, w, h, tNorm, gender) {
        EXERCISES[10].draw(ctx, w, h, tNorm, gender);
      }
    },
    {
      id: 18,
      name: 'Flexiones Resistidas con Banda (Push-Ups)',
      category: 'pecho',
      target: 'Pectoral Mayor y Tríceps',
      synergists: 'Serrato Anterior, Core',
      angleName: 'Ángulo Codo',
      angleMin: 90,
      angleMax: 175,
      tensionMin: 5.0,
      tensionMax: 19.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.80;
        const feetX = w * 0.22;
        const handX = w * 0.70;

        // tNorm 0 = pecho en suelo (flexionado), tNorm 1 = arriba en plancha alta
        const bodyLift = tNorm * 38;
        const hipX = w * 0.44;
        const hipY = groundY - 18 - bodyLift * 0.6;
        const shoulderX = handX;
        const shoulderY = groundY - 22 - bodyLift;
        const elbowX = handX - 22 + (1 - tNorm) * 10;
        const elbowY = shoulderY + (1 - tNorm) * 12;

        // Banda elástica por encima de la espalda sujeta bajo las palmas
        drawElasticBand(ctx, handX - 10, groundY - 2, shoulderX, shoulderY, tNorm, 6);
        drawElasticBand(ctx, shoulderX, shoulderY, handX + 10, groundY - 2, tNorm, 6);

        // Piernas y torso en línea de plancha rígida
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(feetX, groundY - 2);
        ctx.lineTo(hipX, hipY);
        ctx.lineTo(shoulderX, shoulderY);
        ctx.stroke();
        drawSneaker(ctx, feetX - 4, groundY - 2, 0.4, 18, pal);

        // Pectoral Mayor en contracción concéntrica
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(shoulderX - 8, shoulderY + 4, 14 + tNorm * 4, 16, 0.3, 0, Math.PI * 2);
        }, tNorm, 'PECTORAL MAYOR', shoulderX - 80, shoulderY - 20);

        // Brazos empujando
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(handX, groundY - 2);
        ctx.stroke();

        // Línea verde de estabilización de core
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(feetX, groundY - 2);
        ctx.lineTo(shoulderX, shoulderY);
        ctx.stroke();
        ctx.restore();

        drawHeadSide(ctx, shoulderX + 16, shoulderY - 8, 12, 1, pal);
      }
    },
    {
      id: 19,
      name: 'Pullover Dorsal con Banda Anclada Alta',
      category: 'espalda',
      target: 'Dorsal Ancho y Serrato',
      synergists: 'Tríceps (Porción Larga), Pectoral menor',
      angleName: 'Extensión Hombro',
      angleMin: 150,
      angleMax: 20,
      tensionMin: 3.5,
      tensionMax: 15.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const hipX = w * 0.36;
        const shoulderX = hipX + 22;
        const shoulderY = groundY - 110;
        const anchorX = w * 0.85;
        const anchorY = h * 0.16;

        // tNorm 0 = brazos arriba estirando dorsal, tNorm 1 = brazos abajo junto a caderas
        const armAngle = 0.5 + (1 - tNorm) * 1.5;
        const armLen = 65;
        const handX = shoulderX + Math.cos(armAngle) * armLen;
        const handY = shoulderY - Math.sin(armAngle) * armLen;

        // Banda desde anclaje alto a manos
        drawElasticBand(ctx, anchorX, anchorY, handX, handY, tNorm, 5);

        // Piernas con flexión atlética
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX - 10, groundY);
        ctx.lineTo(hipX, groundY - 60);
        ctx.lineTo(hipX + 15, groundY);
        ctx.stroke();
        drawSneaker(ctx, hipX - 18, groundY - 2, 0, 18, pal);
        drawSneaker(ctx, hipX + 8, groundY - 2, 0, 18, pal);

        // Dorsal Ancho
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(shoulderX - 10, shoulderY + 12, 14 + tNorm * 5, 20, 0.2, 0, Math.PI * 2);
        }, tNorm, 'DORSAL ANCHO', shoulderX - 85, shoulderY - 10);

        // Torso inclinado ligeramente hacia adelante
        ctx.fillStyle = pal.top;
        ctx.beginPath();
        ctx.moveTo(hipX - 6, groundY - 60);
        ctx.lineTo(shoulderX - 8, shoulderY);
        ctx.lineTo(shoulderX + 12, shoulderY);
        ctx.lineTo(hipX + 10, groundY - 60);
        ctx.closePath();
        ctx.fill();

        // Brazos casi rectos barriendo en arco
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        drawHeadSide(ctx, shoulderX + 2, shoulderY - 20, 13, 1, pal);
      }
    },
    {
      id: 20,
      name: 'Extensión de Tríceps Sobre la Cabeza',
      category: 'brazos',
      target: 'Tríceps Braquial (Porción Larga)',
      synergists: 'Ancóneo, Estabilizadores escapulares',
      angleName: 'Extensión Codo',
      angleMin: 65,
      angleMax: 175,
      tensionMin: 2.5,
      tensionMax: 11.5,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.46;
        const shoulderY = groundY - 120;
        const elbowX = centerX + 4;
        const elbowY = shoulderY - 35; // Codo apuntando hacia arriba junto a oreja

        // tNorm 0 = antebrazo doblado tras la nuca, tNorm 1 = antebrazo vertical extendido arriba
        const armAngle = -1.2 + tNorm * 2.7;
        const handX = elbowX + Math.sin(armAngle) * 45;
        const handY = elbowY - Math.cos(armAngle) * 45;

        // Banda pisada por detrás o anclada en espalda baja
        drawElasticBand(ctx, centerX - 12, groundY - 20, handX, handY, tNorm, 5);

        // Piernas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(centerX - 12, groundY);
        ctx.lineTo(centerX, groundY - 65);
        ctx.lineTo(centerX + 12, groundY);
        ctx.stroke();
        drawSneaker(ctx, centerX - 18, groundY - 2, 0, 18, pal);
        drawSneaker(ctx, centerX + 6, groundY - 2, 0, 18, pal);

        // Tríceps braquial (Parte posterior del brazo)
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(elbowX - 6, (shoulderY + elbowY) / 2, 9 + tNorm * 3, 16, 0.1, 0, Math.PI * 2);
        }, tNorm, 'TRÍCEPS (PORCIÓN LARGA)', elbowX - 95, elbowY + 15);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.fillRect(centerX - 10, shoulderY, 20, 60);

        // Brazo y antebrazo
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(centerX, shoulderY);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        drawHeadSide(ctx, centerX + 2, shoulderY - 18, 13, 1, pal);
      }
    },
    {
      id: 21,
      name: 'Curl Martillo con Rotación en Supinación',
      category: 'brazos',
      target: 'Bíceps Braquial y Braquiorradial',
      synergists: 'Braquial Anterior',
      angleName: 'Flexión Codo',
      angleMin: 170,
      angleMax: 50,
      tensionMin: 3.0,
      tensionMax: 13.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.50;
        const shoulderY = h * 0.38;
        const elbowX = centerX + 18;
        const elbowY = shoulderY + 45;

        // tNorm 0 = brazo extendido abajo, tNorm 1 = brazo flexionado arriba con supinación
        const forearmAngle = 0.15 + tNorm * 2.3;
        const forearmLen = 42;
        const handX = elbowX - Math.sin(forearmAngle) * forearmLen;
        const handY = elbowY - Math.cos(forearmAngle) * forearmLen;

        // Banda pisada en el suelo
        drawElasticBand(ctx, centerX + 15, groundY, handX, handY, tNorm, 5);

        // Piernas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(centerX - 16, groundY);
        ctx.lineTo(centerX - 8, groundY - 90);
        ctx.lineTo(centerX + 8, groundY - 90);
        ctx.lineTo(centerX + 16, groundY);
        ctx.stroke();
        drawSneaker(ctx, centerX - 24, groundY - 2, 0, 18, pal);
        drawSneaker(ctx, centerX + 8, groundY - 2, 0, 18, pal);

        // Bíceps braquial en pico
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(elbowX - 4, (shoulderY + elbowY) / 2, 10 + tNorm * 5, 14, -0.2, 0, Math.PI * 2);
        }, tNorm, 'BÍCEPS EN SUPINACIÓN', elbowX + 15, (shoulderY + elbowY) / 2);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.fillRect(centerX - 16, shoulderY, 32, 60);

        // Brazo flexionando
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(centerX + 14, shoulderY);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        drawHeadFront(ctx, centerX, shoulderY - 22, 13, pal);
      }
    },
    {
      id: 22,
      name: 'Monster Walk Lateral en Tobillos',
      category: 'piernas',
      target: 'Glúteo Medio (Palanca Distal)',
      synergists: 'Tensor de la Fascia Lata',
      angleName: 'Abducción Tobillos',
      angleMin: 10,
      angleMax: 40,
      tensionMin: 5.0,
      tensionMax: 18.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.50;
        const leftFootX = centerX - 55;
        const rightFootX = centerX + 25 + tNorm * 70;
        const ankleY = groundY - 12;

        // Miniband en TOBILLOS (palanca distal)
        drawElasticBand(ctx, leftFootX + 8, ankleY, rightFootX - 8, ankleY, tNorm, 8);

        // Piernas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(centerX - 16, h * 0.50);
        ctx.lineTo(centerX - 35, h * 0.68);
        ctx.lineTo(leftFootX, groundY);
        ctx.moveTo(centerX + 16, h * 0.50);
        ctx.lineTo(centerX + 20 + tNorm * 45, h * 0.68);
        ctx.lineTo(rightFootX, groundY);
        ctx.stroke();

        drawSneaker(ctx, leftFootX - 8, groundY - 2, 0, 18, pal);
        drawSneaker(ctx, rightFootX - 8, groundY - 2, 0, 18, pal);

        // Glúteo medio
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(centerX + 22, h * 0.52, 16 + tNorm * 4, 13, 0.3, 0, Math.PI * 2);
        }, tNorm, 'GLÚTEO MEDIO', centerX + 40, h * 0.48);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.fillRect(centerX - 20, h * 0.32, 40, h * 0.18);
        drawHeadFront(ctx, centerX, h * 0.22, 14, pal);
      }
    },
    {
      id: 23,
      name: 'Rotación Externa de Hombro con Banda',
      category: 'hombros',
      target: 'Manguito Rotador (Infraespinoso)',
      synergists: 'Redondo Menor, Deltoides Posterior',
      angleName: 'Rotación Externa',
      angleMin: 0,
      angleMax: 70,
      tensionMin: 1.5,
      tensionMax: 7.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.44;
        const shoulderY = h * 0.38;
        const anchorX = w * 0.18;
        const elbowX = centerX + 18;
        const elbowY = shoulderY + 45; // Codo pegado a la cintura a 90°

        // tNorm 0 = mano pegada al vientre, tNorm 1 = antebrazo abierto hacia afuera 70°
        const rotAngle = -0.1 + tNorm * 1.3;
        const handX = elbowX + Math.cos(rotAngle) * 44;
        const handY = elbowY + Math.sin(rotAngle) * 12;

        // Banda elástica desde anclaje lateral a la mano
        drawElasticBand(ctx, anchorX, elbowY, handX, handY, tNorm, 5);

        // Piernas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(centerX - 14, groundY);
        ctx.lineTo(centerX - 6, groundY - 90);
        ctx.lineTo(centerX + 6, groundY - 90);
        ctx.lineTo(centerX + 14, groundY);
        ctx.stroke();
        drawSneaker(ctx, centerX - 20, groundY - 2, 0, 18, pal);
        drawSneaker(ctx, centerX + 6, groundY - 2, 0, 18, pal);

        // Infraespinoso / Manguito posterior
        drawMuscleContraction(ctx, (c) => {
          c.ellipse(centerX - 2, shoulderY + 12, 10 + tNorm * 3, 12, -0.2, 0, Math.PI * 2);
        }, tNorm, 'INFRAESPINOSO', centerX + 35, shoulderY - 10);

        // Torso
        ctx.fillStyle = pal.top;
        ctx.fillRect(centerX - 16, shoulderY, 32, 60);

        // Toalla imaginaria de osteopatía bajo el codo para evitar compensación
        ctx.fillStyle = '#64748b';
        ctx.fillRect(centerX + 10, elbowY - 6, 8, 14);

        // Brazo rotando
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(centerX + 14, shoulderY);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        drawHeadFront(ctx, centerX, shoulderY - 22, 13, pal);
      }
    },
    {
      id: 24,
      name: 'Flexión Plantar de Tobillo con Banda (Gemelos y Sóleo)',
      category: 'piernas',
      target: 'Tríceps Sural (Gastrocnemio y Sóleo)',
      synergists: 'Flexor largo de los dedos',
      angleName: 'Flexión Plantar',
      angleMin: 80,
      angleMax: 135,
      tensionMin: 4.0,
      tensionMax: 16.0,
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.78;
        const hipX = w * 0.32;
        const ankleX = w * 0.68;
        const handX = hipX + 18;
        const handY = groundY - 35;

        // tNorm 0 = pie en 90° dorsiflexión, tNorm 1 = pie en punta extendida (plantarflexión)
        const toeAngle = -0.3 + tNorm * 0.9;
        const footLen = 22;
        const toeX = ankleX + Math.cos(toeAngle) * footLen;
        const toeY = groundY - 8 + Math.sin(toeAngle) * footLen;

        // Banda elástica alrededor de los metatarsos sujeta con ambas manos
        drawElasticBand(ctx, handX, handY, toeX, toeY, tNorm, 6);

        // Pierna estirada en suelo
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, groundY - 8);
        ctx.lineTo(ankleX, groundY - 8);
        ctx.stroke();

        // Pie empujando la goma
        drawSneaker(ctx, ankleX, groundY - 8, toeAngle, 18, pal);

        // Gemelo y Sóleo en contracción
        drawMuscleContraction(ctx, (c) => {
          c.ellipse((hipX + ankleX) / 2 + 15, groundY - 14, 22 + tNorm * 4, 10 + tNorm * 3, 0.05, 0, Math.PI * 2);
        }, tNorm, 'GEMELOS Y SÓLEO', (hipX + ankleX) / 2 - 30, groundY - 30);

        // Torso sentado erguido
        ctx.fillStyle = pal.top;
        ctx.fillRect(hipX - 10, groundY - 75, 18, 68);

        // Brazos sujetando las bandas
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(hipX + 5, groundY - 70);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        drawHeadSide(ctx, hipX + 2, groundY - 92, 13, 1, pal);
      }
    }
  ];

  // --- CONTROLADOR DE VÍDEO Y ANIMACIÓN (MASTER Y CARDS) ---

  // Obtener datos de un ejercicio por ID (1-24)
  function getExercise(id) {
    return EXERCISES.find(e => e.id === Number(id)) || EXERCISES[0];
  }

  // Actualizar HUD de un canvas específico
  function updateHUD(prefix, ex, tNorm, phase, phaseColor) {
    const actPct = Math.round(20 + tNorm * 78);
    const angle = Math.round(ex.angleMin + tNorm * (ex.angleMax - ex.angleMin));
    const tension = (ex.tensionMin + tNorm * (ex.tensionMax - ex.tensionMin)).toFixed(1);

    const targetEl = document.getElementById(`${prefix}-target`);
    const angleEl = document.getElementById(`${prefix}-angle`);
    const phaseEl = document.getElementById(`${prefix}-phase`);
    const tensionEl = document.getElementById(`${prefix}-tension`);
    const pctEl = document.getElementById(`${prefix}-pct`);
    const barEl = document.getElementById(`${prefix}-bar`);

    if (targetEl) targetEl.textContent = `ZONA: ${ex.target.toUpperCase()}`;
    if (angleEl) angleEl.textContent = `${ex.angleName.toUpperCase()}: ${angle}°`;
    if (phaseEl) {
      phaseEl.textContent = phase.toUpperCase();
      phaseEl.style.color = phaseColor;
    }
    if (tensionEl) tensionEl.textContent = `TENSIÓN: ${tension} kg`;
    if (pctEl) pctEl.textContent = `${actPct}%`;
    if (barEl) barEl.style.width = `${actPct}%`;
  }

  // --- BUCLE PRINCIPAL DE ANIMACIÓN 60 FPS ---
  function masterLoop(timestamp) {
    const dt = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    // 1. Actualizar Master Studio
    if (state.masterIsPlaying) {
      state.masterProgress += (dt * state.speed) / state.cycleDurationMs;
      if (state.masterProgress >= 1.0) {
        state.masterProgress = state.isLooping ? (state.masterProgress % 1.0) : 1.0;
      }
      const masterScrubber = document.getElementById('master-scrubber');
      if (masterScrubber) masterScrubber.value = Math.round(state.masterProgress * 1000);
    }

    const { tNorm: mNorm, phase: mPhase, phaseColor: mPhaseColor } = calcKinematics(state.masterProgress);
    const masterEx = getExercise(state.activeMasterEx);
    updateHUD('master-hud', masterEx, mNorm, mPhase, mPhaseColor);

    const masterCanvas = document.getElementById('master-canvas');
    if (masterCanvas && masterCanvas.offsetParent !== null) {
      const mCtx = masterCanvas.getContext('2d');
      mCtx.clearRect(0, 0, masterCanvas.width, masterCanvas.height);
      masterEx.draw(mCtx, masterCanvas.width, masterCanvas.height, mNorm, state.gender);
    }

    // 2. Actualizar cada reproductor de tarjeta activo en el viewport
    Object.keys(state.cardPlayers).forEach(exId => {
      const p = state.cardPlayers[exId];
      if (!p) return;

      const canvas = document.getElementById(`card-canvas-${exId}`);
      if (!canvas || canvas.offsetParent === null) return;

      if (p.isPlaying) {
        p.progress += (dt * state.speed) / state.cycleDurationMs;
        if (p.progress >= 1.0) {
          p.progress = p.progress % 1.0;
        }
        const scrubber = document.getElementById(`card-scrubber-${exId}`);
        if (scrubber) scrubber.value = Math.round(p.progress * 1000);
      }

      const { tNorm, phase, phaseColor } = calcKinematics(p.progress);
      const ex = getExercise(exId);
      updateHUD(`card-hud-${exId}`, ex, tNorm, phase, phaseColor);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ex.draw(ctx, canvas.width, canvas.height, tNorm, p.gender || state.gender);
    });

    requestAnimationFrame(masterLoop);
  }

  // --- API PÚBLICA PARA INTERACCIÓN DEL USUARIO ---

  window.BiomechEngine = {
    exercises: EXERCISES,

    // Inicializar lienzos y escuchadores
    init: function () {
      // Configurar Master Studio
      const mCanvas = document.getElementById('master-canvas');
      if (mCanvas) {
        mCanvas.width = 720;
        mCanvas.height = 405; // 16:9 aspecto
      }

      // Inicializar estado de las 24 tarjetas
      EXERCISES.forEach(ex => {
        state.cardPlayers[ex.id] = {
          isPlaying: true,
          progress: 0,
          viewMode: 'video',
          gender: state.gender
        };

        const cCanvas = document.getElementById(`card-canvas-${ex.id}`);
        if (cCanvas) {
          cCanvas.width = 540;
          cCanvas.height = 300;
        }
      });

      // Escuchador de Scrubber Master
      const mScrubber = document.getElementById('master-scrubber');
      if (mScrubber) {
        mScrubber.addEventListener('input', e => {
          state.masterProgress = parseFloat(e.target.value) / 1000;
        });
      }

      // Escuchadores de Scrubbers de Tarjetas
      EXERCISES.forEach(ex => {
        const sc = document.getElementById(`card-scrubber-${ex.id}`);
        if (sc) {
          sc.addEventListener('input', e => {
            if (state.cardPlayers[ex.id]) {
              state.cardPlayers[ex.id].progress = parseFloat(e.target.value) / 1000;
            }
          });
        }
      });

      state.lastTimestamp = performance.now();
      requestAnimationFrame(masterLoop);
    },

    // Cambiar ejercicio en Master Studio
    selectMasterExercise: function (id) {
      state.activeMasterEx = Number(id);
      state.masterProgress = 0;
      const ex = getExercise(id);

      // Actualizar botones de selector
      document.querySelectorAll('.master-ex-pill').forEach(btn => {
        if (Number(btn.getAttribute('data-ex-id')) === Number(id)) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      const titleEl = document.getElementById('master-video-title');
      if (titleEl) titleEl.textContent = `#${id < 10 ? '0' + id : id}. ${ex.name}`;
    },

    // Cambiar género global
    setGlobalGender: function (gender) {
      state.gender = gender;
      // Actualizar botones de género
      document.querySelectorAll('.gender-btn-female').forEach(btn => {
        if (gender === 'female') btn.classList.add('active');
        else btn.classList.remove('active');
      });
      document.querySelectorAll('.gender-btn-male').forEach(btn => {
        if (gender === 'male') btn.classList.add('active');
        else btn.classList.remove('active');
      });

      // Sincronizar en tarjetas
      Object.keys(state.cardPlayers).forEach(id => {
        state.cardPlayers[id].gender = gender;
      });
    },

    // Cambiar género individual de una tarjeta
    setCardGender: function (exId, gender) {
      if (state.cardPlayers[exId]) {
        state.cardPlayers[exId].gender = gender;
      }
      const fBtn = document.getElementById(`card-gender-f-${exId}`);
      const mBtn = document.getElementById(`card-gender-m-${exId}`);
      if (fBtn && mBtn) {
        if (gender === 'female') {
          fBtn.classList.add('active');
          mBtn.classList.remove('active');
        } else {
          mBtn.classList.add('active');
          fBtn.classList.remove('active');
        }
      }
    },

    // Alternar Play/Pausa en Master Studio
    toggleMasterPlay: function () {
      state.masterIsPlaying = !state.masterIsPlaying;
      const btn = document.getElementById('master-play-btn');
      if (btn) {
        btn.innerHTML = state.masterIsPlaying ? '⏸️ Pausa' : '▶️ Reanudar';
      }
    },

    // Alternar Play/Pausa en Tarjeta
    toggleCardPlay: function (exId) {
      const p = state.cardPlayers[exId];
      if (p) {
        p.isPlaying = !p.isPlaying;
        const btn = document.getElementById(`card-play-btn-${exId}`);
        if (btn) btn.innerHTML = p.isPlaying ? '⏸️' : '▶️';
      }
    },

    // Cambiar velocidad de reproducción
    setSpeed: function (spd) {
      state.speed = spd;
      document.querySelectorAll('.speed-btn').forEach(btn => {
        if (parseFloat(btn.getAttribute('data-speed')) === spd) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    },

    // Alternar Vista en Tarjeta: Vídeo vs Lámina Técnica SVG vs Ambos
    switchCardView: function (exId, mode) {
      const videoWrap = document.getElementById(`card-video-wrap-${exId}`);
      const svgWrap = document.getElementById(`card-svg-wrap-${exId}`);
      const tabs = document.querySelectorAll(`#card-media-tabs-${exId} .media-tab-btn`);

      tabs.forEach(t => {
        if (t.getAttribute('data-mode') === mode) t.classList.add('active');
        else t.classList.remove('active');
      });

      if (mode === 'video') {
        if (videoWrap) videoWrap.style.display = 'block';
        if (svgWrap) svgWrap.style.display = 'none';
      } else if (mode === 'svg') {
        if (videoWrap) videoWrap.style.display = 'none';
        if (svgWrap) svgWrap.style.display = 'block';
      } else if (mode === 'both') {
        if (videoWrap) videoWrap.style.display = 'block';
        if (svgWrap) svgWrap.style.display = 'block';
      }
    },

    // Descargar Vídeo WebM de 60 FPS directo al ordenador
    recordVideoClip: function (sourceCanvasId, exId, badgeId, btnEl) {
      const canvas = document.getElementById(sourceCanvasId);
      if (!canvas || !canvas.captureStream) {
        alert('Tu navegador no admite la grabación directa por MediaRecorder.');
        return;
      }

      const badge = document.getElementById(badgeId);
      const ex = getExercise(exId);

      // Reiniciar progreso a 0 para grabar una repetición perfecta
      if (sourceCanvasId === 'master-canvas') {
        state.masterProgress = 0;
        state.masterIsPlaying = true;
      } else if (state.cardPlayers[exId]) {
        state.cardPlayers[exId].progress = 0;
        state.cardPlayers[exId].isPlaying = true;
      }

      const stream = canvas.captureStream(60); // 60 FPS nítidos
      let chunks = [];
      let recorder;

      try {
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      } catch (e1) {
        try {
          recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        } catch (e2) {
          recorder = new MediaRecorder(stream);
        }
      }

      recorder.ondataavailable = function (e) {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = function () {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const athleteGender = (sourceCanvasId === 'master-canvas') ? state.gender : (state.cardPlayers[exId]?.gender || state.gender);
        const safeName = ex.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        a.download = `ejercicio_${ex.id}_${safeName}_${athleteGender}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (badge) badge.style.display = 'none';
        if (btnEl) {
          const oldText = btnEl.innerHTML;
          btnEl.innerHTML = '✅ ¡Vídeo Descargado!';
          setTimeout(() => { btnEl.innerHTML = oldText; }, 3500);
        }
      };

      recorder.start();
      if (badge) badge.style.display = 'inline-flex';
      if (btnEl) btnEl.innerHTML = '🔴 Grabando repetición...';

      // Grabar exactamente 1 repetición (6.1 segundos a 60 FPS)
      setTimeout(() => {
        if (recorder && recorder.state === 'recording') {
          recorder.stop();
        }
      }, 6100);
    },

    // Imprimir o Guardar en PDF solo una ficha específica
    printCard: function (exNum) {
      document.body.setAttribute('data-print-focus', exNum);
      window.print();
      setTimeout(() => {
        document.body.removeAttribute('data-print-focus');
      }, 1000);
    }
  };

  // Auto-iniciar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.BiomechEngine.init);
  } else {
    window.BiomechEngine.init();
  }
})();
