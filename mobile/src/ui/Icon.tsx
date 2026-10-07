// El çizimi ince SVG ikon seti — frontend/components/ui/icons.tsx içindeki
// yol (path) verileri birebir korunur; react-native-svg ile çizilir.

import type { ReactNode } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Base({
  size = 20,
  color = "#475569",
  strokeWidth = 1.8,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function LogoMark(props: IconProps) {
  return (
    <Base {...props} strokeWidth={props.strokeWidth ?? 1.6}>
      <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
      <Path d="M8.5 11.5h7M8.5 8.5h4" />
    </Base>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M3.5 20.5 21 12 3.5 3.5 5 12l-1.5 8.5Z" />
      <Path d="M5 12h9" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props} strokeWidth={props.strokeWidth ?? 2.2}>
      <Path d="m4 12.5 5 5L20 6.5" />
    </Base>
  );
}

export function CheckCheckIcon(props: IconProps) {
  return (
    <Base {...props} strokeWidth={props.strokeWidth ?? 2.2}>
      <Path d="m2.5 12.5 5 5L18.5 6.5" />
      <Path d="m12 17.5 1.5 0L22.5 6.5" />
    </Base>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7.5V12l3 2" />
    </Base>
  );
}

export function RetryIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <Path d="M20 3.5V8h-4.5" />
    </Base>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7.5v5M12 16.2v.3" />
    </Base>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="m16 16 4.5 4.5" />
    </Base>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Base {...props} strokeWidth={props.strokeWidth ?? 2}>
      <Path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Base {...props} strokeWidth={props.strokeWidth ?? 2}>
      <Path d="m6 6 12 12M18 6 6 18" />
    </Base>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Base {...props} strokeWidth={props.strokeWidth ?? 2}>
      <Path d="m14.5 5.5-7 6.5 7 6.5" />
    </Base>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Base>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </Base>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Rect x="3" y="4.5" width="18" height="12" rx="2" />
      <Path d="M9 20h6M12 16.5V20" />
    </Base>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.03 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z" />
    </Base>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="m16 16 4.5-4.5L16 7M20.5 11.5H9" />
    </Base>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
      <Path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.2 15.3c1.6.7 2.8 2.2 3.3 4.2" />
    </Base>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M17 3.5a2.12 2.12 0 0 1 3 3L8 18.5l-4 1 1-4L17 3.5Z" />
    </Base>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 11v5M12 7.8v.2" />
    </Base>
  );
}