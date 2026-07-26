// Minimal inline icon set (stroke style, 24px viewBox).
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...props }: P, children: React.ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconChat = (p: P) =>
  base(p, <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
export const IconDoc = (p: P) =>
  base(
    p,
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </>,
  );
export const IconChart = (p: P) =>
  base(
    p,
    <>
      <path d="M3 3v18h18" />
      <path d="M8 17V9M13 17V5M18 17v-6" />
    </>,
  );
export const IconPlant = (p: P) =>
  base(
    p,
    <>
      <path d="M3 21h18" />
      <path d="M5 21V8l5-4v17M14 21V10l5 3v8" />
      <path d="M8 10h.01M8 13h.01M8 16h.01" />
    </>,
  );
export const IconBook = (p: P) =>
  base(
    p,
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z" />
      <path d="M20 17v5H6.5a2.5 2.5 0 0 1 0-5" />
    </>,
  );
export const IconClock = (p: P) =>
  base(
    p,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  );
export const IconBell = (p: P) =>
  base(
    p,
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" />
    </>,
  );
export const IconHistory = (p: P) =>
  base(
    p,
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </>,
  );
export const IconNewChat = (p: P) =>
  base(
    p,
    <>
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="M12 3v8M8.5 6.5 12 3l3.5 3.5" transform="rotate(180 12 7)" />
    </>,
  );
export const IconSend = (p: P) =>
  base(p, <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />);
export const IconUploadFlask = (p: P) =>
  base(
    p,
    <>
      <path d="M10 2v6L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8V2" />
      <path d="M8.5 2h7M7 15h10" />
    </>,
  );
export const IconCheckSquare = (p: P) =>
  base(
    p,
    <>
      <path d="M9 11.5 11.5 14 16 9" />
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </>,
  );
export const IconRefresh = (p: P) =>
  base(
    p,
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
      <path d="M21 3v5h-5" />
    </>,
  );
export const IconX = (p: P) => base(p, <path d="M18 6 6 18M6 6l12 12" />);
export const IconPencil = (p: P) =>
  base(
    p,
    <>
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
    </>,
  );
export const IconTrash = (p: P) =>
  base(
    p,
    <>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </>,
  );
export const IconDots = (p: P) =>
  base(
    p,
    <>
      <circle cx="12" cy="5" r="0.9" fill="currentColor" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
      <circle cx="12" cy="19" r="0.9" fill="currentColor" />
    </>,
  );
export const IconChevronL = (p: P) => base(p, <path d="m15 18-6-6 6-6" />);
export const IconChevronR = (p: P) => base(p, <path d="m9 6 6 6-6 6" />);
export const IconChevronD = (p: P) => base(p, <path d="m6 9 6 6 6-6" />);
export const IconMinus = (p: P) => base(p, <path d="M5 12h14" />);
export const IconPlus = (p: P) => base(p, <path d="M12 5v14M5 12h14" />);
export const IconDownload = (p: P) =>
  base(
    p,
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </>,
  );
export const IconExpand = (p: P) =>
  base(
    p,
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18" />
    </>,
  );
export const IconSave = (p: P) =>
  base(
    p,
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </>,
  );
export const IconPdf = ({ size = 22, ...props }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      fill="#fee2e2"
      stroke="#dc2626"
      strokeWidth="1.5"
    />
    <path d="M14 2v6h6" stroke="#dc2626" strokeWidth="1.5" />
    <text x="7" y="17" fontSize="6" fontWeight="700" fill="#dc2626">
      PDF
    </text>
  </svg>
);
export const IconLeaf = ({ size = 26, ...props }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" {...props}>
    <path d="M6 4l7 12-3 8L4 12z" fill="#4ade80" />
    <path d="M26 4l-7 12 3 8 6-12z" fill="#16a34a" />
    <path d="M16 10l4 7-4 9-4-9z" fill="#86efac" />
  </svg>
);
