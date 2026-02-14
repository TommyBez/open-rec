import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Annotation } from "../../../types/project";

interface AnnotationOverlayLayerProps {
  annotations: Annotation[];
  selectedAnnotationId?: string | null;
  getAnnotationRenderPosition: (annotation: Annotation) => {
    isDragging: boolean;
    x: number;
    y: number;
    widthNormalized: number;
    heightNormalized: number;
  };
  onAnnotationPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    annotation: Annotation
  ) => void;
}

export function AnnotationOverlayLayer({
  annotations,
  selectedAnnotationId,
  getAnnotationRenderPosition,
  onAnnotationPointerDown,
}: AnnotationOverlayLayerProps) {
  return (
    <>
      {annotations.map((annotation) => {
        const mode = annotation.mode ?? "outline";
        const arrowStroke = Math.max(2, annotation.thickness);
        const isSelected = selectedAnnotationId === annotation.id;
        const { x, y, widthNormalized, heightNormalized } =
          getAnnotationRenderPosition(annotation);

        const style: CSSProperties = {
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: `${widthNormalized * 100}%`,
          height: `${heightNormalized * 100}%`,
          borderStyle: "solid",
          borderColor:
            mode === "blur"
              ? "rgba(255,255,255,0.85)"
              : mode === "text" || mode === "arrow"
              ? "transparent"
              : annotation.color,
          borderWidth:
            mode === "text" || mode === "arrow"
              ? "0px"
              : `${Math.max(1, annotation.thickness)}px`,
          opacity: Math.max(0.1, Math.min(1, annotation.opacity)),
          boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
          backdropFilter: mode === "blur" ? "blur(8px)" : undefined,
          backgroundColor: mode === "blur" ? "rgba(0,0,0,0.15)" : "transparent",
          cursor: isSelected ? "grab" : "default",
        };

        return (
          <div
            key={annotation.id}
            className={isSelected ? "pointer-events-auto absolute" : "pointer-events-none absolute"}
            style={style}
            onPointerDown={(event) => onAnnotationPointerDown(event, annotation)}
          >
            {mode === "arrow" && (
              <>
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: "78%",
                    height: `${arrowStroke}px`,
                    backgroundColor: annotation.color,
                  }}
                />
                <div
                  className="absolute right-0 top-1/2 -translate-y-1/2"
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: `${arrowStroke * 1.6}px solid transparent`,
                    borderBottom: `${arrowStroke * 1.6}px solid transparent`,
                    borderLeft: `${arrowStroke * 2.6}px solid ${annotation.color}`,
                  }}
                />
              </>
            )}
            {annotation.text?.trim() && (
              <span className="absolute left-1 top-1 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {annotation.text}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
