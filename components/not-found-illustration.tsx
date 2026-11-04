import * as React from "react";

export function NotFoundIllustration({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 680 430"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[540px] h-auto drop-shadow-sm transition-transform duration-500 hover:scale-[1.01]"
        aria-hidden="true"
      >
        <defs>
          {/* Depth shadow under the tilted phone */}
          <filter id="phoneDropShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="-2" dy="20" stdDeviation="18" floodColor="#000000" floodOpacity="0.22" />
          </filter>

          {/* Soft shadow under typography */}
          <filter id="typeDropShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#000000" floodOpacity="0.08" />
          </filter>

          {/* Screen subtle specular reflection gradient */}
          <linearGradient id="phoneScreenLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F5F5F7" />
          </linearGradient>

          <linearGradient id="phoneScreenDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#161618" />
            <stop offset="60%" stopColor="#121214" />
            <stop offset="100%" stopColor="#0B0B0D" />
          </linearGradient>

          {/* Glass glare line */}
          <linearGradient id="glassGlare" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 1. Organic Asymmetrical Soft Background Blob */}
        <path
          d="M 215,115
             C 125,140 100,230 155,305
             C 205,370 320,385 435,355
             C 545,325 580,240 540,165
             C 500,90 380,75 295,95
             Z"
          className="fill-[#F2F2F4] dark:fill-[#1A1A1E] transition-colors duration-300"
        />

        {/* 2. Bold '4' on Left (Exact Geometric Typography) */}
        <g filter="url(#typeDropShadow)">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M 228 118 H 276 V 232 H 308 V 276 H 276 V 328 H 228 V 276 H 132 V 234 L 228 118 Z 
               M 228 172 L 176 232 H 228 V 172 Z"
            className="fill-[#1A1A1C] dark:fill-[#2E2E34] transition-colors duration-300"
          />
        </g>

        {/* 3. Bold '4' on Right (Exact Geometric Typography) */}
        <g filter="url(#typeDropShadow)">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M 508 118 H 556 V 232 H 588 V 276 H 556 V 328 H 508 V 276 H 412 V 234 L 508 118 Z 
               M 508 172 L 456 232 H 508 V 172 Z"
            className="fill-[#1A1A1C] dark:fill-[#2E2E34] transition-colors duration-300"
          />
        </g>

        {/* 4. Tilted Smartphone Overlapping in Center (-6.5deg) */}
        <g transform="rotate(-6.5 342 222)" filter="url(#phoneDropShadow)">
          {/* Phone Outer Chassis / Metal Bezel */}
          <rect
            x="248"
            y="72"
            width="188"
            height="306"
            rx="36"
            className="fill-[#1C1C1E] dark:fill-[#27272A] stroke-[#2C2C30] dark:stroke-[#3F3F46]"
            strokeWidth="3.5"
          />

          {/* Outer edge highlight line */}
          <rect
            x="251"
            y="75"
            width="182"
            height="300"
            rx="33"
            className="fill-[#0F0F11] dark:fill-[#0A0A0C]"
          />

          {/* Screen Container (Reacts cleanly to dark/light theme) */}
          <rect
            x="255"
            y="79"
            width="174"
            height="292"
            rx="30"
            className="fill-white dark:fill-[#121214] transition-colors duration-300"
          />

          {/* Diagonal Glass Reflection on Screen */}
          <path
            d="M 255 110 C 255 93 268 79 285 79 H 399 C 416 79 429 93 429 110 L 429 160 L 255 210 Z"
            fill="url(#glassGlare)"
            className="pointer-events-none"
          />

          {/* Dynamic Island Pill at Top */}
          <rect
            x="317"
            y="92"
            width="50"
            height="14"
            rx="7"
            className="fill-[#0A0A0C] dark:fill-[#000000]"
          />
          {/* Front Camera dot */}
          <circle cx="355" cy="99" r="2.5" className="fill-[#1C1C1E] dark:fill-[#222224]" />
          <circle cx="330" cy="99" r="2" className="fill-[#161618] dark:fill-[#1A1A1C]" />

          {/* Dead pixel eyes: X   X */}
          {/* Left Eye */}
          <g className="stroke-[#111111] dark:stroke-[#FFFFFF] transition-colors" strokeWidth="4" strokeLinecap="round">
            <line x1="304" y1="154" x2="322" y2="172" />
            <line x1="322" y1="154" x2="304" y2="172" />
          </g>

          {/* Right Eye */}
          <g className="stroke-[#111111] dark:stroke-[#FFFFFF] transition-colors" strokeWidth="4" strokeLinecap="round">
            <line x1="362" y1="154" x2="380" y2="172" />
            <line x1="380" y1="154" x2="362" y2="172" />
          </g>

          {/* Sad downturned curved mouth */}
          <path
            d="M 326 204 Q 342 190 358 204"
            className="stroke-[#111111] dark:stroke-[#FFFFFF] transition-colors"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />

          {/* Signature AWTMods Chevron Logo in Bottom Center of Phone Screen */}
          <g transform="translate(325, 248) scale(1.1)">
            <path
              d="M16 2L3 28H10.5L16 16.5L21.5 28H29L16 2Z"
              className="fill-[#111111] dark:fill-[#FFFFFF] transition-colors"
            />
          </g>

          {/* Bottom Home Indicator Bar */}
          <rect
            x="315"
            y="357"
            width="54"
            height="3.5"
            rx="2"
            className="fill-[#D1D1D6] dark:fill-[#3A3A3C] transition-colors"
          />
        </g>

        {/* 5. Decorative Notification / Shock Marks (Top-Right Radiating Lines) */}
        <g className="stroke-[#111111] dark:stroke-[#E4E4E7] transition-colors" strokeWidth="3.5" strokeLinecap="round">
          {/* Upper ray */}
          <line x1="426" y1="72" x2="433" y2="55" />
          {/* Middle ray */}
          <line x1="440" y1="81" x2="456" y2="70" />
          {/* Lower ray */}
          <line x1="444" y1="98" x2="461" y2="98" />
        </g>
      </svg>
    </div>
  );
}
