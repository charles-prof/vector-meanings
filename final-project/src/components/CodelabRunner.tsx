import { useState, useEffect } from 'react';
import { LessonSidebar } from './LessonSidebar';
import { LessonContent } from './LessonContent';
import { Sandbox } from './Sandbox';
import { LandingPage } from './LandingPage';
import { LESSONS } from '../lib/lessons';
import { useProgress } from '../hooks/useProgress';
import { useAI } from '../context/AIContext';
import { Sparkles, Database, Home, Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

import { IngestionService } from '../lib/ingestion';
import { SearchService } from '../lib/search';
import { VectorDatabase } from '../lib/pglite';

export function CodelabRunner() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  // Expose services for the interactive execution environment
  useEffect(() => {
    (window as any).__VM__ = {
      ingestion: IngestionService,
      search: SearchService,
      db: VectorDatabase
    };
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const [activeLessonId, setActiveLessonId] = useState('00');
  const [isSandboxActive, setIsSandboxActive] = useState(false);
  const [showHome, setShowHome] = useState(true);
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

  if (showHome) {
    return (
      <LandingPage 
        onStartCourse={() => setShowHome(false)} 
        onOpenSandbox={() => {
          setShowHome(false);
          setIsSandboxActive(true);
        }} 
      />
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden transition-colors duration-300">
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
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-10 transition-colors">
           <div className="flex items-center gap-6">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowHome(true)}
                className="hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
              <div className="h-4 w-[1px] bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                   <Sparkles className="w-4 h-4" />
                </div>
                <h1 className="font-bold tracking-tight text-sm">
                   {isSandboxActive ? 'Interactive Sandbox' : `${currentLesson.title}`}
                </h1>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="w-9 h-9 rounded-full border border-border text-muted-foreground hover:text-foreground"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent border border-border text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
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
