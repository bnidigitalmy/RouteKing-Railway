import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={cn("animate-pulse bg-gray-200 rounded-lg", className)} />
  );
};

export const ParcelSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-gray-50 flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="flex gap-3 items-center">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="w-32 h-4" />
            <Skeleton className="w-24 h-3" />
          </div>
        </div>
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
      
      <div className="space-y-2">
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-3/4 h-4" />
      </div>

      <div className="flex justify-between items-center pt-2">
        <div className="flex gap-2">
          <Skeleton className="w-16 h-6 rounded-full" />
          <Skeleton className="w-16 h-6 rounded-full" />
        </div>
        <Skeleton className="w-20 h-8 rounded-xl" />
      </div>
    </div>
  );
};
