/**
 * MOBILITY ENGINE - Motor Biomecánico Vectorial 2D (60 FPS)
 * 8 Ejercicios de Movilidad Articular Especializada para Corredores y Ciclistas
 * Modelos de Atleta Mujer y Hombre, Telemetría Articular (ROM), Mapeo de Cápsula y Fascia, y Exportador WebM
 * Repositorio: Ejercicios-gomas - Elena Benito Cases
 */

(function () {
  'use strict';

  // --- ESTADO GLOBAL DE MOVILIDAD ---
  const state = {
    gender: 'female', // 'female' | 'male'
    speed: 1.0,
    isLooping: true,
    activeMasterMob: 1,
    masterIsPlaying: true,
    masterProgress: 0,
    cardPlayers: {}, // { [mobId]: { isPlaying, progress, viewMode, gender } }
    lastTimestamp: performance.now(),
    cycleDurationMs: 6000 // 6 segundos por ciclo completo de movilidad
  };

  // --- PALETA ANATÓMICA ---
  function getPalette(gender) {
    const isFem = gender === 'female';
    return {
      isFem,
      skin: isFem ? '#f6c3a5' : '#e8b08d',
      skinShadow: isFem ? '#e0a385' : '#cf9370',
      hair: isFem ? '#381e11' : '#1e293b',
      top: isFem ? '#0284c7' : '#0369a1',
      topAccent: isFem ? '#38bdf8' : '#7dd3fc',
      bottom: isFem ? '#0f172a' : '#1e293b',
      bottomAccent: isFem ? '#38bdf8' : '#64748b',
      shoeBase: '#ffffff',
      shoeSole: '#0f172a',
      shoeAccent: isFem ? '#38bdf8' : '#f59e0b',
      capsuleGlow: 'rgba(239, 68, 68, 0.75)',
      fasciaStretch: 'rgb(239, 68, 68)',
      fasciaRelax: 'rgb(245, 158, 11)',
      stabilizer: '#10b981',
      romArc: '#38bdf8'
    };
  }

  // --- CINEMÁTICA Y CURVA DE MOVILIDAD ---
  // Fase 1: Entrada gradual al rango de movimiento (0.00 - 0.40)
  // Fase 2: Sostenimiento y respiración en rango articular óptimo (0.40 - 0.65)
  // Fase 3: Retorno fluido controlado (0.65 - 1.00)
  function calcKinematics(prog) {
    let tNorm = 0;
    let phase = 'Apertura articular';
    let phaseColor = '#f59e0b';

    if (prog <= 0.40) {
      const t = prog / 0.40;
      tNorm = t * t * (3 - 2 * t);
      phase = 'Entrada al rango (ROM)';
      phaseColor = '#f59e0b';
    } else if (prog <= 0.65) {
      tNorm = 1.0;
      phase = 'Máxima elongación y lubricación';
      phaseColor = '#ef4444';
    } else {
      const t = (prog - 0.65) / 0.35;
      tNorm = 1.0 - (t * t * (3 - 2 * t));
      phase = 'Retorno fluido';
      phaseColor = '#10b981';
    }

    return { tNorm, phase, phaseColor };
  }

  // --- ELEMENTOS ANATÓMICOS REUTILIZABLES ---
  function drawSneaker(ctx, x, y, angle, length, pal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = pal.shoeSole;
    ctx.beginPath();
    ctx.roundRect(-length * 0.25, 1, length * 1.3, 5, 2);
    ctx.fill();
    ctx.fillStyle = pal.shoeBase;
    ctx.beginPath();
    ctx.roundRect(-length * 0.2, -3, length * 1.25, 4, 1);
    ctx.fill();
    ctx.fillStyle = pal.bottom;
    ctx.beginPath();
    ctx.moveTo(-length * 0.15, -3);
    ctx.lineTo(length * 0.95, -3);
    ctx.lineTo(length * 0.75, -11);
    ctx.lineTo(length * 0.2, -11);
    ctx.lineTo(-length * 0.15, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHead(ctx, x, y, radius, facingDir, pal) {
    ctx.save();
    // Pelo
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.arc(x, y - 2, radius + 2, 0, Math.PI * 2);
    ctx.fill();
    if (pal.isFem) {
      // Coleta dinámica
      ctx.beginPath();
      ctx.ellipse(x - facingDir * (radius + 6), y - 2, 6, 12, facingDir * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rostro
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.arc(x + facingDir * 2, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawJointCapsuleGlow(ctx, x, y, radius, tNorm, label) {
    ctx.save();
    const glowRadius = radius + tNorm * 8;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, glowRadius);
    grad.addColorStop(0, `rgba(239, 68, 68, ${0.8 + tNorm * 0.2})`);
    grad.addColorStop(0.5, `rgba(245, 158, 11, ${0.4 + tNorm * 0.3})`);
    grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo articular
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();

    if (label) {
      ctx.fillStyle = '#fee2e2';
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(label, x + 10, y - 6);
    }
    ctx.restore();
  }

  function drawRomArc(ctx, cx, cy, radius, startAng, endAng, currentDeg) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAng, endAng);
    ctx.stroke();

    // Etiqueta flotante con grados
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    const midAng = (startAng + endAng) / 2;
    const tx = cx + Math.cos(midAng) * (radius + 14);
    const ty = cy + Math.sin(midAng) * (radius + 14);
    ctx.fillText(`${Math.round(currentDeg)}°`, tx - 10, ty + 4);
    ctx.restore();
  }

  // --- CATÁLOGO DE LOS 8 EJERCICIOS DE MOVILIDAD PARA CORREDORES Y CICLISTAS ---
  const MOBILITIES = [
    {
      id: 1,
      slug: 'dorsiflexion-tobillo-pared',
      name: 'Dorsiflexión de Tobillo en Carga (Knee-to-Wall)',
      target: 'Articulación tibioperoneoastragalina y sóleo',
      category: 'tobillo',
      tagBadge: '🏃 Corredores & 🚴 Ciclistas',
      angleName: 'Dorsiflexión de tobillo',
      angleMin: 90,
      angleMax: 125,
      romTarget: '≥ 10-12 cm pared',
      clinicalFocus: 'Absorción de impacto en carrera y punto muerto inferior en pedaleo',
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.82;
        const wallX = w * 0.78;

        // Suelo y Pared
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.1, groundY, w * 0.8, 6);
        ctx.fillStyle = '#475569';
        ctx.fillRect(wallX, groundY - 180, 8, 180);

        const footX = w * 0.58;
        const footY = groundY;
        // Rodilla viaja hacia adelante superando los dedos hacia la pared
        const kneeX = footX + 10 + tNorm * 52;
        const kneeY = groundY - 55 - tNorm * 10;
        const hipX = w * 0.40 + tNorm * 22;
        const hipY = groundY - 110;
        const shoulderX = hipX + 10;
        const shoulderY = hipY - 60;

        // Pierna trasera (estabilizadora en estiramiento)
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(hipX - 10, hipY);
        ctx.lineTo(w * 0.28, groundY - 45);
        ctx.lineTo(w * 0.22, groundY);
        ctx.stroke();
        drawSneaker(ctx, w * 0.20, groundY - 2, 0, 16, pal);

        // Pierna activa delantera
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
        drawSneaker(ctx, footX - 4, groundY - 2, 0, 18, pal);

        // Cápsula anterior del tobillo y sóleo
        drawJointCapsuleGlow(ctx, footX + 2, footY - 8, 8, tNorm, 'CÁPSULA TIBIOASTRAGALINA');

        // Arco de medición de dorsiflexión
        const deg = 90 + tNorm * 35;
        drawRomArc(ctx, footX, footY - 6, 26, -Math.PI, -Math.PI + (deg * Math.PI / 180), deg);

        // Torso apoyado con manos en la pared
        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 10, shoulderY, 20, hipY - shoulderY);
        // Brazos apoyados en pared
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(shoulderX + 6, shoulderY + 12);
        ctx.lineTo(wallX - 2, shoulderY + 20);
        ctx.stroke();
        drawHead(ctx, shoulderX + 4, shoulderY - 18, 12, 1, pal);
      }
    },
    {
      id: 2,
      slug: 'couch-stretch-psoas',
      name: 'Couch Stretch / Zancada Baja con Retroversión (Psoas e Ilíaco)',
      target: 'Psoas mayor, ilíaco y recto femoral anterior',
      category: 'cadera',
      tagBadge: '🚴 Vital Ciclistas & 🏃 Corredores',
      angleName: 'Extensión de cadera',
      angleMin: 5,
      angleMax: 25,
      romTarget: '15° a 25° extensión pura',
      clinicalFocus: 'Revierte acortamiento por sillín y permite zancada amplia sin dolor lumbar',
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.82;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.1, groundY, w * 0.8, 6);

        // Colchoneta bajo rodilla
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(w * 0.32, groundY - 4, 60, 4);

        // Posición de zancada baja
        const backKneeX = w * 0.38;
        const backKneeY = groundY - 6;
        const frontFootX = w * 0.65;
        const frontFootY = groundY;
        const frontKneeX = frontFootX - 4 + tNorm * 12;
        const frontKneeY = groundY - 50;

        // Pelvis avanza hacia adelante en retroversión activa
        const hipX = w * 0.44 + tNorm * 35;
        const hipY = groundY - 65 - tNorm * 6;
        const shoulderX = hipX - 4;
        const shoulderY = hipY - 65;

        // Pierna trasera: rodilla en suelo, pie elevado hacia atrás
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(backKneeX, backKneeY);
        ctx.lineTo(backKneeX - 28, groundY - 32);
        ctx.stroke();
        drawSneaker(ctx, backKneeX - 32, groundY - 32, 0.4, 15, pal);

        // Pierna delantera a 90°
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(frontKneeX, frontKneeY);
        ctx.lineTo(frontFootX, frontFootY);
        ctx.stroke();
        drawSneaker(ctx, frontFootX - 6, frontFootY - 2, 0, 18, pal);

        // Zona activa: Fascia del Psoas / Recto femoral anterior en tensión elongada
        drawJointCapsuleGlow(ctx, hipX - 6, hipY + 4, 10, tNorm, 'PSOAS-ILÍACO & RECTO FEMORAL');

        // Arco de extensión de cadera
        const deg = 5 + tNorm * 20;
        drawRomArc(ctx, hipX, hipY, 24, Math.PI * 0.4, Math.PI * 0.4 + (deg * Math.PI / 180), deg);

        // Torso vertical orgulloso
        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 10, shoulderY, 20, hipY - shoulderY);
        drawHead(ctx, shoulderX + 2, shoulderY - 18, 12, 1, pal);
      }
    },
    {
      id: 3,
      slug: 'rotaciones-cadera-90-90',
      name: 'Rotaciones de Cadera 90/90 (Shin Box Switches)',
      target: 'Cápsula coxofemoral en rotación interna y externa',
      category: 'cadera',
      tagBadge: '🏃 Cintilla iliotibial & 🚴 Alineación rodilla',
      angleName: 'Rotación interna / externa',
      angleMin: 20,
      angleMax: 45,
      romTarget: '45° externa / 35° interna',
      clinicalFocus: 'Previene síndrome de cintilla iliotibial y evita que la rodilla colapse',
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.78;
        const centerX = w * 0.50;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.1, groundY, w * 0.8, 6);

        // Sentado en suelo rotando caderas
        const pelvisX = centerX;
        const pelvisY = groundY - 26;
        const torsoY = pelvisY - 60;

        // Transición de rotación 90/90: ángulo de piernas cambia dinámicamente
        const rotShift = (tNorm - 0.5) * 60;
        const leftKneeX = centerX - 55 + rotShift * 0.5;
        const leftKneeY = groundY - 12;
        const rightKneeX = centerX + 45 + rotShift * 0.5;
        const rightKneeY = groundY - 12;

        // Piernas en suelo en L
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(pelvisX - 10, pelvisY);
        ctx.lineTo(leftKneeX, leftKneeY);
        ctx.lineTo(leftKneeX + 35, groundY - 4);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pelvisX + 10, pelvisY);
        ctx.lineTo(rightKneeX, rightKneeY);
        ctx.lineTo(rightKneeX + 30, groundY - 4);
        ctx.stroke();

        // Cápsula de rotación en ambas caderas
        drawJointCapsuleGlow(ctx, pelvisX - 12, pelvisY + 2, 9, tNorm, 'ROTACIÓN INTERNA');
        drawJointCapsuleGlow(ctx, pelvisX + 12, pelvisY + 2, 9, 1 - tNorm, 'ROTACIÓN EXTERNA');

        // Torso erguido sin apoyarse con manos
        ctx.fillStyle = pal.top;
        ctx.fillRect(pelvisX - 11, torsoY, 22, pelvisY - torsoY);
        drawHead(ctx, pelvisX, torsoY - 16, 12, 1, pal);

        const deg = 20 + tNorm * 25;
        drawRomArc(ctx, pelvisX, pelvisY, 28, -Math.PI * 0.8, -Math.PI * 0.8 + (deg * Math.PI / 180), deg);
      }
    },
    {
      id: 4,
      slug: 'worlds-greatest-stretch',
      name: 'El Mayor Estiramiento del Mundo (World’s Greatest Stretch)',
      target: 'Cadera, columna torácica, isquiotibiales y tobillos',
      category: 'columna',
      tagBadge: '⭐ Ejercicio Rey del Calentamiento Dinámico',
      angleName: 'Rotación torácica y apertura',
      angleMin: 15,
      angleMax: 80,
      romTarget: '70° a 80° rotación torácica',
      clinicalFocus: 'Disocia cintura escapular y pélvica; apertura total de la cadena anterior y posterior',
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.82;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.08, groundY, w * 0.84, 6);

        // Zancada profunda
        const frontFootX = w * 0.62;
        const frontFootY = groundY;
        const frontKneeX = frontFootX - 8;
        const frontKneeY = groundY - 48;
        const backFootX = w * 0.22;
        const backFootY = groundY;
        const hipX = w * 0.44;
        const hipY = groundY - 46;

        // Pierna trasera estirada con talón elevado
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(w * 0.32, groundY - 26);
        ctx.lineTo(backFootX, backFootY);
        ctx.stroke();
        drawSneaker(ctx, backFootX - 4, backFootY - 2, 0.3, 16, pal);

        // Pierna delantera
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(frontKneeX, frontKneeY);
        ctx.lineTo(frontFootX, frontFootY);
        ctx.stroke();
        drawSneaker(ctx, frontFootX - 6, frontFootY - 2, 0, 18, pal);

        // Mano de apoyo en el suelo
        const handSupportX = frontFootX - 35;
        const handSupportY = groundY;
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(hipX + 10, hipY - 20);
        ctx.lineTo(handSupportX, handSupportY);
        ctx.stroke();

        // Brazo en rotación vertical hacia el cielo
        // tNorm 0: codo abajo hacia el suelo / tNorm 1: brazo vertical apuntando al techo
        const armAng = -Math.PI * 0.2 - tNorm * Math.PI * 0.55;
        const armLen = 58;
        const rotHandX = hipX + 12 + Math.cos(armAng) * armLen;
        const rotHandY = hipY - 22 + Math.sin(armAng) * armLen;

        ctx.strokeStyle = pal.topAccent;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(hipX + 12, hipY - 22);
        ctx.lineTo(rotHandX, rotHandY);
        ctx.stroke();

        // Tórax rotando
        drawJointCapsuleGlow(ctx, hipX + 12, hipY - 20, 12, tNorm, 'ROTACIÓN TÓRAX & CADERA');

        const deg = 15 + tNorm * 65;
        drawRomArc(ctx, hipX + 12, hipY - 22, 28, -Math.PI * 0.7, -Math.PI * 0.7 + (deg * Math.PI / 180), deg);

        drawHead(ctx, hipX + 18, hipY - 34, 12, 1, pal);
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
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.82;
        const centerX = w * 0.48;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.1, groundY, w * 0.8, 6);

        // Cuadrupedia
        const kneeX = centerX - 45;
        const kneeY = groundY - 6;
        const hipX = centerX - 35;
        const hipY = groundY - 55;
        const shoulderX = centerX + 30;
        const shoulderY = groundY - 52;
        const supportHandX = shoulderX + 15;
        const supportHandY = groundY;

        // Rodillas y muslos
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(kneeX - 25, groundY);
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

        // Brazo dinámico que enhebra por debajo y luego se abre hacia el cielo
        // tNorm 0: cruzado por debajo / tNorm 1: vertical arriba hacia el cielo
        const ang = 0.8 - tNorm * 2.2;
        const armLen = 52;
        const mobHandX = shoulderX + Math.cos(ang) * armLen;
        const mobHandY = shoulderY + Math.sin(ang) * armLen;

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(mobHandX, mobHandY);
        ctx.stroke();

        drawJointCapsuleGlow(ctx, shoulderX - 4, shoulderY + 4, 10, tNorm, 'COLUMNA DORSAL T1-T12');

        const deg = 20 + tNorm * 55;
        drawRomArc(ctx, shoulderX, shoulderY, 26, -Math.PI * 0.8, -Math.PI * 0.8 + (deg * Math.PI / 180), deg);

        drawHead(ctx, shoulderX + 16, shoulderY - 14, 12, 1, pal);
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
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.50;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.1, groundY, w * 0.8, 6);

        // Pierna delantera: talón apoyado con dedos hacia arriba
        const frontHeelX = centerX + 40;
        const frontHeelY = groundY;
        const backFootX = centerX - 35;
        const backFootY = groundY;

        // Bisagra de cadera: cadera viaja hacia atrás mientras el torso desciende
        const hipX = centerX - 15 - tNorm * 22;
        const hipY = groundY - 110 + tNorm * 18;
        const shoulderX = hipX + 24 + tNorm * 15;
        const shoulderY = hipY - 60 + tNorm * 38;

        // Pierna trasera flexionada
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(hipX - 6, hipY);
        ctx.lineTo(backFootX + 10, groundY - 50);
        ctx.lineTo(backFootX, backFootY);
        ctx.stroke();
        drawSneaker(ctx, backFootX - 4, backFootY - 2, 0, 16, pal);

        // Pierna delantera recta en estiramiento
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(frontHeelX - 12, groundY - 52);
        ctx.lineTo(frontHeelX, frontHeelY);
        ctx.stroke();
        // Zapatilla con talón clavado y puntera arriba
        drawSneaker(ctx, frontHeelX - 4, frontHeelY - 2, -0.45, 18, pal);

        // Brazos barriendo hacia el pie
        const sweepHandX = frontHeelX - 12 + (1 - tNorm) * 20;
        const sweepHandY = groundY - 6 - (1 - tNorm) * 35;
        ctx.strokeStyle = pal.skin;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY + 8);
        ctx.lineTo(sweepHandX, sweepHandY);
        ctx.stroke();

        // Elongación fascial isquiotibial en rojo incandescente
        drawJointCapsuleGlow(ctx, (hipX + frontHeelX) / 2 - 4, groundY - 45, 11, tNorm, 'ISQUIOTIBIALES & FASCIA');

        // Torso en línea neutra protegida
        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 8, shoulderY, 18, hipY - shoulderY);
        drawHead(ctx, shoulderX + 8, shoulderY - 14, 12, 1, pal);

        const deg = 45 + tNorm * 40;
        drawRomArc(ctx, hipX, hipY, 26, -Math.PI * 0.6, -Math.PI * 0.6 + (deg * Math.PI / 180), deg);
      }
    },
    {
      id: 7,
      slug: 'cossack-squat-aductores',
      name: 'Sentadilla Cossack Dinámica (Movilidad Frontal de Cadera y Aductores)',
      target: 'Aductores (mayor, largo, grácil) y cápsula medial coxofemoral',
      category: 'cadera',
      tagBadge: '🏃 Prevención pubalgia & 🚴 Desbloqueo plano frontal',
      angleName: 'Apertura y flexión lateral',
      angleMin: 40,
      angleMax: 100,
      romTarget: 'Sentadilla profunda a 90°',
      clinicalFocus: 'Rompe la rigidez sagital repetitiva de la bici y estabiliza la zancada del corredor',
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.84;
        const centerX = w * 0.50;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.08, groundY, w * 0.84, 6);

        // Cossack Squat: cadera se desplaza hacia la pierna izquierda flexionada
        const leftFootX = centerX - 65;
        const rightFootX = centerX + 65;

        // tNorm 0: arriba en apertura / tNorm 1: cadera abajo en sentadilla profunda unilateral
        const squatDepth = tNorm * 52;
        const hipX = centerX - 35 - tNorm * 20;
        const hipY = groundY - 95 + squatDepth;
        const leftKneeX = leftFootX + 16;
        const leftKneeY = groundY - 55 + squatDepth * 0.45;
        const shoulderX = hipX + 8;
        const shoulderY = hipY - 58;

        // Pierna izquierda en sentadilla profunda
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(leftKneeX, leftKneeY);
        ctx.lineTo(leftFootX, groundY);
        ctx.stroke();
        drawSneaker(ctx, leftFootX - 4, groundY - 2, 0, 18, pal);

        // Pierna derecha completamente extendida con talón apoyado
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(rightFootX, groundY);
        ctx.stroke();
        drawSneaker(ctx, rightFootX - 4, groundY - 2, -0.4, 18, pal);

        // Zona medial de aductores en elongación máxima
        drawJointCapsuleGlow(ctx, (hipX + rightFootX) / 2, groundY - 35, 12, tNorm, 'COMPARTIMENTO ADUCTOR');

        // Torso erguido
        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 10, shoulderY, 20, hipY - shoulderY);
        drawHead(ctx, shoulderX + 2, shoulderY - 18, 12, 1, pal);

        const deg = 40 + tNorm * 60;
        drawRomArc(ctx, leftKneeX, leftKneeY, 24, Math.PI * 0.5, Math.PI * 0.5 + (deg * Math.PI / 180), deg);
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
      draw: function (ctx, w, h, tNorm, gender) {
        const pal = getPalette(gender);
        const groundY = h * 0.86;
        const centerX = w * 0.50;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(w * 0.1, groundY, w * 0.8, 6);

        // Pierna delantera de apoyo
        const frontFootX = centerX - 10;
        const frontFootY = groundY;
        // Pierna activa cruza por detrás
        const backCrossX = centerX + 28 + tNorm * 18;
        const backCrossY = groundY;

        // Pelvis se desplaza lateralmente hacia la derecha (lado del estiramiento)
        const hipShift = tNorm * 32;
        const hipX = centerX + 12 + hipShift;
        const hipY = groundY - 115;

        // Torso se inclina en arco en sentido opuesto (hacia la izquierda)
        const shoulderX = centerX - 8 - tNorm * 22;
        const shoulderY = hipY - 65;

        // Piernas cruzadas
        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(hipX - 14, hipY);
        ctx.lineTo(frontFootX, frontFootY);
        ctx.stroke();
        drawSneaker(ctx, frontFootX - 4, frontFootY - 2, 0, 18, pal);

        ctx.strokeStyle = pal.bottom;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(backCrossX - 6, groundY - 55);
        ctx.lineTo(backCrossX, backCrossY);
        ctx.stroke();
        drawSneaker(ctx, backCrossX - 4, backCrossY - 2, 0.25, 17, pal);

        // Brazo derecho elevándose en arco sobre la cabeza
        const armAng = -Math.PI * 0.5 - tNorm * 0.45;
        const armLen = 54;
        const handX = shoulderX + 16 + Math.cos(armAng) * armLen;
        const handY = shoulderY + Math.sin(armAng) * armLen;

        ctx.strokeStyle = pal.topAccent;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(shoulderX + 14, shoulderY + 8);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        // Toda la banda iliotibial externa en rojo térmico
        drawJointCapsuleGlow(ctx, hipX + 8, hipY + 22, 11, tNorm, 'BANDA ILIOTIBIAL (TFL)');

        ctx.fillStyle = pal.top;
        ctx.fillRect(shoulderX - 10, shoulderY, 20, hipY - shoulderY);
        drawHead(ctx, shoulderX + 4, shoulderY - 18, 12, -1, pal);

        const deg = 10 + tNorm * 20;
        drawRomArc(ctx, hipX, hipY, 28, Math.PI * 0.1, Math.PI * 0.1 + (deg * Math.PI / 180), deg);
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
    const { tNorm, phase, phaseColor } = calcKinematics(state.masterProgress);

    // Limpieza
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Fondo técnico
    drawTechGrid(ctx, rect.width, rect.height);

    // Dibujo del ejercicio
    ex.draw(ctx, rect.width, rect.height, tNorm, state.gender);

    // Actualización de HUD maestro
    updateMasterHUD(ex, tNorm, phase, phaseColor);
  }

  function drawTechGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const step = 20;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateMasterHUD(ex, tNorm, phase, phaseColor) {
    const elPhase = document.getElementById('mob-hud-phase');
    if (elPhase) {
      elPhase.textContent = phase.toUpperCase();
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
      const curSec = (state.masterProgress * 6).toFixed(1);
      elTime.textContent = `0:0${Math.floor(curSec)} / 0:06`;
    }
  }

  // Renderizado de tarjetas individuales
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

      // Actualizar medidor de ROM en tarjeta
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

  // --- API PÚBLICA DE MOVILIDAD ---
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
      }, 6100);
    },

    getMobilities: function () {
      return MOBILITIES;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.MobilityEngine.init);
  } else {
    window.MobilityEngine.init();
  }
})();
