import { useCallback } from "react";

interface SliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
  readonly tooltip?: string;
  readonly onChange: (value: number) => void;
}

export const Slider = ({
  label, value, min, max, step, unit, tooltip, onChange,
}: SliderProps) => {
  return (
    <div className="slider-control" title={tooltip}>
      <div className="slider-header">
        <label>{label}</label>
        <span className="slider-value">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
};
