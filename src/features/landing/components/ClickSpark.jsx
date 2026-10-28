/* eslint-disable react/prop-types -- see FeedbackForm.jsx:1 for the convention. */

// ---------------------------------------------------------------------------
// VENDORED, DO NOT REIMPLEMENT.
//
// Source: https://reactbits.dev/r/ClickSpark-JS-TW.json, .files[0].content
//   -> ClickSpark/ClickSpark.jsx. Fetched 2026-10-04. Upstream is 145
//   lines. Zero dependencies, and it does not import motion.
//
// CHANGES FROM UPSTREAM, the complete list:
//   1. `sparkColor`'s default was a white hex literal. Gate rule 01a forbids
//      colour literals in src/ and the rule is enforcing with no allowlist, so the
//      default is now an empty string, which makes the canvas ignore the
//      assignment rather than painting white. Both call sites pass a token, so the
//      default is unreachable either way.
//   2. This banner and the repo's lint header.
//   3. `...rest` is accepted and spread onto the root div. Four call sites pass a
//      host `style` (position: fixed at the press point, pointer-events: none)
//      that upstream silently drops, so the root kept `relative w-full h-full`
//      inside an auto-height parent: a zero-height box, therefore a zero-height
//      canvas and nothing to paint on. The spread is placed BEFORE the component's
//      own className and onClick so a caller cannot clobber the layout or the
//      trigger; the only prop in use today is `style`. The fifth call site,
//      StageBus, wraps children instead and passes no style.
//
// NOT CHANGED, and reported rather than quietly fixed:
//
//   THE rAF LOOP IS PERPETUAL. Line 108/111 re-arms unconditionally on every
//   frame, so this runs continuously from mount to unmount and calls
//   `ctx.clearRect` on each frame even with zero live sparks: it never idles.
//   The mitigation is at the call site: each of the five callers mounts it only
//   where `(hover: hover) and (pointer: fine)` matches and reduced motion is off,
//   via the `canSpark` gate in Accordion, CtaFinal, Galeria, Registro and
//   StageBus, so a phone and a reduced-motion visitor never start it at all.
//   Making the loop event driven would be a behavioural change to vendored source
//   and was not in scope.
//
//   THE TRIGGER IS `onClick`, NOT POINTER-DOWN. Apple §1 wants feedback on press.
//   The burst therefore lands one event late, roughly 50 to 150ms after the
//   finger lands, which is a real miss and not something the call site can fix
//   because the handler is internal. The press-scale feedback that IS fixable is
//   applied directly to the buttons: the `PRESS` constant in Header, Hero,
//   StageBus, Galeria and Accordion, and in SpecularButton.
//
//   NO REDUCED-MOTION HANDLING UPSTREAM. Handled at the call site, same as the
//   canvas question above.
// ---------------------------------------------------------------------------

'use client';

import { useRef, useEffect, useCallback } from 'react';

const ClickSpark = ({
  sparkColor = '',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1.0,
  children, ...rest
}) => {
  const canvasRef = useRef(null);
  const sparksRef = useRef([]);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    let resizeTimeout;

    const resizeCanvas = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 100);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(parent);

    resizeCanvas();

    return () => {
      ro.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, []);

  const easeFunc = useCallback(
    t => {
      switch (easing) {
        case 'linear':
          return t;
        case 'ease-in':
          return t * t;
        case 'ease-in-out':
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default:
          return t * (2 - t);
      }
    },
    [easing]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationId;

    const draw = timestamp => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sparksRef.current = sparksRef.current.filter(spark => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) {
          return false;
        }

        const progress = elapsed / duration;
        const eased = easeFunc(progress);

        const distance = eased * sparkRadius * extraScale;
        const lineLength = sparkSize * (1 - eased);

        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        return true;
      });

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration, easeFunc, extraScale]);

  const handleClick = e => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const now = performance.now();
    const newSparks = Array.from({ length: sparkCount }, (_, i) => ({
      x,
      y,
      angle: (2 * Math.PI * i) / sparkCount,
      startTime: now
    }));

    sparksRef.current.push(...newSparks);
  };

  return (
    <div {...rest} className="relative w-full h-full" onClick={handleClick}>
      <canvas ref={canvasRef} className="w-full h-full block absolute top-0 left-0 select-none pointer-events-none" />
      {children}
    </div>
  );
};

export default ClickSpark;
