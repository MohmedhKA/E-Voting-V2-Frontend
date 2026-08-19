/**
 * MatrixBackground.jsx
 * Full-screen Matrix rain animation — neon green katakana + digits.
 * Fixed canvas, z-index 0, pointer-events none. Subtle opacity (0.18).
 */

import { useEffect, useRef } from 'react';

const KATAKANA = 'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴ';
const DIGITS   = '0123456789';
const CHARS    = (KATAKANA + DIGITS).split('');

const COL_WIDTH  = 20;
const FONT_SIZE  = 16;
const COLOR      = '#10b981';
const OPACITY    = 0.18;
const FADE_ALPHA = 0.05;   // rgba black overlay per frame — controls trail length

export default function MatrixBackground() {
  const canvasRef  = useRef(null);
  const rafRef     = useRef(null);
  const columnsRef = useRef([]);   // y-position (in rows) for each column

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const init = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;

      const colCount  = Math.floor(canvas.width / COL_WIDTH);
      columnsRef.current = Array.from({ length: colCount }, () =>
        // Stagger starting positions so they don't all drop together
        Math.floor(Math.random() * -(canvas.height / FONT_SIZE))
      );

      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    // Per-column speed multiplier (0.4 – 1.0 of one row per frame)
    const speeds = [];
    const initSpeeds = (count) => {
      for (let i = 0; i < count; i++) {
        speeds[i] = 0.4 + Math.random() * 0.6;
      }
    };

    init();
    initSpeeds(columnsRef.current.length);

    // Accumulate fractional advances so slower columns don't skip
    const fractional = new Float32Array(columnsRef.current.length);

    const draw = () => {
      // Fade out previous frame
      ctx.fillStyle = `rgba(0, 0, 0, ${FADE_ALPHA})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = COLOR;
      ctx.font      = `${FONT_SIZE}px monospace`;

      const cols = columnsRef.current;
      for (let i = 0; i < cols.length; i++) {
        fractional[i] = (fractional[i] || 0) + speeds[i];

        if (fractional[i] >= 1) {
          fractional[i] -= 1;

          if (cols[i] > 0) {
            const char = CHARS[Math.floor(Math.random() * CHARS.length)];
            const x    = i * COL_WIDTH;
            const y    = cols[i] * FONT_SIZE;
            ctx.fillText(char, x, y);
          }

          cols[i]++;

          // Reset column when it goes off-screen (with random delay)
          if (cols[i] * FONT_SIZE > canvas.height && Math.random() > 0.975) {
            cols[i] = 0;
            speeds[i] = 0.4 + Math.random() * 0.6;
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const handleResize = () => {
      cancelAnimationFrame(rafRef.current);
      init();
      initSpeeds(columnsRef.current.length);
      rafRef.current = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        width:         '100vw',
        height:        '100vh',
        zIndex:        0,
        pointerEvents: 'none',
        opacity:       OPACITY,
      }}
    />
  );
}
