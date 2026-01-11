import { Sparkles, Layout, Zap, Shield, Rocket, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

interface LandingPageProps {
  onStartCourse: () => void;
  onOpenSandbox: () => void;
}

export function LandingPage({ onStartCourse, onOpenSandbox }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-indigo-500/30 overflow-x-hidden transition-colors duration-500">
      {/* Hero Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 dark:bg-indigo-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 dark:bg-purple-600/20 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-24">
        {/* Hero Section */}
        <section className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-border text-xs font-bold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
            V1.0 Launching Now
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9]">
            Vector <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-400 animate-gradient-x">Meanings</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed">
            Master <strong>On-Device Vector Search & RAG.</strong> Learn how to build private, insanely fast AI applications that run entirely in your browser using PGlite and Transformers.js.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button 
              onClick={onStartCourse}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 h-14 rounded-2xl text-lg font-bold shadow-2xl shadow-indigo-600/20 group transition-all hover:scale-105 active:scale-95"
            >
              Start the Course
              <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              onClick={onOpenSandbox}
              variant="outline"
              className="border-border bg-card/50 hover:bg-accent text-foreground px-10 h-14 rounded-2xl text-lg font-bold backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
            >
              Interactive Sandbox
              <Layout className="ml-2 w-5 h-5 opacity-50" />
            </Button>
          </div>
        </section>

        {/* Features Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-48 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
          <FeatureCard 
            icon={<Shield className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />}
            title="100% Private"
            description="Your documents never leave your browser. All vectorization and search happens locally in WASM."
          />
          <FeatureCard 
            icon={<Zap className="w-8 h-8 text-amber-500 dark:text-amber-400" />}
            title="Zero Latency"
            description="No API keys, no network calls, no billing. Instant similarity search with pgvector + IndexedDB."
          />
          <FeatureCard 
            icon={<Rocket className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />}
            title="Production Ready"
            description="Learn the stack used by modern thin-client AI apps: PGlite, Transformers.js, and Hybrid RAG."
          />
        </section>

        {/* Browser Demo Preview */}
        <section className="mt-48 relative rounded-3xl overflow-hidden border border-border bg-card/40 backdrop-blur-2xl shadow-xl transition-colors animate-in fade-in zoom-in-95 duration-1000 delay-500">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60 z-10" />
          <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/50">
            <div className="flex gap-1.5 px-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
            </div>
            <div className="flex-1 text-[10px] uppercase tracking-widest text-center text-muted-foreground font-bold">
              Postgres WASM Console
            </div>
          </div>
          <div className="p-8 font-mono text-sm space-y-2 opacity-80">
             <div className="flex gap-2"><span className="text-indigo-500 dark:text-indigo-400">➜</span> <span>await db.query(`SELECT id, content FROM documents ORDER BY embedding &lt;=&gt; $1 LIMIT 3`, [query_vector]);</span></div>
             <div className="text-emerald-600 dark:text-emerald-400/80">DONE: 3 chunks retrieved in 12ms</div>
             <div className="text-muted-foreground/30">----------------------------------------------------</div>
             <div className="flex gap-2"><span className="text-indigo-500 dark:text-indigo-400">➜</span> <span>await generator(prompt, {'{'} max_tokens: 100 {'}'});</span></div>
             <div className="text-purple-500 dark:text-purple-400">LLM Thinking...</div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 text-center opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-xs font-mono uppercase tracking-[0.4em]">Designed for Modern Edge AI Builders</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-3xl bg-card border border-border hover:border-indigo-500/30 transition-all hover:bg-accent group shadow-sm hover:shadow-indigo-500/5">
      <div className="mb-6 transform transition-transform group-hover:scale-110 group-hover:rotate-3">{icon}</div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
