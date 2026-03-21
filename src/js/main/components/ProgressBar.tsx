interface ProgressBarProps {
  readonly percent: number;
  readonly message: string;
  readonly visible: boolean;
}

export const ProgressBar = ({ percent, message, visible }: ProgressBarProps) => {
  if (!visible) return null;

  return (
    <div className="progress-section">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="progress-message">{message}</span>
    </div>
  );
};
