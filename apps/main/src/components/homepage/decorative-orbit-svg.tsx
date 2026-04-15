type DecorativeOrbitSVGProps = {
  className?: string;
};

export function DecorativeOrbitSVG({ className }: DecorativeOrbitSVGProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      fill="none"
      aria-hidden
      className={className}
    >
      <circle cx="160" cy="160" r="118" className="stroke-primary/25" strokeWidth="1.5" />
      <circle cx="160" cy="160" r="78" className="stroke-primary/20" strokeWidth="1.2" />
      <g className="origin-center animate-orbit-slow">
        <circle cx="278" cy="160" r="7" className="fill-primary/80" />
        <circle cx="42" cy="160" r="5" className="fill-primary/50" />
      </g>
      <g className="origin-center animate-orbit-reverse">
        <circle cx="160" cy="82" r="6" className="fill-primary/70" />
        <circle cx="160" cy="238" r="4" className="fill-primary/40" />
      </g>
      <path
        d="M100 172C120 138 172 126 210 150"
        className="stroke-primary/35 animate-draw-line"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

