import { useState, useEffect } from 'react';
import { LessonSidebar } from './LessonSidebar';
import { LessonContent } from './LessonContent';
import { Sandbox } from './Sandbox';
import { LESSONS } from '../lib/lessons';
import { useProgress } from '../hooks/useProgress';
import { useAI } from '../context/AIContext';
import { Sparkles, Database, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function CodelabRunner() {
  const [activeLessonId, setActiveLessonId] = useState('00');
  const [isSandboxActive, setIsSandboxActive] = useState(false);
  const { isCompleted, markCompleted, totalCompleted } = useProgress();
  const { status, modelProgress, isModelLoaded } = useAI();

  const currentLesson = LESSONS.find(l => l.id === activeLessonId)!;
  const currentIndex = LESSONS.findIndex(l => l.id === activeLessonId);

  const handleNext = () => {
    if (currentIndex < LESSONS.length - 1) {
      setActiveLessonId(LESSONS[currentIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setActiveLessonId(LESSONS[currentIndex - 1].id);
    }
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-[#fafafa] overflow-hidden">
      {/* Sidebar - Fixed width */}
      <LessonSidebar 
        activeLessonId={activeLessonId}
        onSelectLesson={(id) => {
          setActiveLessonId(id);
          setIsSandboxActive(false);
        }}
        isCompleted={isCompleted}
        totalCompleted={totalCompleted}
        isSandboxActive={isSandboxActive}
        onShowSandbox={() => setIsSandboxActive(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Strip */}
        <header className="h-16 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-10">
           <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                 <Sparkles className="w-5 h-5" />
              </div>
              <h1 className="font-bold tracking-tight">
                 {isSandboxActive ? 'Interactive Sandbox' : `Step ${currentLesson.id}: ${currentLesson.title}`}
              </h1>
           </div>

           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                 <Database className={cn("w-3.5 h-3.5", isModelLoaded ? "text-emerald-400" : "text-amber-400 animate-pulse")} />
                 <span>{status}</span>
                 {!isModelLoaded && modelProgress > 0 && (
                   <span className="text-indigo-400 ml-1">{Math.round(modelProgress)}%</span>
                 )}
              </div>
           </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          {isSandboxActive ? (
            <Sandbox />
          ) : (
            <LessonContent 
              id={activeLessonId}
              filePath={currentLesson.filePath}
              isCompleted={isCompleted(activeLessonId)}
              onComplete={() => {
                markCompleted(activeLessonId);
                // Optionally auto-advance?
              }}
              onNext={handleNext}
              onPrev={handlePrev}
              hasPrev={currentIndex > 0}
              hasNext={currentIndex < LESSONS.length - 1}
            />
          )}
        </main>
      </div>
    </div>
  );
}
