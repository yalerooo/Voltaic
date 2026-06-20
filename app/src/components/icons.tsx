// Shared toolbar / action icons (stroke style, 24x24 viewBox), matching the
// FileIcon visual language. Each takes an optional size; color is inherited via
// currentColor so callers control it with CSS.

import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Go up one directory level. */
export const IconUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19V6M6 11l6-6 6 6" />
  </Svg>
);

/** Back (history). */
export const IconBack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H6M11 7l-5 5 5 5" />
  </Svg>
);

/** Home directory. */
export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11.5L12 4l8 7.5M6 10v9h12v-9M10 19v-5h4v5" />
  </Svg>
);

/** Refresh / reload. */
export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 1 0-.5 4M20 5v6h-6" />
  </Svg>
);

/** Upload (arrow into tray). */
export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16V4M7 9l5-5 5 5M5 18.5h14" />
  </Svg>
);

/** Download (arrow out of tray). */
export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v12M7 11l5 5 5-5M5 19.5h14" />
  </Svg>
);

/** Folder (filled, so a custom folder color reads vividly). */
export const IconFolder = ({ size = 16, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...rest}
  >
    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.2a2.5 2.5 0 0 1 1.9.9l.9 1.1H18.5A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
  </svg>
);

/** New folder. */
export const IconNewFolder = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h3.8l1.2 1.7H19a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17z" />
    <path d="M12 10.5v4M10 12.5h4" />
  </Svg>
);

/** Rename (pencil). */
export const IconRename = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 5.5l4 4M4 20l1-4L16 5a1.5 1.5 0 0 1 2 0l1 1a1.5 1.5 0 0 1 0 2L8 19z" />
  </Svg>
);

/** Copy (overlapping sheets). */
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="1.6" />
    <path d="M5 15H4.5A.5.5 0 0 1 4 14.5V4.5A.5.5 0 0 1 4.5 4h10a.5.5 0 0 1 .5.5V5" />
  </Svg>
);

/** Paste (clipboard). */
export const IconPaste = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 4h6v3H9zM8 5.5H5.5A1.5 1.5 0 0 0 4 7v12a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19V7a1.5 1.5 0 0 0-1.5-1.5H16" />
  </Svg>
);

/** Delete (trash). */
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v5M14 11v5" />
  </Svg>
);

/** Link / copy path. */
export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 14.5l5-5M8 11l-2 2a3.2 3.2 0 0 0 4.5 4.5l2-2M16 13l2-2A3.2 3.2 0 0 0 13.5 6.5l-2 2" />
  </Svg>
);

/** Search (magnifier). */
export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.6-3.6" />
  </Svg>
);

/** Star (favorite). Filled via currentColor when the button is active. */
export const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.9z" />
  </Svg>
);

/** Sort (descending bars). */
export const IconSort = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h13M4 12h9M4 18h5" />
  </Svg>
);

/** Collapse all (chevrons folding inward). */
export const IconCollapse = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 5l5 5 5-5M7 19l5-5 5 5" />
  </Svg>
);

/** Expand all (chevrons opening outward). */
export const IconExpand = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />
  </Svg>
);
