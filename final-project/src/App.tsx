import { useState, useEffect } from 'react';
import { Database, Search, Upload, Loader2, Sparkles, BookOpen, Clock, Tag, Table, Trash2, RefreshCw } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './components/ui/card';
import { IngestionService } from './lib/ingestion';
import { SearchService, type SearchResult } from './lib/search';
import { EmbeddingService } from './lib/embeddings';
import { cn } from './lib/utils';

export default function App() {
  const [ingestText, setIngestText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [status, setStatus] = useState<string>('Ready');
  const [activeTab, setActiveTab] = useState<'rag' | 'db'>('rag');
  const [dbData, setDbData] = useState<any[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      setStatus('Loading Embedding Model...');
      try {
        await EmbeddingService.getPipeline((progress) => {
          // Transformers.js sends progress as 0-100
          setModelProgress(progress);
        });
        setIsModelLoaded(true);
        setStatus('Model Ready');
      } catch (error) {
        console.error(error);
        setStatus('Failed to load model');
      }
    };
    init();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setIngestText(text);
      setStatus('File loaded, ready to ingest');
    };
    reader.readAsText(file);
  };

  const handleIngest = async () => {
    if (!ingestText.trim()) return;
    setIsIngesting(true);
    setStatus('Ingesting Document...');
    try {
      await IngestionService.ingest(ingestText, { 
        timestamp: new Date().toISOString(),
        source: 'manual_upload',
        length: ingestText.length 
      });
      setIngestText('');
      setStatus('Successfully Ingested');
      setTimeout(() => setStatus('Model Ready'), 3000);
    } catch (error) {
      console.error(error);
      setStatus('Ingestion Failed');
    } finally {
      setIsIngesting(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setStatus('Searching...');
    try {
      const searchResults = await SearchService.search(searchQuery);
      setResults(searchResults);
      setStatus(`Found ${searchResults.length} results`);
    } catch (error) {
      console.error(error);
      setStatus('Search Failed');
    } finally {
      setIsSearching(false);
    }
  };

  const fetchDbData = async () => {
    setIsDbLoading(true);
    try {
      const db = await (await import('./lib/pglite')).VectorDatabase.getInstance();
      const result = await db.query('SELECT * FROM documents ORDER BY id DESC LIMIT 50');
      setDbData(result.rows);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDbLoading(false);
    }
  };

  const clearDatabase = async () => {
    if (!confirm('Are you sure? This will delete all ingested knowledge.')) return;
    try {
      const db = await (await import('./lib/pglite')).VectorDatabase.getInstance();
      await db.exec('DELETE FROM documents');
      await fetchDbData();
      setResults([]);
      setStatus('Database Cleared');
    } catch (error) {
       console.error(error);
    }
  };

  useEffect(() => {
    if (activeTab === 'db') {
      fetchDbData();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] selection:bg-primary/30">
      {/* Navbar / Status Bar */}
      <nav className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight">Vector <span className="text-indigo-400">Meanings</span></span>
            </div>

            <div className="h-8 w-[1px] bg-white/10 hidden md:block" />

            <div className="flex items-center bg-white/5 p-1 rounded-lg border border-white/10">
              <button
                onClick={() => setActiveTab('rag')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
                  activeTab === 'rag' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-muted-foreground hover:text-white"
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                RAG Explorer
              </button>
              <button
                onClick={() => setActiveTab('db')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
                  activeTab === 'db' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-muted-foreground hover:text-white"
                )}
              >
                <Table className="w-3.5 h-3.5" />
                Database Viewer
                <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">BONUS</span>
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm font-medium">
            <div className="flex items-center gap-2 text-muted-foreground bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <Database className={cn("w-4 h-4", isModelLoaded ? "text-emerald-400" : "text-amber-400 animate-pulse")} />
              <span>{status}</span>
              {!isModelLoaded && modelProgress > 0 && (
                <span className="text-xs ml-1 text-indigo-400">{Math.round(modelProgress)}%</span>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'rag' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* Left Column: Ingestion */}
            <section className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tight">Ingest <span className="text-indigo-400">Knowledge</span></h2>
                <p className="text-muted-foreground text-lg">
                  Add documents to your local PGlite database. They will be vectorized on-device using Transformers.js.
                </p>
              </div>

              <Card className="bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center justify-between text-xl">
                    <div className="flex items-center gap-2">
                      <Upload className="w-5 h-5 text-indigo-400" />
                      New Document
                    </div>
                    <label className="text-xs font-medium bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg cursor-pointer transition-colors border border-white/10 border-dashed">
                      Upload File (.txt, .md)
                      <input 
                        type="file" 
                        accept=".txt,.md" 
                        className="hidden" 
                        onChange={handleFileUpload}
                      />
                    </label>
                  </CardTitle>
                  <CardDescription>Paste text or upload a file to chunk and index it.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <textarea
                    value={ingestText}
                    onChange={(e) => setIngestText(e.target.value)}
                    placeholder="Paste your document content here..."
                    className="w-full min-h-[300px] bg-black/20 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none font-mono"
                  />
                </CardContent>
                <CardFooter className="bg-black/20 border-t border-white/10 py-4 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {ingestText.length > 0 ? `${Math.ceil(ingestText.length / 500)} chunks will be created` : "Enter text to begin"}
                  </span>
                  <Button 
                    onClick={handleIngest} 
                    disabled={isIngesting || !ingestText.trim() || !isModelLoaded}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                  >
                    {isIngesting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Ingesting...
                      </>
                    ) : (
                      'Ingest Document'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </section>

            {/* Right Column: Search */}
            <section className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tight">Semantic <span className="text-purple-400">Search</span></h2>
                <p className="text-muted-foreground text-lg">
                  Find content by meaning rather than keywords. Uses cosine similarity in PGlite.
                </p>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Ask a question about your documents..."
                    className="pl-10 bg-white/5 border-white/10 h-12 rounded-xl focus:ring-purple-500/50"
                  />
                </div>
                <Button 
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim() || !isModelLoaded}
                  className="bg-purple-600 hover:bg-purple-500 text-white h-12 px-6 shadow-lg shadow-purple-600/20"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                </Button>
              </div>

              <div className="space-y-4 min-h-[400px]">
                {results.length > 0 ? (
                  results.map((result, i) => (
                    <Card key={result.id} className="bg-white/5 border-white/10 hover:border-purple-500/30 transition-all group overflow-hidden">
                      <div className="absolute left-0 top-0 w-1 h-full bg-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </div>
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5" />
                            Source Chunk
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold tracking-wider">
                          <Sparkles className="w-2.5 h-2.5" />
                          {Math.round(result.similarity * 100)}% Match
                        </div>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <p className="text-sm text-muted-foreground leading-relaxed italic">
                          "{result.content}"
                        </p>
                      </CardContent>
                      <CardFooter className="bg-white/5 py-2 flex gap-3 flex-wrap">
                        {Object.entries(result.metadata || {}).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase font-medium">
                            <Tag className="w-2.5 h-2.5" />
                            {key}: {String(value)}
                          </div>
                        ))}
                      </CardFooter>
                    </Card>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-white/5 rounded-3xl p-12 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
                      <Search className="w-8 h-8 opacity-20" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-white/50">No results found</p>
                      <p className="text-sm max-w-xs">Try ingesting documents first or adjust your search query.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        ) : (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight">Postgres <span className="text-emerald-400">Explorer</span></h2>
                  <p className="text-muted-foreground">Direct read-only inspection of the <code>documents</code> table in WASM.</p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={fetchDbData} className="bg-transparent border border-white/10 hover:bg-white/5 gap-2 h-9 px-3">
                    <RefreshCw className={cn("w-4 h-4", isDbLoading && "animate-spin")} />
                    Refresh
                  </Button>
                  <Button onClick={clearDatabase} className="bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500/10 gap-2 h-9 px-3">
                    <Trash2 className="w-4 h-4" />
                    Clear DB
                  </Button>
                </div>
             </div>

             <Card className="bg-white/5 border-white/10 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 uppercase text-[10px] tracking-widest text-muted-foreground font-bold">
                          <th className="px-6 py-4 font-bold">ID</th>
                          <th className="px-6 py-4 font-bold">Content (Truncated)</th>
                          <th className="px-6 py-4 font-bold">Vector (MiniLM-L6)</th>
                          <th className="px-6 py-4 font-bold">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dbData.length > 0 ? dbData.map((row) => (
                           <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                              <td className="px-6 py-4 font-mono text-indigo-400">{row.id}</td>
                              <td className="px-6 py-4 max-w-md truncate text-muted-foreground">{row.content}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-0.5">
                                    {[0,1,2,3,4].map(idx => (
                                      <div 
                                        key={idx} 
                                        className="w-1.5 h-4 rounded-sm bg-indigo-500/40" 
                                        style={{ height: `${Math.abs(row.embedding?.[idx] || 0.5) * 40}px` }}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-mono">[{row.embedding?.slice(0, 3).map((n: number) => n.toFixed(2)).join(',')}...]</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-[10px] text-muted-foreground font-mono">
                                {new Date(row.created_at).toLocaleTimeString()}
                              </td>
                           </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic">
                              Database is empty. Ingest some documents to see them here.
                            </td>
                          </tr>
                        )}
                      </tbody>
                   </table>
                </div>
                <CardFooter className="bg-black/20 py-3 border-t border-white/10 flex justify-between">
                   <span className="text-xs text-muted-foreground">Showing {dbData.length} documents</span>
                   <span className="text-[10px] font-bold bg-white/5 px-2 py-1 rounded border border-white/10 text-emerald-400">TABLE: public.documents</span>
                </CardFooter>
             </Card>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-indigo-500/5 border-indigo-500/20 p-4 space-y-2">
                   <p className="text-[10px] font-bold uppercase text-indigo-400">Column: embedding</p>
                   <p className="text-xs text-muted-foreground leading-relaxed">
                     The <code>vector(384)</code> column stores high-dimensional floats generated by MiniLM-L6 in your browser.
                   </p>
                </Card>
                <Card className="bg-emerald-500/5 border-emerald-500/20 p-4 space-y-2">
                   <p className="text-[10px] font-bold uppercase text-emerald-400">Indexing: pgvector</p>
                   <p className="text-xs text-muted-foreground leading-relaxed">
                     PGlite uses the <code>pgvector</code> extension to compute cosine distances directly in WASM.
                   </p>
                </Card>
                <Card className="bg-purple-500/5 border-purple-500/20 p-4 space-y-2">
                   <p className="text-[10px] font-bold uppercase text-purple-400">Storage: IndexedDB</p>
                   <p className="text-xs text-muted-foreground leading-relaxed">
                     Postgres data is persistent! Refreshing the page won't lose your data thanks to IndexedDB sync.
                   </p>
                </Card>
             </div>
          </section>
        )}
      </main>

      {/* Footer Info */}
      <footer className="border-t border-white/5 pt-12 pb-24 text-center mt-12 bg-black/40">
        <div className="max-w-2xl mx-auto space-y-4 px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">Technology Stack</p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 opacity-50 grayscale hover:grayscale-0 transition-all">
             <div className="font-bold flex items-center gap-2">
                <Database className="w-4 h-4" /> PGlite (WASM)
             </div>
             <div className="font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> pgvector
             </div>
             <div className="font-bold flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-white flex items-center justify-center text-[8px] text-black">H</div> Hugging Face
             </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto pt-6 leading-relaxed">
            All data and vectors stay in your browser. This application runs entirely 100% on-device for maximum privacy and performance.
          </p>
        </div>
      </footer>
    </div>
  );
}
