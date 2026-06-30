export const brand = {
  productName: "Aptly",
  positioning: "Structured interview infrastructure for modern hiring teams.",
} as const;

export const designTokens = {
  colors: {
    ink: "#111827",
    slate: "#374151",
    muted: "#6B7280",
    border: "#E5E7EB",
    surface: "#FFFFFF",
    canvas: "#F8FAFC",
    softCanvas: "#F3F4F6",
    signalBlue: "#2563EB",
    signalBlueHover: "#1D4ED8",
    signalBlueSoft: "#EFF6FF",
    evergreen: "#047857",
    evergreenSoft: "#ECFDF5",
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
    info: "#0284C7",
  },
  spacing: {
    micro: "0.25rem",
    control: "0.5rem",
    group: "0.75rem",
    standard: "1rem",
    section: "1.5rem",
    layout: "2rem",
    page: "3rem",
  },
  radius: {
    xs: "0.125rem",
    sm: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
  },
  motion: {
    instant: "80ms",
    quick: "140ms",
    base: "180ms",
    deliberate: "240ms",
  },
  zIndex: {
    header: 30,
    sidebar: 40,
    overlay: 50,
    modal: 60,
    toast: 70,
  },
} as const;
