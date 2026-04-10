import type { SVGProps } from "react";

export default function EnvIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <text
        x="12"
        y="14.1"
        textAnchor="middle"
        fill="currentColor"
        style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "-0.1px" }}
      >
        .env
      </text>
    </svg>
  );
}
