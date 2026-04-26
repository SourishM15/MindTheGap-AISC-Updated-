import React from 'react';

interface LoadingSkeletonProps {
  variant?: 'dashboard' | 'map' | 'cards';
}

const block = 'animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800';

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ variant = 'cards' }) => {
  if (variant === 'map') {
    return (
      <div className="p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="metric-card">
              <div className={`${block} mb-4 h-4 w-28`} />
              <div className={`${block} mb-3 h-9 w-20`} />
              <div className={`${block} h-3 w-36`} />
            </div>
          ))}
        </div>
        <div className={`${block} h-[560px] w-full rounded-xl`} />
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className="surface p-6">
        <div className={`${block} mb-3 h-7 w-64`} />
        <div className={`${block} mb-6 h-4 w-48`} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="metric-card">
              <div className={`${block} mb-4 h-4 w-32`} />
              <div className={`${block} mb-3 h-8 w-24`} />
              <div className={`${block} h-3 w-40`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="metric-card">
          <div className={`${block} mb-3 h-9 w-9`} />
          <div className={`${block} mb-3 h-4 w-28`} />
          <div className={`${block} h-12 w-full`} />
        </div>
      ))}
    </div>
  );
};

export default LoadingSkeleton;
