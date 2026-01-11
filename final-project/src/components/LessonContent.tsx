import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
  const [outputs, setOutputs] = useState<Record<string, any>>({});
  const [isRunning, setIsRunning] = useState<Record<string, boolean>>({});
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const runCode = async (code: string, blockId: string, language: string) => {
    setIsRunning(prev => ({ ...prev, [blockId]: true }));
    try {
      // Expose services to the code scope
      const VM = (window as any).__VM__;
      
      if (language === 'sql') {
        const db = await VM.db.getInstance();
        const result = await db.query(code);
        setOutputs(prev => ({ ...prev, [blockId]: result }));
      } else {
        // Wrap in async to allow await
        const fn = new Function('VM', `return (async () => { 
          try { 
            ${code} 
          } catch (e) { 
            return 'Error: ' + e.message; 
          }
        })()`);
        
        const result = await fn(VM);
        setOutputs(prev => ({ ...prev, [blockId]: result }));
      }
    } catch (e) {
      setOutputs(prev => ({ ...prev, [blockId]: 'Compilation Error: ' + e.message }));
    } finally {
      setIsRunning(prev => ({ ...prev, [blockId]: false }));
    }
  };

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setOutputs({});
      try {
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
      <article className={cn("prose prose-indigo max-w-none prose-pre:p-0 prose-pre:bg-transparent", isDark && "prose-invert")}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const lang = match?.[1] || '';
              const isJavascript = lang === 'javascript' || lang === 'js';
              const isSql = lang === 'sql';
              const blockContent = String(children).replace(/\n$/, '');
              const blockId = node.position?.start.line.toString() || Math.random().toString();

              return !inline && match ? (
                <div className="relative group my-8">
                  <div className="absolute right-4 top-4 flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                     <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-accent/50 px-2 py-1 rounded backdrop-blur-sm border border-border">{lang}</span>
                     {(isJavascript || isSql) && (
                        <button 
                          disabled={isRunning[blockId]}
                          onClick={() => runCode(blockContent, blockId, lang)}
                          className="p-1 px-3 rounded bg-emerald-600/80 hover:bg-emerald-600 text-[10px] font-bold text-white transition-all border border-emerald-400/20 disabled:opacity-50"
                        >
                          {isRunning[blockId] ? 'RUNNING...' : 'RUN'}
                        </button>
                     )}
                     <button 
                       onClick={() => navigator.clipboard.writeText(blockContent)}
                       className="p-1 px-3 rounded bg-accent/50 hover:bg-accent text-[10px] font-bold text-foreground transition-all border border-border"
                     >
                       COPY
                     </button>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-border shadow-2xl bg-card">
                    <SyntaxHighlighter
                      style={isDark ? vscDarkPlus : prism}
                      language={lang}
                      PreTag="div"
                      className="!bg-transparent !p-6 !m-0 !text-sm !leading-relaxed scrollbar-hide font-mono translate-z-0"
                      {...props}
                    >
                      {blockContent}
                    </SyntaxHighlighter>
                    {outputs[blockId] !== undefined && (
                      <div className="bg-emerald-500/5 border-t border-emerald-500/20 p-4 font-mono text-xs">
                         <div className="text-emerald-400 font-bold mb-2 uppercase tracking-widest opacity-50 flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                           Output
                         </div>
                         <pre className="text-emerald-500/80 whitespace-pre-wrap">
                           {typeof outputs[blockId] === 'object' ? JSON.stringify(outputs[blockId], null, 2) : String(outputs[blockId])}
                         </pre>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <code className={cn("bg-accent px-2 py-0.5 rounded-md text-indigo-500 font-mono text-[13px] border border-border", className)} {...props}>
                  {children}
                </code>
              );
            },
            h1: ({ children }) => <h1 className="text-5xl font-black tracking-tight mb-12 text-foreground leading-tight">{children}</h1>,
            h2: ({ children }) => <h2 className="text-3xl font-bold tracking-tight mt-16 mb-6 text-foreground/90 border-b border-border pb-4">{children}</h2>,
            h3: ({ children }) => <h3 className="text-xl font-bold tracking-tight mt-10 mb-4 text-foreground/80">{children}</h3>,
            p: ({ children }) => <p className="text-foreground/70 leading-relaxed mb-8 text-[1.1rem] font-light">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-6 space-y-3 mb-8 text-foreground/60">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-6 space-y-3 mb-8 text-foreground/60">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            table: ({ children }) => (
              <div className="overflow-x-auto my-10 rounded-2xl border border-border bg-card/5 bg-gradient-to-br from-accent/5 to-transparent">
                <table className="w-full text-left border-collapse">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-accent/5 border-b border-border">{children}</thead>,
            th: ({ children }) => <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-indigo-500">{children}</th>,
            td: ({ children }) => <td className="px-6 py-4 text-sm text-foreground/60 border-b border-border/5">{children}</td>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-indigo-500 bg-indigo-500/5 px-8 py-2 my-10 rounded-r-2xl italic text-foreground/80">
                {children}
              </blockquote>
            ),
          }}
        >
          {content || ''}
        </ReactMarkdown>
      </article>

      <div className="mt-16 pt-8 border-t border-border flex items-center justify-between">
        <div className="flex gap-4">
           {hasPrev && (
             <Button variant="outline" onClick={onPrev} className="border-border hover:bg-accent gap-2 px-6">
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
               <span className="flex items-center gap-2 text-emerald-500 font-bold text-sm bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20 shadow-inner">
                  <CheckCircle2 className="w-4 h-4" />
                  Lesson Completed
               </span>
               {hasNext && (
                 <Button 
                    onClick={onNext}
                    className="bg-accent hover:bg-accent/80 text-foreground border border-border px-8 h-12 rounded-xl gap-2 font-bold transition-colors"
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
