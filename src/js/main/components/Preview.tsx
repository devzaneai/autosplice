import { useRef, useState, useCallback } from "react";

interface PreviewSegment {
  readonly start: number;
  readonly end: number;
  readonly type: "keep" | "cut" | "camera";
  readonly label?: string;
  readonly color?: string;
}

interface PreviewProps {
  readonly segments: readonly PreviewSegment[];
  readonly totalDuration: number;
  readonly stats?: string;
}

export const Preview = ({ segments, totalDuration, stats }: PreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [zoom, setZoom] = useState(1);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const newZoom = Math.max(1, Math.min(20, zoom + (e.deltaY > 0 ? -0.5 : 0.5)));
      setZoom(newZoom);
    } else {
      const maxOffset = Math.max(0, (zoom - 1) * 100);
      const newOffset = Math.max(0, Math.min(maxOffset, scrollOffset + e.deltaX));
      setScrollOffset(newOffset);
    }
  }, [zoom, scrollOffset]);

  if (segments.length === 0) return null;

  const viewWidth = 100 * zoom;

  return (
    <div className="preview-section">
      {zoom > 1 && (
        <div className="preview-minimap">
          {segments.map((seg, i) => (
            <div
              key={i}
              className={`minimap-segment minimap-${seg.type}`}
              style={{
                left: `${(seg.start / totalDuration) * 100}%`,
                width: `${((seg.end - seg.start) / totalDuration) * 100}%`,
                backgroundColor: seg.color,
              }}
            />
          ))}
        </div>
      )}

      <div
        className="preview-bar"
        ref={containerRef}
        onWheel={handleWheel}
      >
        <div
          className="preview-inner"
          style={{
            width: `${viewWidth}%`,
            transform: `translateX(-${scrollOffset}%)`,
          }}
        >
          {segments.map((seg, i) => (
            <div
              key={i}
              className={`preview-segment preview-${seg.type}`}
              style={{
                left: `${(seg.start / totalDuration) * viewWidth}%`,
                width: `${((seg.end - seg.start) / totalDuration) * viewWidth}%`,
                backgroundColor: seg.color,
              }}
              title={seg.label || `${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s`}
            />
          ))}
        </div>
      </div>

      {stats && <div className="preview-stats">{stats}</div>}
    </div>
  );
};
