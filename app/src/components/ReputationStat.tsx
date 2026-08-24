export function ReputationStat({
  completedCount,
  disputedCount,
  className = "",
}: {
  completedCount: number;
  disputedCount: number;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-sm text-alter-secondary ${className}`}
    >
      <span className="text-success">{completedCount} completed</span>
      {disputedCount > 0 && (
        <>
          {" · "}
          <span className="text-warning">{disputedCount} disputed</span>
        </>
      )}
    </span>
  );
}
