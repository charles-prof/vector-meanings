import { useState, useEffect } from 'react';

const STORAGE_KEY = 'vector-meanings-progress';

export function useProgress() {
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setCompletedSteps(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load progress', e);
      }
    }
  }, []);

  const markCompleted = (stepId: string) => {
    setCompletedSteps((prev) => {
      if (prev.includes(stepId)) return prev;
      const next = [...prev, stepId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const isCompleted = (stepId: string) => completedSteps.includes(stepId);

  const resetProgress = () => {
    setCompletedSteps([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    completedSteps,
    markCompleted,
    isCompleted,
    resetProgress,
    totalCompleted: completedSteps.length,
  };
}
