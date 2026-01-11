import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Loader2, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';

interface LessonContentProps {
  filePath: string;
  onComplete: () => void;
  isCompleted: boolean;
  onNext: () => void;
  onPrev: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function LessonContent({ 
  filePath, 
  onComplete, 
  isCompleted, 
  onNext, 
  onPrev,
  hasPrev,
  hasNext 
}: LessonContentProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      try {
        // We use dynamic import with ?raw to get the file content as a string
        const modules = import.meta.glob('../content/*.md', { query: '?raw', import: 'default' });
        const loader = modules[`../content/${filePath}`];
        if (loader) {
          const raw = await loader();
          setContent(raw as string);
        } else {
          setContent('# Lesson Not Found');
        }
      } catch (e) {
        console.error('Failed to load lesson content', e);
        setContent('# Error loading lesson');
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-muted-foreground animate-pulse text-sm">Loading your lesson...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <article className="prose prose-invert prose-indigo max-w-none">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <div className="relative group my-6">
                  <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
                     <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{match[1]}</span>
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    className="!bg-black/40 !border !border-white/5 !rounded-xl !p-6 !my-0 shadow-2xl"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className={cn("bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs", className)} {...props}>
                  {children}
                </code>
              );
            },
            h1: ({ children }) => <h1 className="text-4xl font-bold tracking-tight mb-8 text-white">{children}</h1>,
            h2: ({ children }) => <h2 className="text-2xl font-bold tracking-tight mt-12 mb-4 text-white/90">{children}</h2>,
            p: ({ children }) => <p className="text-muted-foreground leading-relaxed mb-6 text-lg">{children}</p>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-indigo-500/50 bg-indigo-500/5 px-6 py-1 my-8 rounded-r-xl italic">
                {children}
              </blockquote>
            ),
          }}
        >
          {content || ''}
        </ReactMarkdown>
      </article>

      <div className="mt-16 pt-8 border-t border-white/10 flex items-center justify-between">
        <div className="flex gap-4">
           {hasPrev && (
             <Button variant="outline" onClick={onPrev} className="border-white/10 hover:bg-white/5 gap-2 px-6">
                <ChevronLeft className="w-4 h-4" />
                Previous
             </Button>
           )}
        </div>

        <div className="flex items-center gap-6">
          {!isCompleted ? (
            <Button 
              onClick={onComplete}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 h-12 rounded-xl shadow-lg shadow-indigo-600/20 gap-2 font-bold"
            >
              Complete & Continue
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-4">
               <span className="flex items-center gap-2 text-emerald-400 font-bold text-sm bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20 shadow-inner">
                  <CheckCircle2 className="w-4 h-4" />
                  Lesson Completed
               </span>
               {hasNext && (
                 <Button 
                    onClick={onNext}
                    className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-8 h-12 rounded-xl gap-2 font-bold"
                 >
                    Next Lesson
                    <ChevronRight className="w-4 h-4" />
                 </Button>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
