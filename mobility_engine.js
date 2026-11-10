/**
 * MOBILITY ENGINE - Motor Biomecánico Didáctico 2D (60 FPS)
 * 8 Rutinas de Movilidad Articular para Corredores y Ciclistas
 * Gráficos ultra-claros para principiantes: cuerpo completo con profundidad, accesorios (colchoneta, pared, marcas de distancia),
 * flechas dinámicas de movimiento, indicadores de verificación (✓ / ✕) y subtítulos paso a paso en pantalla.
 * Autora: Elena Benito Cases - Atlas Biomecánico
 */

(function () {
  'use strict';

  // --- ESTADO GLOBAL ---
  const state = {
    gender: 'female', // 'female' | 'male'
    speed: 1.0,
    isLooping: true,
    activeMasterMob: 1,
    masterIsPlaying: true,
    masterProgress: 0,
    cardPlayers: {}, // { [mobId]: { isPlaying, progress, gender } }
    lastTimestamp: performance.now(),
    cycleDurationMs: 6500 // 6.5 segundos por ciclo completo de movilidad
  };

  // --- PALETA ANATÓMICA Y MATERIAL DEPORTIVO ---
  function getPalette(gender) {
    const isFem = gender === 'female';
    return {
      isFem,
      skin: isFem ? '#f6c3a5' : '#e8b08d',
      skinShadow: isFem ? '#dd9d7d' : '#cb8a65',
      hair: isFem ? '#381e11' : '#1e293b',
      top: isFem ? '#0284c7' : '#0369a1',
      topShadow: isFem ? '#0369a1' : '#075985',
      topAccent: isFem ? '#38bdf8' : '#7dd3fc',
      bottom: isFem ? '#0f172a' : '#1e293b',
      bottomShadow: isFem ? '#020617' : '#0f172a',
      bgLimb: isFem ? '#475569' : '#334155', // Extremidad trasera para dar profundidad 3D
      shoeBase: '#ffffff',
      shoeSole: '#020617',
      shoeAccent: isFem ? '#38bdf8' : '#f59e0b',
      matColor: '#0284c7',
      matBorder: '#38bdf8',
      arrowColor: '#06b6d4',
      arrowPulse: 'rgba(6, 182, 212, 0.9)',
      checkGreen: '#10b981',
      warnRed: '#ef4444',
      hudBg: 'rgba(3, 7, 18, 0.88)'
    };
  }

  // --- CINEMÁTICA Y CURVA DE MOVILIDAD DIDÁCTICA ---
  function calcKinematics(prog) {
    let tNorm = 0;
    let stepNum = 1;
    let stepText = '';
    let phaseName = 'Apertura articular';
    let phaseColor = '#f59e0b';

    if (prog <= 0.38) {
      // Fase 1: Entrada suave al rango
      const t = prog / 0.38;
      tNorm = t * t * (3 - 2 * t);
      stepNum = 1;
      phaseName = 'Paso 1: Entrada suave';
      phaseColor = '#f59e0b';
    } else if (prog <= 0.65) {
      // Fase 2: Mantenimiento y respiración profunda
      tNorm = 1.0;
      stepNum = 2;
      phaseName = 'Paso 2: Mantén y respira';
      phaseColor = '#ef4444';
    } else {
      // Fase 3: Retorno decelerado controlado
      const t = (prog - 0.65) / 0.35;
      tNorm = 1.0 - (t * t * (3 - 2 * t));
      stepNum = 3;
      phaseName = 'Paso 3: Vuelve suave';
      phaseColor = '#10b981';
    }

    return { tNorm, stepNum, phaseName, phaseColor };
  }

  // --- HELPERS GRÁFICOS DIDÁCTICOS (FLECHAS, MARCAS, SUBTÍTULOS) ---

  // Subtítulo con instrucción clara para principiantes en la parte superior del canvas
  function drawInstructionBanner(ctx, w, title, instruction, phaseColor) {
    ctx.save();
    const bannerH = 38;
    ctx.fillStyle = 'rgba(3, 7, 18, 0.92)';
    ctx.fillRect(0, 0, w, bannerH);
    ctx.strokeStyle = phaseColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, bannerH);
    ctx.lineTo(w, bannerH);
    ctx.stroke();

    // Icono y texto
    ctx.fillStyle = phaseColor;
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(title.toUpperCase(), 14, 16);

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(instruction, 14, 31);
    ctx.restore();
  }

  // Flecha animada de dirección de movimiento
  function drawMotionArrow(ctx, x1, y1, x2, y2, curved = 0, color = '#06b6d4') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    ctx.beginPath();
    if (curved === 0) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      // Cabeza de flecha
      const ang = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 10 * Math.cos(ang - Math.PI / 6), y2 - 10 * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(x2 - 10 * Math.cos(ang + Math.PI / 6), y2 - 10 * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else {
      const midX = (x1 + x2) / 2 + curved;
      const midY = (y1 + y2) / 2 - Math.abs(curved) * 0.4;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();
      const ang = Math.atan2(y2 - midY, x2 - midX);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 10 * Math.cos(ang - Math.PI / 6), y2 - 10 * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(x2 - 10 * Math.cos(ang + Math.PI / 6), y2 - 10 * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Indicador de verificación correcta (Checkmark verde con caja)
  function drawCheckmark(ctx, x, y, text) {
    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 12, 160, 20, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('✓', x + 2, y + 2);

    ctx.fillStyle = '#d1fae5';
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(text, x + 16, y + 2);
    ctx.restore();
  }

  // Indicador de error / cuidado (Cruz roja con caja)
  function drawWarningBadge(ctx, x, y, text) {
    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 12, 175, 20, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('✕', x + 2, y + 2);

    ctx.fillStyle = '#fee2e2';
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(text, x + 16, y + 2);
    ctx.restore();
  }

  // Colchoneta de fitness / yoga realista con textura y grosor
  function drawYogaMat(ctx, x, y, width, height = 6) {
    ctx.save();
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y - height, width, height, 3);
    ctx.fill();
    ctx.stroke();
    // Líneas de textura de agarre
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let lx = x + 12; lx < x + width - 8; lx += 14) {
      ctx.beginPath();
      ctx.moveTo(lx, y - height);
      ctx.lineTo(lx, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Zapatilla técnica realista
  function drawSneaker(ctx, x, y, angle, length, pal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Suela exterior de agarre
    ctx.fillStyle = pal.shoeSole;
    ctx.beginPath();
    ctx.roundRect(-length * 0.25, 1, length * 1.35, 5, 2);
    ctx.fill();
    // Mediasuela amortiguación (blanco)
    ctx.fillStyle = pal.shoeBase;
    ctx.beginPath();
    ctx.roundRect(-length * 0.2, -3, length * 1.28, 4, 1);
    ctx.fill();
    // Tejido zapatilla
    ctx.fillStyle = pal.bottom;
    ctx.beginPath();
    ctx.moveTo(-length * 0.15, -3);
    ctx.lineTo(length * 0.95, -3);
    ctx.lineTo(length * 0.75, -11);
    ctx.lineTo(length * 0.2, -11);
    ctx.lineTo(-length * 0.15, -8);
    ctx.closePath();
    ctx.fill();
    // Detalles color de contraste
    ctx.fillStyle = pal.shoeAccent;
    ctx.beginPath();
    ctx.moveTo(length * 0.2, -8);
    ctx.lineTo(length * 0.65, -8);
    ctx.lineTo(length * 0.55, -4);
    ctx.lineTo(length * 0.25, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Cabeza con cabello, oreja y mirada orientada
  function drawHeadSide(ctx, x, y, radius, facingDir, pal) {
    ctx.save();
    // Pelo base
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.arc(x, y - 2, radius + 2, 0, Math.PI * 2);
    ctx.fill();

    if (pal.isFem) {
      // Coleta deportiva atlética
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.ellipse(x - facingDir * (radius + 7), y - 1, 6, 13, facingDir * 0.35, 0, Math.PI * 2);
      ctx.fill();
      // Coletero
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(x - facingDir * (radius + 2), y - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rostro con perfil
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.arc(x + facingDir * 2, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Nariz / Perfil sutil
    ctx.fillStyle = pal.skinShadow;
    ctx.beginPath();
    ctx.arc(x + facingDir * (radius * 0.9), y + 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Resplandor térmico de la articulación / cápsula / fascia en elongación
  function drawJointCapsuleGlow(ctx, x, y, radius, tNorm, label) {
    ctx.save();
    const glowRadius = radius + tNorm * 10;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, glowRadius);
    grad.addColorStop(0, `rgba(239, 68, 68, ${0.85 + tNorm * 0.15})`);
    grad.addColorStop(0.5, `rgba(245, 158, 11, ${0.45 + tNorm * 0.3})`);
    grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo articular blanco
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (label) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(label, x + 12, y - 6);
    }
    ctx.restore();
  }

  // Arco transportador con lectura clara en grados de rango de movimiento (ROM)
  function drawRomArc(ctx, cx, cy, radius, startAng, endAng, currentDeg, label = 'ROM') {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAng, endAng);
    ctx.stroke();

    // Líneas punteadas delimitadoras
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(startAng) * (radius + 8), cy + Math.sin(startAng) * (radius + 8));
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(endAng) * (radius + 8), cy + Math.sin(endAng) * (radius + 8));
    ctx.stroke();

    // Etiqueta flotante
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px monospace';
    const midAng = (startAng + endAng) / 2;
    const tx = cx + Math.cos(midAng) * (radius + 16);
    const ty = cy + Math.sin(midAng) * (radius + 16);
    ctx.fillText(`${Math.round(currentDeg)}° ${label}`, tx - 14, ty + 4);
    ctx.restore();
  }

  // --- CATÁLOGO DE LOS 8 EJERCICIOS CON ILUSTRACIÓN ULTRA-CLARA ---
  const MOBILITIES = [
    {
      id: 1,
      slug: 'dorsiflexion-tobillo-pared',
      name: 'Dorsiflexión de Tobillo en Carga (Knee-to-Wall)',
      target: 'Articulación tibioperoneoastragalina, sóleo y fascia plantar',
      category: 'tobillo',
      tagBadge: '🏃 Corredores & 🚴 Ciclistas',
      angleName: 'Dorsiflexión de tobillo',
      angleMin: 90,
      angleMax: 125,
      romTarget: '≥ 10-12 cm pared',
      clinicalFocus: 'Absorción de impacto en carrera y punto muerto inferior en pedaleo',
      stepGuide: [
        'Coloca el pie a unos 10 cm de la pared con las manos apoyadas a la altura del pecho.',
        'Avanza flexionando la rodilla hacia la pared buscando tocarla SIN despegar el talón.',
        'Siente la tensión en el tobillo y la pantorrilla; mantén 2 segundos y vuelve despacio.'
      ],
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.82;
        const wallX = w * 0.82;

        // Subtítulo didáctico
        const inst = tNorm < 0.8
          ? 'Paso 1: Avanza llevando la rodilla hacia la pared manteniendo el talón clavado'
          : 'Paso 2: ¡Mantén 2 segundos en la pared! Siente la apertura en el tobillo';
        drawInstructionBanner(ctx, w, 'Ejercicio #01 • Tobillo a Pared', inst, tNorm < 0.8 ? '#f59e0b' : '#ef4444');

        // Suelo y Pared de habitación / gimnasio
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.05, groundY, w * 0.9, 8);
        ctx.fillStyle = '#475569';
        ctx.fillRect(wallX, groundY - 210, 14, 210);

        // Guía de distancia en el suelo (Regla de 10-12 cm)
        const footX = w * 0.60;
        const footY = groundY;
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(footX + 18, groundY + 14);
        ctx.lineTo(wallX, groundY + 14);
        ctx.moveTo(footX + 18, groundY + 8);
        ctx.lineTo(footX + 18, groundY + 20);
        ctx.moveTo(wallX, groundY + 8);
        ctx.lineTo(wallX, groundY + 20);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('10 - 12 cm pared', footX + 22, groundY + 28);
        ctx.restore();

        // Rodilla viaja hacia adelante hasta tocar la pared
        const kneeX = footX + 12 + tNorm * (wallX - (footX + 14));
        const kneeY = groundY - 56 - tNorm * 12;
        const hipX = w * 0.42 + tNorm * 26;
        const hipY = groundY - 114;
        const shoulderX = hipX + 10;
        const shoulderY = hipY - 62;

        // Flecha dinámica de avance de la rodilla
        drawMotionArrow(ctx, footX + 20, groundY - 60, kneeX + 16, kneeY, 0, '#06b6d4');

        // Pierna trasera (apoyo y estabilidad)
        ctx.strokeStyle = pal.bgLimb;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(hipX - 12, hipY);
        ctx.lineTo(w * 0.28, groundY - 48);
        ctx.lineTo(w * 0.22, groundY);
        ctx.stroke();
        drawSneaker(ctx, w * 0.20, groundY - 2, 0, 16, pal);

        // Pierna delantera activa (muslo y tibia con masa muscular)
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
        drawSneaker(ctx, footX - 4, groundY - 2, 0, 19, pal);

        // Verificación correcta: Talón pegado al suelo
        drawCheckmark(ctx, footX - 35, groundY - 24, 'Talón 100% pegado al suelo');

        // Zona activa: Cápsula del tobillo y sóleo
        drawJointCapsuleGlow(ctx, footX + 2, footY - 8, 9, tNorm, 'CÁPSULA TIBIOASTRAGALINA');

        // Medidor de grados de dorsiflexión
        const deg = 90 + tNorm * 35;
        drawRomArc(ctx, footX, footY - 6, 28, -Math.PI, -Math.PI + (deg * Math.PI / 180), deg, 'Dorsiflexión');

        // Torso erguido con ropa deportiva
        ctx.fillStyle = pal.top;
        ctx.beginPath();
        ctx.moveTo(hipX - 8, hipY);
        ctx.lineTo(shoulderX - 10, shoulderY);
        ctx.lineTo(shoulderX + 12, shoulderY);
        ctx.lineTo(hipX + 10, hipY);
        ctx.closePath();
        ctx.fill();

        // Brazos apoyados firmes en la pared
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shoulderX + 6, shoulderY + 12);
        ctx.lineTo(wallX - 2, shoulderY + 22);
        ctx.stroke();

        drawHeadSide(ctx, shoulderX + 4, shoulderY - 20, 13, 1, pal);
      }
    },
    {
      id: 2,
      slug: 'couch-stretch-psoas',
      name: 'Couch Stretch / Zancada con Retroversión (Psoas e Ilíaco)',
      target: 'Psoas mayor, ilíaco, recto femoral y cápsula anterior de cadera',
      category: 'cadera',
      tagBadge: '🚴 Vital Ciclistas & 🏃 Corredores',
      angleName: 'Extensión de cadera',
      angleMin: 5,
      angleMax: 25,
      romTarget: '15° a 25° extensión pura',
      clinicalFocus: 'Revierte acortamiento por sillín y permite zancada amplia sin dolor lumbar',
      stepGuide: [
        'Apoya la rodilla trasera en una colchoneta o cojín y da un paso adelante a 90° con la otra.',
        'Aprieta con fuerza el glúteo trasero y mete la pelvis hacia adentro (retroversión pélvica).',
        'Avanza suavemente el cuerpo con el torso erguido. Siente el estiramiento en la ingle.'
      ],
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.82;

        const inst = tNorm < 0.8
          ? 'Paso 1: Aprieta el glúteo trasero y avanza la pelvis con el torso vertical'
          : 'Paso 2: ¡Mantén 2-3 seg! Siente el psoas y la cara frontal del muslo abrirse';
        drawInstructionBanner(ctx, w, 'Ejercicio #02 • Couch Stretch (Psoas)', inst, tNorm < 0.8 ? '#f59e0b' : '#ef4444');

        // Suelo y Colchoneta de apoyo
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.05, groundY, w * 0.9, 8);
        drawYogaMat(ctx, w * 0.28, groundY, 90, 7);

        // Posición de zancada baja
        const backKneeX = w * 0.36;
        const backKneeY = groundY - 7;
        const frontFootX = w * 0.68;
        const frontFootY = groundY;
        const frontKneeX = frontFootX - 6 + tNorm * 14;
        const frontKneeY = groundY - 52;

        // Pelvis avanza hacia adelante en retroversión
        const hipX = w * 0.44 + tNorm * 38;
        const hipY = groundY - 68 - tNorm * 6;
        const shoulderX = hipX - 4;
        const shoulderY = hipY - 66;

        // Flecha de empuje de la pelvis
        drawMotionArrow(ctx, w * 0.44, groundY - 72, hipX + 18, hipY - 6, 0, '#06b6d4');

        // Pierna trasera sobre colchoneta
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(backKneeX, backKneeY);
        ctx.lineTo(backKneeX - 32, groundY - 35);
        ctx.stroke();
        drawSneaker(ctx, backKneeX - 36, groundY - 35, 0.45, 15, pal);

        // Pierna delantera a 90°
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(frontKneeX, frontKneeY);
        ctx.lineTo(frontFootX, frontFootY);
        ctx.stroke();
        drawSneaker(ctx, frontFootX - 6, frontFootY - 2, 0, 19, pal);

        // Resplandor en psoas ilíaco y recto anterior
        drawJointCapsuleGlow(ctx, hipX - 8, hipY + 4, 11, tNorm, 'PSOAS-ILÍACO EN ELONGACIÓN');

        // Verificaciones didácticas
        drawCheckmark(ctx, hipX - 70, hipY - 30, 'Glúteo apretado (retroversión)');
        drawCheckmark(ctx, shoulderX + 20, shoulderY + 10, 'Torso erguido (no arquear lumbar)');

        // Línea verde de alineación de espalda
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(hipX, hipY);
        ctx.stroke();
        ctx.restore();

        // Torso
        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 10, shoulderY, 20, hipY - shoulderY);
        drawHeadSide(ctx, shoulderX + 2, shoulderY - 18, 13, 1, pal);

        const deg = 5 + tNorm * 20;
        drawRomArc(ctx, hipX, hipY, 26, Math.PI * 0.4, Math.PI * 0.4 + (deg * Math.PI / 180), deg, 'Extensión');
      }
    },
    {
      id: 3,
      slug: 'rotaciones-cadera-90-90',
      name: 'Rotaciones de Cadera 90/90 (Shin Box Switches)',
      target: 'Cápsula coxofemoral en rotación interna (RI) y externa (RE)',
      category: 'cadera',
      tagBadge: '🏃 Anti-cintilla & 🚴 Alineación rodilla',
      angleName: 'Rotación interna / externa',
      angleMin: 20,
      angleMax: 45,
      romTarget: '45° externa / 35° interna',
      clinicalFocus: 'Previene síndrome de cintilla iliotibial y evita que la rodilla colapse',
      stepGuide: [
        'Siéntate en el suelo con ambas piernas flexionadas formando un ángulo de 90° y 90° en escuadra.',
        'Mantén el pecho erguido y las manos juntas delante del pecho (evita apoyarte en el suelo).',
        'Gira suavemente ambas rodillas a la vez hacia el lado contrario apoyándolas en el suelo.'
      ],
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.78;
        const centerX = w * 0.50;

        const inst = tNorm < 0.5
          ? 'Paso 1: Piernas en 90/90 en el suelo. Pecho alto sin tocar con las manos'
          : 'Paso 2: Gira lentamente las rodillas al lado contrario haciéndolas rodar';
        drawInstructionBanner(ctx, w, 'Ejercicio #03 • Rotación de Cadera 90/90', inst, tNorm < 0.5 ? '#f59e0b' : '#ef4444');

        // Suelo y Colchoneta amplia
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.05, groundY, w * 0.9, 8);
        drawYogaMat(ctx, w * 0.15, groundY, w * 0.70, 7);

        const pelvisX = centerX;
        const pelvisY = groundY - 26;
        const torsoY = pelvisY - 64;

        // Transición de rotación: cambio de inclinación de fémures
        const rotShift = (tNorm - 0.5) * 65;
        const leftKneeX = centerX - 60 + rotShift * 0.5;
        const leftKneeY = groundY - 14;
        const rightKneeX = centerX + 50 + rotShift * 0.5;
        const rightKneeY = groundY - 14;

        // Flecha de giro de cadera
        drawMotionArrow(ctx, centerX - 30, groundY - 45, centerX + 30, groundY - 45, 15, '#06b6d4');

        // Piernas en escuadra 90°
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(pelvisX - 10, pelvisY);
        ctx.lineTo(leftKneeX, leftKneeY);
        ctx.lineTo(leftKneeX + 38, groundY - 4);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pelvisX + 10, pelvisY);
        ctx.lineTo(rightKneeX, rightKneeY);
        ctx.lineTo(rightKneeX + 34, groundY - 4);
        ctx.stroke();

        // Resplandor de rotación interna y externa
        drawJointCapsuleGlow(ctx, pelvisX - 14, pelvisY + 2, 10, tNorm, 'ROTACIÓN INTERNA');
        drawJointCapsuleGlow(ctx, pelvisX + 14, pelvisY + 2, 10, 1 - tNorm, 'ROTACIÓN EXTERNA');

        // Verificación didáctica
        drawCheckmark(ctx, centerX - 75, torsoY - 16, 'Pecho alto (sin apoyar manos)');

        // Torso erguido
        ctx.fillStyle = pal.top;
        ctx.fillRect(pelvisX - 12, torsoY, 24, pelvisY - torsoY);

        // Manos juntas al frente (prueba de que no se apoya en suelo)
        ctx.fillStyle = pal.skin;
        ctx.beginPath();
        ctx.arc(pelvisX + 18, torsoY + 22, 6, 0, Math.PI * 2);
        ctx.fill();

        drawHeadSide(ctx, pelvisX, torsoY - 18, 13, 1, pal);

        const deg = 20 + tNorm * 25;
        drawRomArc(ctx, pelvisX, pelvisY, 30, -Math.PI * 0.8, -Math.PI * 0.8 + (deg * Math.PI / 180), deg, 'Rotación');
      }
    },
    {
      id: 4,
      slug: 'worlds-greatest-stretch',
      name: 'El Mayor Estiramiento del Mundo (World’s Greatest Stretch)',
      target: 'Cadera, columna torácica, isquiotibiales y tobillos',
      category: 'columna',
      tagBadge: '⭐ Rey del Calentamiento Dinámico',
      angleName: 'Rotación torácica y apertura',
      angleMin: 15,
      angleMax: 80,
      romTarget: '70° a 80° rotación torácica',
      clinicalFocus: 'Disocia cintura escapular y pélvica; apertura total de la cadena anterior y posterior',
      stepGuide: [
        'Zancada amplia: apoya las dos manos en el suelo por dentro del pie delantero.',
        'Baja el codo del lado del pie adelantado hacia el empeine interior para abrir la cadera.',
        'Gira el pecho hacia el cielo abriendo el brazo vertical al techo y sigue la mano con la mirada.'
      ],
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.82;

        const inst = tNorm < 0.6
          ? 'Paso 1: Zancada profunda. Baja el codo interior hacia el empeine para abrir cadera'
          : 'Paso 2: Rota el pecho hacia el cielo estirando el brazo vertical. ¡Mira tu mano!';
        drawInstructionBanner(ctx, w, 'Ejercicio #04 • World’s Greatest Stretch', inst, tNorm < 0.6 ? '#f59e0b' : '#ef4444');

        // Suelo y Colchoneta
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.05, groundY, w * 0.9, 8);
        drawYogaMat(ctx, w * 0.16, groundY, w * 0.65, 7);

        const frontFootX = w * 0.64;
        const frontFootY = groundY;
        const frontKneeX = frontFootX - 10;
        const frontKneeY = groundY - 50;
        const backFootX = w * 0.20;
        const backFootY = groundY;
        const hipX = w * 0.45;
        const hipY = groundY - 48;

        // Pierna trasera estirada y activa
        ctx.strokeStyle = pal.bgLimb;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(w * 0.30, groundY - 26);
        ctx.lineTo(backFootX, backFootY);
        ctx.stroke();
        drawSneaker(ctx, backFootX - 4, backFootY - 2, 0.35, 16, pal);

        // Pierna delantera
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(frontKneeX, frontKneeY);
        ctx.lineTo(frontFootX, frontFootY);
        ctx.stroke();
        drawSneaker(ctx, frontFootX - 6, frontFootY - 2, 0, 19, pal);

        // Mano de apoyo en el suelo
        const handSupportX = frontFootX - 38;
        const handSupportY = groundY;
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(hipX + 10, hipY - 22);
        ctx.lineTo(handSupportX, handSupportY);
        ctx.stroke();

        // Brazo dinámico que se abre hacia el cielo
        const armAng = -Math.PI * 0.2 - tNorm * Math.PI * 0.55;
        const armLen = 60;
        const rotHandX = hipX + 12 + Math.cos(armAng) * armLen;
        const rotHandY = hipY - 24 + Math.sin(armAng) * armLen;

        // Flecha de rotación hacia el cielo
        drawMotionArrow(ctx, hipX + 25, hipY - 10, rotHandX + 8, rotHandY - 6, -20, '#06b6d4');

        ctx.strokeStyle = pal.topAccent;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(hipX + 12, hipY - 24);
        ctx.lineTo(rotHandX, rotHandY);
        ctx.stroke();

        // Resplandor en tórax y cadera
        drawJointCapsuleGlow(ctx, hipX + 12, hipY - 20, 12, tNorm, 'ROTACIÓN TORÁCICA');

        drawCheckmark(ctx, backFootX - 10, groundY - 45, 'Pierna trasera estirada');

        const deg = 15 + tNorm * 65;
        drawRomArc(ctx, hipX + 12, hipY - 24, 30, -Math.PI * 0.7, -Math.PI * 0.7 + (deg * Math.PI / 180), deg, 'Giro');

        drawHeadSide(ctx, hipX + 16, hipY - 36, 12, 1, pal);
      }
    },
    {
      id: 5,
      slug: 'enhebrar-aguja-toracico',
      name: 'Enhebrar la Aguja Torácico en Cuadrupedia (Thread the Needle)',
      target: 'Columna dorsal (T1 a T12) y caja torácica',
      category: 'columna',
      tagBadge: '🚴 Alivio cifosis manillar & 🏃 Capacidad pulmonar',
      angleName: 'Rotación de columna dorsal',
      angleMin: 20,
      angleMax: 75,
      romTarget: '65° a 75° de rotación pura',
      clinicalFocus: 'Desbloquea la espalda rígida del ciclista y optimiza el braceo en carrera',
      stepGuide: [
        'Colócate en cuadrupedia sobre la colchoneta (manos bajo hombros, rodillas bajo caderas).',
        'Pasa un brazo por debajo del pecho deslizando el dorso de la mano por el suelo.',
        'Invierte el movimiento y abre el mismo brazo vertical hacia el cielo, rotando la caja torácica.'
      ],
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.82;
        const centerX = w * 0.48;

        const inst = tNorm < 0.5
          ? 'Paso 1: Pasa el brazo bajo el pecho deslizando por el suelo con pelvis fija'
          : 'Paso 2: ¡Abre al cielo! Gira el pecho sin que se balanceen las caderas';
        drawInstructionBanner(ctx, w, 'Ejercicio #05 • Enhebrar la Aguja (Dorsal)', inst, tNorm < 0.5 ? '#f59e0b' : '#ef4444');

        // Suelo y Colchoneta
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.05, groundY, w * 0.9, 8);
        drawYogaMat(ctx, w * 0.16, groundY, w * 0.65, 7);

        const kneeX = centerX - 48;
        const kneeY = groundY - 6;
        const hipX = centerX - 36;
        const hipY = groundY - 56;
        const shoulderX = centerX + 32;
        const shoulderY = groundY - 54;
        const supportHandX = shoulderX + 14;
        const supportHandY = groundY;

        // Rodillas en colchoneta
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(kneeX - 26, groundY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(hipX, hipY);
        ctx.stroke();

        // Tronco horizontal
        ctx.fillStyle = pal.top;
        ctx.fillRect(hipX, hipY - 8, shoulderX - hipX, 18);

        // Brazo de apoyo en suelo
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(supportHandX, supportHandY);
        ctx.stroke();

        // Brazo dinámico
        const ang = 0.8 - tNorm * 2.2;
        const armLen = 54;
        const mobHandX = shoulderX + Math.cos(ang) * armLen;
        const mobHandY = shoulderY + Math.sin(ang) * armLen;

        // Flecha de rotación circular
        drawMotionArrow(ctx, shoulderX + 10, shoulderY + 20, mobHandX + 4, mobHandY - 6, -18, '#06b6d4');

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(mobHandX, mobHandY);
        ctx.stroke();

        drawJointCapsuleGlow(ctx, shoulderX - 4, shoulderY + 4, 11, tNorm, 'VÉRTEBRAS T1-T12');

        drawCheckmark(ctx, hipX - 80, hipY - 26, 'Pelvis nivelada (sin girar)');

        const deg = 20 + tNorm * 55;
        drawRomArc(ctx, shoulderX, shoulderY, 28, -Math.PI * 0.8, -Math.PI * 0.8 + (deg * Math.PI / 180), deg, 'Dorsal');

        drawHeadSide(ctx, shoulderX + 16, shoulderY - 16, 12, 1, pal);
      }
    },
    {
      id: 6,
      slug: 'barrido-isquios-dinamico',
      name: 'Barrido Isquiosural Dinámico con Talón Apoyado (Hamstring Sweeps)',
      target: 'Isquiotibiales (cadena posterior dinámica) y nervio ciático',
      category: 'piernas',
      tagBadge: '🏃 Ciclo estiramiento-acortamiento & 🚴 Descompresión isquion',
      angleName: 'Flexión de cadera en bisagra',
      angleMin: 45,
      angleMax: 85,
      romTarget: '80° a 85° con columna neutra',
      clinicalFocus: 'Elasticidad fascial activa sin rebotes lesivos y liberación de tensión ciática',
      stepGuide: [
        'Da un paso hacia adelante clavando el talón con los dedos apuntando al cielo.',
        'Empuja la cadera hacia atrás (flexión de cadera) mientras la pierna trasera se dobla.',
        'Barre con ambas manos cerca del suelo hacia el pie como cogiendo agua, con la espalda recta.'
      ],
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.50;

        const inst = tNorm < 0.7
          ? 'Paso 1: Talón clavado, puntera arriba. Empuja la cadera hacia atrás con espalda recta'
          : 'Paso 2: Barre con las manos hacia el pie. Siente el tirón elástico en los isquios';
        drawInstructionBanner(ctx, w, 'Ejercicio #06 • Barridos Isquiotibiales', inst, tNorm < 0.7 ? '#f59e0b' : '#ef4444');

        // Suelo
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.05, groundY, w * 0.9, 8);

        const frontHeelX = centerX + 42;
        const frontHeelY = groundY;
        const backFootX = centerX - 38;
        const backFootY = groundY;

        // Bisagra de cadera
        const hipX = centerX - 16 - tNorm * 24;
        const hipY = groundY - 110 + tNorm * 20;
        const shoulderX = hipX + 24 + tNorm * 16;
        const shoulderY = hipY - 60 + tNorm * 38;

        // Flecha de retroceso de cadera
        drawMotionArrow(ctx, centerX, groundY - 110, hipX - 12, hipY, 0, '#06b6d4');

        // Pierna trasera flexionada
        ctx.strokeStyle = pal.bgLimb;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(hipX - 6, hipY);
        ctx.lineTo(backFootX + 10, groundY - 50);
        ctx.lineTo(backFootX, backFootY);
        ctx.stroke();
        drawSneaker(ctx, backFootX - 4, backFootY - 2, 0, 16, pal);

        // Pierna delantera recta en tensión elástica
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(frontHeelX - 12, groundY - 52);
        ctx.lineTo(frontHeelX, frontHeelY);
        ctx.stroke();
        drawSneaker(ctx, frontHeelX - 4, frontHeelY - 2, -0.45, 19, pal);

        // Brazos barriendo
        const sweepHandX = frontHeelX - 12 + (1 - tNorm) * 20;
        const sweepHandY = groundY - 6 - (1 - tNorm) * 35;
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY + 8);
        ctx.lineTo(sweepHandX, sweepHandY);
        ctx.stroke();

        // Resplandor en isquiotibiales
        drawJointCapsuleGlow(ctx, (hipX + frontHeelX) / 2 - 4, groundY - 45, 12, tNorm, 'ISQUIOTIBIALES & FASCIA');

        drawCheckmark(ctx, frontHeelX - 25, groundY - 25, 'Puntera levantada');
        drawCheckmark(ctx, hipX - 85, hipY - 35, 'Cadera viaja atrás');

        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 8, shoulderY, 18, hipY - shoulderY);
        drawHeadSide(ctx, shoulderX + 8, shoulderY - 14, 12, 1, pal);

        const deg = 45 + tNorm * 40;
        drawRomArc(ctx, hipX, hipY, 28, -Math.PI * 0.6, -Math.PI * 0.6 + (deg * Math.PI / 180), deg, 'Bisagra');
      }
    },
    {
      id: 7,
      slug: 'cossack-squat-aductores',
      name: 'Sentadilla Cossack Dinámica (Movilidad Frontal de Cadera y Aductores)',
      target: 'Aductores (mayor, largo, grácil) y cápsula medial coxofemoral',
      category: 'cadera',
      tagBadge: '🏃 Anti-pubalgia & 🚴 Plano frontal',
      angleName: 'Apertura y flexión lateral',
      angleMin: 40,
      angleMax: 100,
      romTarget: 'Sentadilla profunda a 90°',
      clinicalFocus: 'Rompe la rigidez sagital repetitiva de la bici y estabiliza la zancada del corredor',
      stepGuide: [
        'Abre las piernas generosamente más allá del ancho de tus hombros con los pies paralelos.',
        'Baja hacia un lado flexionando rodilla y cadera; la otra pierna se estira completamente.',
        'La pierna estirada clava el talón con la puntera hacia el techo. Pecho erguido.'
      ],
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.50;

        const inst = tNorm < 0.7
          ? 'Paso 1: Desciende lateral doblando una rodilla sin despegar el talón del suelo'
          : 'Paso 2: La pierna estirada gira la puntera hacia arriba. Siente el aductor estirarse';
        drawInstructionBanner(ctx, w, 'Ejercicio #07 • Sentadilla Cossack (Aductores)', inst, tNorm < 0.7 ? '#f59e0b' : '#ef4444');

        // Suelo
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.05, groundY, w * 0.9, 8);

        const leftFootX = centerX - 70;
        const rightFootX = centerX + 70;

        const squatDepth = tNorm * 54;
        const hipX = centerX - 38 - tNorm * 20;
        const hipY = groundY - 96 + squatDepth;
        const leftKneeX = leftFootX + 16;
        const leftKneeY = groundY - 55 + squatDepth * 0.45;
        const shoulderX = hipX + 8;
        const shoulderY = hipY - 58;

        // Flecha de bajada en sentadilla unilateral
        drawMotionArrow(ctx, centerX - 10, groundY - 110, hipX, hipY - 10, 0, '#06b6d4');

        // Pierna flexionada en sentadilla
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(leftKneeX, leftKneeY);
        ctx.lineTo(leftFootX, groundY);
        ctx.stroke();
        drawSneaker(ctx, leftFootX - 4, groundY - 2, 0, 19, pal);

        // Pierna extendida lateral
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(rightFootX, groundY);
        ctx.stroke();
        drawSneaker(ctx, rightFootX - 4, groundY - 2, -0.4, 18, pal);

        // Resplandor en aductores de la pierna recta
        drawJointCapsuleGlow(ctx, (hipX + rightFootX) / 2, groundY - 35, 12, tNorm, 'COMPARTIMENTO ADUCTOR');

        drawCheckmark(ctx, leftFootX - 35, groundY - 25, 'Talón plano en suelo');
        drawCheckmark(ctx, rightFootX - 50, groundY - 25, 'Puntera al techo');

        // Torso erguido con manos juntas
        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 10, shoulderY, 20, hipY - shoulderY);
        ctx.fillStyle = pal.skin;
        ctx.beginPath();
        ctx.arc(shoulderX + 16, shoulderY + 24, 6, 0, Math.PI * 2);
        ctx.fill();

        drawHeadSide(ctx, shoulderX + 2, shoulderY - 18, 12, 1, pal);

        const deg = 40 + tNorm * 60;
        drawRomArc(ctx, leftKneeX, leftKneeY, 26, Math.PI * 0.5, Math.PI * 0.5 + (deg * Math.PI / 180), deg, 'Apertura');
      }
    },
    {
      id: 8,
      slug: 'descompresion-cintilla-iliotibial',
      name: 'Cruce Posterior y Descompresión del Tracto Iliotibial (ITB Glide)',
      target: 'Banda iliotibial (tracto de Maissiat), tensor de la fascia lata y glúteo medio',
      category: 'cadera',
      tagBadge: '🏃 Anti-síndrome del limpiaparabrisas & 🚴 Alivio trocánter',
      angleName: 'Aducción lateral de cadera',
      angleMin: 10,
      angleMax: 30,
      romTarget: '25° a 30° aducción lateral',
      clinicalFocus: 'Elimina la fricción sobre el cóndilo externo de rodilla en carrera y cadencia ciclista',
      stepGuide: [
        'De pie: cruza una pierna por detrás de la otra apoyando el borde exterior del pie.',
        'Empuja la pelvis hacia el lado de la pierna trasera como sacando cadera.',
        'Eleva el brazo del mismo lado por encima de tu cabeza arqueando el cuerpo como una C.'
      ],
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.86;
        const centerX = w * 0.50;

        const inst = tNorm < 0.7
          ? 'Paso 1: Cruza la pierna por detrás y empuja la cadera hacia afuera en arco lateral'
          : 'Paso 2: Arquea el brazo sobre la cabeza. Siente la banda iliotibial y el costado descomprimirse';
        drawInstructionBanner(ctx, w, 'Ejercicio #08 • Descompresión Cintilla Iliotibial', inst, tNorm < 0.7 ? '#f59e0b' : '#ef4444');

        // Suelo
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.05, groundY, w * 0.9, 8);

        const frontFootX = centerX - 12;
        const frontFootY = groundY;
        const backCrossX = centerX + 30 + tNorm * 20;
        const backCrossY = groundY;

        // Desplazamiento lateral de cadera
        const hipShift = tNorm * 34;
        const hipX = centerX + 12 + hipShift;
        const hipY = groundY - 116;

        // Inclinación del torso en sentido contrario
        const shoulderX = centerX - 10 - tNorm * 22;
        const shoulderY = hipY - 65;

        // Flecha de empuje lateral de cadera
        drawMotionArrow(ctx, centerX + 6, hipY + 8, hipX + 22, hipY + 8, 0, '#06b6d4');

        // Piernas cruzadas
        ctx.strokeStyle = pal.bgLimb;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(hipX - 14, hipY);
        ctx.lineTo(frontFootX, frontFootY);
        ctx.stroke();
        drawSneaker(ctx, frontFootX - 4, frontFootY - 2, 0, 18, pal);

        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(backCrossX - 6, groundY - 55);
        ctx.lineTo(backCrossX, backCrossY);
        ctx.stroke();
        drawSneaker(ctx, backCrossX - 4, backCrossY - 2, 0.25, 18, pal);

        // Brazo en arco sobre la cabeza
        const armAng = -Math.PI * 0.5 - tNorm * 0.45;
        const armLen = 56;
        const handX = shoulderX + 16 + Math.cos(armAng) * armLen;
        const handY = shoulderY + Math.sin(armAng) * armLen;

        ctx.strokeStyle = pal.topAccent;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shoulderX + 14, shoulderY + 8);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        // Resplandor en banda iliotibial y tensor fascia lata
        drawJointCapsuleGlow(ctx, hipX + 8, hipY + 24, 12, tNorm, 'TRACTO ILIOTIBIAL (MAISSIAT)');

        drawCheckmark(ctx, hipX + 15, hipY - 20, 'Empuja la cadera hacia afuera');

        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 10, shoulderY, 20, hipY - shoulderY);
        drawHeadSide(ctx, shoulderX + 4, shoulderY - 18, 12, -1, pal);

        const deg = 10 + tNorm * 20;
        drawRomArc(ctx, hipX, hipY, 28, Math.PI * 0.1, Math.PI * 0.1 + (deg * Math.PI / 180), deg, 'Aducción');
      }
    }
  ];

  // --- MOTOR DE RENDERIZADO Y BUCLE PRINCIPAL (60 FPS) ---
  function renderMaster(timestamp) {
    const canvas = document.getElementById('mobility-master-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 2;
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    const dt = timestamp - state.lastTimestamp;
    if (state.masterIsPlaying) {
      state.masterProgress += (dt * state.speed) / state.cycleDurationMs;
      if (state.masterProgress >= 1.0) {
        state.masterProgress = state.isLooping ? (state.masterProgress % 1.0) : 1.0;
      }
    }

    const ex = MOBILITIES.find(m => m.id === state.activeMasterMob) || MOBILITIES[0];
    const { tNorm, phaseName, phaseColor } = calcKinematics(state.masterProgress);

    ctx.clearRect(0, 0, rect.width, rect.height);
    drawTechGrid(ctx, rect.width, rect.height);
    ex.draw(ctx, rect.width, rect.height, tNorm, state.gender);

    updateMasterHUD(ex, tNorm, phaseName, phaseColor);
  }

  function drawTechGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateMasterHUD(ex, tNorm, phaseName, phaseColor) {
    const elPhase = document.getElementById('mob-hud-phase');
    if (elPhase) {
      elPhase.textContent = phaseName.toUpperCase();
      elPhase.style.color = phaseColor;
    }

    const elAngle = document.getElementById('mob-hud-angle');
    if (elAngle) {
      const curAngle = Math.round(ex.angleMin + tNorm * (ex.angleMax - ex.angleMin));
      elAngle.textContent = `${curAngle}° (${ex.angleName})`;
    }

    const elTarget = document.getElementById('mob-hud-target');
    if (elTarget) {
      elTarget.textContent = ex.target;
    }

    const elScrubber = document.getElementById('mob-master-scrubber');
    if (elScrubber) {
      elScrubber.value = Math.round(state.masterProgress * 1000);
    }

    const elTime = document.getElementById('mob-master-time');
    if (elTime) {
      const curSec = (state.masterProgress * 6.5).toFixed(1);
      elTime.textContent = `0:0${Math.floor(curSec)} / 0:06`;
    }
  }

  // Renderizado de las tarjetas individuales en la galería
  function renderCardCanvases(timestamp) {
    const dt = timestamp - state.lastTimestamp;

    MOBILITIES.forEach(ex => {
      const canvas = document.getElementById(`mob-canvas-${ex.id}`);
      if (!canvas) return;

      if (!state.cardPlayers[ex.id]) {
        state.cardPlayers[ex.id] = {
          isPlaying: true,
          progress: 0,
          gender: state.gender
        };
      }

      const pState = state.cardPlayers[ex.id];
      if (pState.isPlaying) {
        pState.progress += (dt * state.speed) / state.cycleDurationMs;
        if (pState.progress >= 1.0) pState.progress = pState.progress % 1.0;
      }

      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 2;
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      const { tNorm } = calcKinematics(pState.progress);
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawTechGrid(ctx, rect.width, rect.height);
      ex.draw(ctx, rect.width, rect.height, tNorm, pState.gender);

      const angleBadge = document.getElementById(`mob-card-rom-${ex.id}`);
      if (angleBadge) {
        const curAngle = Math.round(ex.angleMin + tNorm * (ex.angleMax - ex.angleMin));
        angleBadge.textContent = `${curAngle}° ROM`;
      }
    });
  }

  function mainLoop(timestamp) {
    renderMaster(timestamp);
    renderCardCanvases(timestamp);
    state.lastTimestamp = timestamp;
    requestAnimationFrame(mainLoop);
  }

  // --- API PÚBLICA ---
  window.MobilityEngine = {
    init: function () {
      state.lastTimestamp = performance.now();
      requestAnimationFrame(mainLoop);
    },

    setGender: function (gender) {
      state.gender = gender;
      Object.keys(state.cardPlayers).forEach(id => {
        state.cardPlayers[id].gender = gender;
      });
      document.querySelectorAll('.mob-gender-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-gender') === gender);
      });
    },

    setMasterMobility: function (mobId) {
      state.activeMasterMob = parseInt(mobId);
      state.masterProgress = 0;
      const ex = MOBILITIES.find(m => m.id === state.activeMasterMob);
      if (ex) {
        const titleEl = document.getElementById('mob-master-title');
        if (titleEl) titleEl.textContent = `${ex.id}. ${ex.name}`;
        const subEl = document.getElementById('mob-master-sub');
        if (subEl) subEl.textContent = ex.clinicalFocus;
      }
      document.querySelectorAll('.mob-selector-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-id')) === state.activeMasterMob);
      });
    },

    toggleMasterPlay: function () {
      state.masterIsPlaying = !state.masterIsPlaying;
      const btn = document.getElementById('mob-btn-play');
      if (btn) btn.innerHTML = state.masterIsPlaying ? '⏸️' : '▶️';
    },

    seekMaster: function (val) {
      state.masterProgress = parseFloat(val) / 1000;
    },

    setSpeed: function (s) {
      state.speed = parseFloat(s);
      document.querySelectorAll('.mob-speed-btn').forEach(b => {
        b.classList.toggle('active', parseFloat(b.getAttribute('data-speed')) === state.speed);
      });
    },

    toggleCardPlay: function (mobId) {
      if (!state.cardPlayers[mobId]) return;
      state.cardPlayers[mobId].isPlaying = !state.cardPlayers[mobId].isPlaying;
      const btn = document.getElementById(`mob-btn-play-${mobId}`);
      if (btn) btn.innerHTML = state.cardPlayers[mobId].isPlaying ? '⏸️' : '▶️';
    },

    recordVideo: function (canvasId, mobId, btnEl) {
      const canvas = document.getElementById(canvasId);
      if (!canvas || !canvas.captureStream) {
        alert('Tu navegador no admite la grabación directa de vídeo.');
        return;
      }

      const ex = MOBILITIES.find(m => m.id === mobId) || MOBILITIES[0];
      const stream = canvas.captureStream(60);
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

      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const slug = ex.slug || `movilidad_${mobId}`;
        a.download = `movilidad_${mobId}_${slug}_${state.gender}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (btnEl) {
          const old = btnEl.innerHTML;
          btnEl.innerHTML = '✅ ¡Vídeo Descargado!';
          setTimeout(() => { btnEl.innerHTML = old; }, 3500);
        }
      };

      recorder.start();
      if (btnEl) btnEl.innerHTML = '🔴 Grabando clip (60 fps)...';
      setTimeout(() => {
        if (recorder && recorder.state === 'recording') recorder.stop();
      }, 6600);
    },

    getMobilities: function () {
      return MOBILITIES;
    },

    switchCardView: function (mobId, mode) {
      const realWrap = document.getElementById(`mob-real-wrap-${mobId}`);
      const animWrap = document.getElementById(`mob-anim-wrap-${mobId}`);
      const tabs = document.querySelectorAll(`#mob-media-tabs-${mobId} .media-tab-btn`);

      tabs.forEach(t => {
        if (t.getAttribute('data-mode') === mode) t.classList.add('active');
        else t.classList.remove('active');
      });

      if (mode === 'real') {
        if (realWrap) realWrap.style.display = 'block';
        if (animWrap) animWrap.style.display = 'none';
      } else if (mode === 'anim') {
        if (realWrap) realWrap.style.display = 'none';
        if (animWrap) animWrap.style.display = 'block';
      } else if (mode === 'both') {
        if (realWrap) realWrap.style.display = 'block';
        if (animWrap) animWrap.style.display = 'block';
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.MobilityEngine.init);
  } else {
    window.MobilityEngine.init();
  }
})();
