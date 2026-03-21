"use client";

import { useState, useEffect, useCallback } from "react";

export default function CustomCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [hovering, setHovering] = useState(false);
  const [visible, setVisible] = useState(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
    if (!visible) setVisible(true);
  }, [visible]);

  const handleMouseOver = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("a") ||
      target.closest("button") ||
      target.closest("[role='button']") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select")
    ) {
      setHovering(true);
    } else {
      setHovering(false);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    // Only enable on devices with fine pointer (no touch)
    const mql = window.matchMedia("(pointer: fine)");
    if (!mql.matches) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseOver, handleMouseLeave]);

  if (!visible) return null;

  return (
    <div
      className={`custom-cursor ${hovering ? "cursor-hover" : ""}`}
      style={{ left: pos.x, top: pos.y }}
    />
  );
}
