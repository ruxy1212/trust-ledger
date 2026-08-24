import React from 'react';

interface MilestoneProgressProps {
  /** Total number of milestones in the contract */
  totalMilestones: number;
  /** Number of completed milestones (or array of completed milestone indices) */
  completed: number;
  /** Optional container class name */
  className?: string;
  /** Optional title label override */
  label?: string;
}

export const MilestoneProgress: React.FC<MilestoneProgressProps> = ({
  totalMilestones,
  completed,
  className = '',
}) => {
  const milestoneCount = Math.max(1, totalMilestones);
  const completedCount = Math.min(completed, milestoneCount);
  const percentage = Math.round((completedCount / milestoneCount) * 100);

  return (
    <div className={`w-full font-sans ${className}`}>
      {/* Header Info */}
      <div className="flex items-center justify-between mb-3 text-xs tracking-wider uppercase">
        <div className="font-mono font-medium text-(--color-alter-primary)">
          <span className="text-(--color-accent)">{completedCount}</span>
          <span className="text-(--color-alter-muted)"> / </span>
          <span>{milestoneCount}</span>
          <span className="ml-2 text-(--color-alter-muted)">({percentage}%)</span>
        </div>
      </div>

      {/* Track & Steps Bar */}
      <div className="relative p-1.5 rounded-xl bg-(--color-surface) border border-(--color-border) shadow-inner">
        {/* Fill Line Background Track */}
        <div className="absolute top-1/2 left-4 right-4 h-1 -translate-y-1/2 bg-(--color-border) rounded-full z-0" />

        {/* Dynamic Glow Progress Bar */}
        <div
          className="absolute top-1/2 left-4 h-1 -translate-y-1/2 bg-linear-to-r from-(--color-primary) to-(--color-accent) rounded-full transition-all duration-500 ease-out z-0"
          style={{
            width: `calc(${Math.max(0, completedCount - 1) / Math.max(1, milestoneCount - 1) * 100}% - 32px * ${Math.max(0, completedCount - 1) / Math.max(1, milestoneCount - 1)})`
          }}
        />

        {/* Milestone Nodes Container */}
        <div className="relative z-10 flex items-center justify-between">
          {Array.from({ length: milestoneCount }).map((_, idx) => {
            const isCompleted = idx < completedCount;
            const isCurrent = idx === completedCount;

            return (
              <div key={idx} className="relative flex flex-col items-center group">
                {/* Milestone Circle/Node */}
                <div
                  className={`
                    w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold transition-all duration-300
                    ${
                      isCompleted
                        ? 'bg-(--color-accent) text-[#07080f] shadow-[0_0_12px_var(--color-accent-glow)]'
                        : isCurrent
                        ? 'bg-(--color-surface) text-(--color-primary-hover) border-2 border-(--color-primary) shadow-[0_0_12px_var(--color-primary-glow)] animate-pulse'
                        : 'bg-(--color-elevated) text-(--color-alter-muted) border border-(--color-border)'
                    }
                  `}
                >
                  {isCompleted ? (
                    <span>✅</span>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Hover Tooltip / Status */}
                <div className="absolute bottom-9 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 whitespace-nowrap">
                  <div className="px-2.5 py-1 text-[10px] font-mono rounded-md bg-(--color-overlay) border border-(--color-border-bright) text-(--color-alter-primary) shadow-md">
                    {isCompleted ? `Milestone ${idx + 1} Complete` : isCurrent ? `Milestone ${idx + 1} In Progress` : `Milestone ${idx + 1} Locked`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
