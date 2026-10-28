/* eslint-disable react/prop-types */
// spotlightCard.jsx — SpotlightCard, ported from the reference source
// (react-bits `src/ts-tailwind/Components/SpotlightCard/SpotlightCard.jsx`).
//
// DEVIATION (forced by rules 01a/01b of scripts/check-visual-contract.sh): the
// reference defaults the spotlight to a hardcoded near-white at 25% alpha and
// paints the shell with two default-palette utilities. The colour prop keeps
// its name, its position and its arity and now holds a TOKEN name, resolved
// through colors.js and given its alpha by withAlpha(); the shell utilities
// become the equivalent cem tokens — base fill under an elevated border, which
// is the same one-step-up edge the reference gets from its own pair. No
// colour-function syntax exists in this file. Recorded in DESIGN.md.

import React, { useRef, useState } from 'react';
import { useTokenColors, withAlpha } from './colors.js';

const SpotlightCard = ({
  children,
  className = '',
  spotlightColor = 'text'
}) => {
  const divRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const { spot } = useTokenColors({ spot: spotlightColor });

  const handleMouseMove = (e) => {
    if (!divRef.current || isFocused) return;

    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(0.6);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => {
    setOpacity(0.6);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-3xl border border-cem-elevated bg-cem-base overflow-hidden p-8 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-in-out"
        style={{
          opacity,
          // The reference reads the whole paint — colour plus alpha — out of the
          // prop; the prop carries the hue now, so the reference's 25% alpha
          // lives here instead, and the layer waits for the probe to land.
          background: spot
            ? `radial-gradient(circle at ${position.x}px ${position.y}px, ${withAlpha(spot, 0.25)}, transparent 80%)`
            : undefined
        }}
      />
      {children}
    </div>
  );
};

export default SpotlightCard;
export { SpotlightCard };