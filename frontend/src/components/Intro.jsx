import React, { useEffect, useState } from 'react';
import './Intro.css';

const LED_COUNT = 14;
const LED_CX = 98;
const LED_CY = 196;
const LED_RADIUS = 36;

const LED_DOTS = Array.from({ length: LED_COUNT }, (_, i) => {
  const angle = (i / LED_COUNT) * Math.PI * 2;
  const x = +(LED_CX + LED_RADIUS * Math.cos(angle)).toFixed(1);
  const y = +(LED_CY + LED_RADIUS * Math.sin(angle)).toFixed(1);
  const delay = (0.8 + i * 0.025).toFixed(2);
  return { id: i, cx: x, cy: y, delay };
});

export default function Intro({ onComplete }) {
  const [isCut, setIsCut] = useState(false);
  const [isHide, setIsHide] = useState(false);

  useEffect(() => {
    const CUT_AT = 3200;
    const BRAND_SETTLE = 800;
    const BRAND_HOLD = 1600;
    const FADE_DURATION = 700;

    const t1 = setTimeout(() => {
      setIsCut(true);
    }, CUT_AT);

    const t2 = setTimeout(() => {
      setIsHide(true);
    }, CUT_AT + BRAND_SETTLE + BRAND_HOLD);

    const t3 = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, CUT_AT + BRAND_SETTLE + BRAND_HOLD + FADE_DURATION);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div id="intro" className={isHide ? 'hide' : ''}>
      <div className={`intro-container ${isCut ? 'shake' : ''}`}>
        <div className="paper" />

        <div className={`intro-cam ${isCut ? 'exit' : ''}`}>
          <svg viewBox="0 0 340 300">
            <path className="cam-line ear" d="M 58 148 L 38 160 L 55 174" />
            <path className="cam-line hood" d="M 46 152 L 128 92 L 268 84" />
            <path
              className="cam-line body"
              d="M 62 158 L 132 102 L 270 92 Q 292 91 293 111 L 296 164 Q 297 184 277 190 L 158 220 L 108 238 Q 82 246 66 226 L 62 158 Z"
            />
            {/* Outer lens ring: r=48, circumference ~302 */}
            <circle className="cam-line lensRing" cx="98" cy="196" r="48" />
            {/* Lens core: r=24, circumference ~151 */}
            <circle className="cam-line lensCore" cx="98" cy="196" r="24" />

            {/* IR-LED ring dots */}
            <g className="leds">
              {LED_DOTS.map((dot) => (
                <circle
                  key={dot.id}
                  cx={dot.cx}
                  cy={dot.cy}
                  r="2.4"
                  className="dot"
                  style={{ animation: `dotIn 0.12s ease forwards ${dot.delay}s` }}
                />
              ))}
            </g>

            <path className="cam-line neck" d="M 178 224 L 196 246" />
            <path
              className="cam-line cyl"
              d="M 188 246 Q 188 260 210 260 Q 232 260 232 246 L 232 272 Q 232 286 210 286 Q 188 286 188 272 Z"
            />
            <path className="cam-line plate" d="M 232 252 L 278 232 L 278 300 L 232 278 Z" />

            {/* Mounting plate screw dots */}
            <circle className="dot" style={{ animation: 'dotIn 0.15s ease forwards 1.0s' }} cx="248" cy="241" r="3.2" />
            <circle className="dot" style={{ animation: 'dotIn 0.15s ease forwards 1.03s' }} cx="268" cy="238" r="3.2" />
            <circle className="dot" style={{ animation: 'dotIn 0.15s ease forwards 1.06s' }} cx="248" cy="291" r="3.2" />
            <circle className="dot" style={{ animation: 'dotIn 0.15s ease forwards 1.09s' }} cx="268" cy="294" r="3.2" />
          </svg>
        </div>

        <div className={`intro-brand ${isCut ? 'show' : ''}`}>
          <span className="letter">V</span>
          <span className="letter">I</span>
          <span className="letter">S</span>
          <span className="letter">I</span>
          <span className="letter">D</span>
          <span className="letter">I</span>
          <span className="letter">C</span>
          <span className="letter">T</span>
          <span className="rule" />
          <span className="tagline">PRESENCE INTELLIGENCE</span>
        </div>
      </div>

      <div className={`intro-flash ${isCut ? 'active' : ''}`} />
      <div className="intro-vignette" />
    </div>
  );
}
