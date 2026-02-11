import React from "react";

export interface PanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** Layout direction for child elements */
  direction?: "row" | "column";
  /** Gap between child elements in pixels */
  gap?: number;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  children,
  className,
  direction = "column",
  gap = 10,
}) => {
  const containerStyle: React.CSSProperties = {
    border: "1px solid var(--rau-border, #3a3a5c)",
    borderRadius: "var(--rau-radius, 6px)",
    background: "var(--rau-surface, #252540)",
    overflow: "hidden",
    fontFamily: "var(--rau-font-family, sans-serif)",
    fontSize: "var(--rau-font-size, 11px)",
    color: "var(--rau-text, #e0e0e0)",
  };

  const titleStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderBottom: "1px solid var(--rau-border, #3a3a5c)",
    color: "var(--rau-text-dim, #8888aa)",
    fontSize: "calc(var(--rau-font-size, 11px) * 0.9)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  const bodyStyle: React.CSSProperties = {
    padding: 10,
    display: "flex",
    flexDirection: direction,
    gap,
    flexWrap: "wrap",
    alignItems: direction === "row" ? "flex-start" : "stretch",
  };

  return (
    <div style={containerStyle} className={className}>
      {title && <div style={titleStyle}>{title}</div>}
      <div style={bodyStyle}>{children}</div>
    </div>
  );
};
