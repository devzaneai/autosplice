interface StatusMessageProps {
  readonly message: string | null;
  readonly type: "info" | "error" | "success";
}

export const StatusMessage = ({ message, type }: StatusMessageProps) => {
  if (!message) return null;

  return (
    <div className={`status-message status-${type}`}>
      {message}
    </div>
  );
};
