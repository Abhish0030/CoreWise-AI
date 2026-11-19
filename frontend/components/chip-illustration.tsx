export function ChipIllustration() {
  return (
    <svg
      className="chip-art"
      viewBox="0 0 360 230"
      role="img"
      aria-label="Original CoreWise processor architecture illustration"
    >
      <defs>
        <linearGradient id="chip-face" x1="0" x2="1" y2="1">
          <stop stopColor="var(--surface-elevated)" />
          <stop offset="1" stopColor="var(--surface)" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="var(--border)">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i}>
            <path d={`M${105 + i * 22} 85V${28 - (i % 2) * 18}h${i % 2 ? 48 : -48}`} />
            <path d={`M${105 + i * 22} 165v${25 + (i % 2) * 18}h${i % 2 ? -48 : 48}`} />
            <path d={`M105 ${87 + i * 14}H${42 - (i % 2) * 20}v-20`} />
            <path d={`M237 ${87 + i * 14}h${64 + (i % 2) * 18}v20`} />
          </g>
        ))}
      </g>
      <g transform="translate(110 50) rotate(12 65 65)">
        <rect
          x="-13"
          y="-13"
          width="156"
          height="156"
          rx="17"
          fill="var(--surface)"
          stroke="var(--border)"
        />
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i} stroke="var(--text-muted)" strokeWidth="3">
            <path
              d={`M${9 + i * 12} -13v-9M${9 + i * 12} 143v9M-13 ${9 + i * 12}h-9M143 ${9 + i * 12}h9`}
            />
          </g>
        ))}
        <rect
          width="130"
          height="130"
          rx="9"
          fill="url(#chip-face)"
          stroke="var(--accent-secondary)"
        />
        <path
          d="M18 90V23h37M112 40v67H75"
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth="2"
        />
        <text
          x="65"
          y="70"
          textAnchor="middle"
          fill="var(--text-primary)"
          fontFamily="Manrope,sans-serif"
          fontWeight="800"
          fontSize="23"
        >
          CW
        </text>
        <text
          x="65"
          y="89"
          textAnchor="middle"
          fill="var(--text-secondary)"
          fontSize="7"
          letterSpacing="3"
        >
          INTELLIGENCE
        </text>
      </g>
      <g fill="var(--accent-primary)">
        <circle cx="57" cy="67" r="3" />
        <circle cx="297" cy="174" r="3" />
        <circle cx="239" cy="24" r="2" />
      </g>
    </svg>
  );
}
