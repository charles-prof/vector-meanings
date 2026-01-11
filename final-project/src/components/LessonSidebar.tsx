import { LESSONS } from '../lib/lessons';
import { cn } from '../lib/utils';
import { CheckCircle2, Circle, Layout, Database, GraduationCap } from 'lucide-react';

interface LessonSidebarProps {
  activeLessonId: string;
  onSelectLesson: (id: string) => void;
  isCompleted: (id: string) => boolean;
  totalCompleted: number;
  onShowSandbox: () => void;
  isSandboxActive: boolean;
}

export function LessonSidebar({ 
  activeLessonId, 
  onSelectLesson, 
  isCompleted, 
  totalCompleted,
  onShowSandbox,
  isSandboxActive
}: LessonSidebarProps) {
  const progressPercent = Math.round((totalCompleted / LESSONS.length) * 100);

  return (
    <aside className="w-80 border-r border-border bg-card/40 flex flex-col h-full overflow-hidden transition-colors">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-tight">Curriculum</h2>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold font-mono">
              On-Device Vector AI
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Overall Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden shadow-inner border border-border">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(99,102,241,0.5)]" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6 custom-scrollbar">
        <div className="space-y-1">
          {LESSONS.map((lesson) => {
            const isActive = !isSandboxActive && activeLessonId === lesson.id;
            const completed = isCompleted(lesson.id);

            return (
              <button
                key={lesson.id}
                onClick={() => onSelectLesson(lesson.id)}
                className={cn(
                  "w-full group flex items-start gap-3 p-3 rounded-xl transition-all duration-200 text-left relative",
                  isActive 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                    : "hover:bg-accent text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "mt-0.5 transition-colors",
                  completed ? "text-emerald-400" : (isActive ? "text-white" : "text-muted-foreground/30 group-hover:text-foreground/40")
                )}>
                  {completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-0.5">Step {lesson.id}</div>
                  <div className="text-sm font-semibold leading-tight">{lesson.title}</div>
                </div>
                {isActive && (
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_8px_white]" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 pt-8 border-t border-border space-y-4">
           <h3 className="px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tools & Environment</h3>
           <button
             onClick={onShowSandbox}
             className={cn(
               "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
               isSandboxActive 
                 ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" 
                 : "hover:bg-accent text-muted-foreground hover:text-foreground"
             )}
           >
             <Layout className="w-4 h-4" />
             <span className="text-sm font-semibold">Interactive Sandbox</span>
           </button>
        </div>
      </nav>

      <div className="p-4 border-t border-border bg-muted/20">
         <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <Database className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">PGlite Node Active</span>
         </div>
      </div>
    </aside>
  );
}
