import { useState, useEffect } from 'react';
import { Search, Upload, Loader2, BookOpen, Table, Trash2, RefreshCw, Globe, Database } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { IngestionService } from '../lib/ingestion';
import { SearchService, type SearchResult } from '../lib/search';
import { AnswerService } from '../lib/answer';
import { GeneralKnowledgeService } from '../lib/general';
import { VectorDatabase } from '../lib/pglite';
import { useAI } from '../context/AIContext';
import { cn } from '../lib/utils';

interface DocumentRow {
  id: number;
  content: string;
  embedding: number[];
  created_at: string;
  metadata: Record<string, unknown>;
}

export function Sandbox() {
  const { isModelLoaded, setModelProgress } = useAI();
  const [ingestText, setIngestText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [localAnswer, setLocalAnswer] = useState<string>('');
  const [worldAnswer, setWorldAnswer] = useState<string>('');
  
  const [isIngesting, setIsIngesting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnsweringLocal, setIsAnsweringLocal] = useState(false);
  const [isAnsweringWorld, setIsAnsweringWorld] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'rag' | 'db'>('rag');
  const [dbData, setDbData] = useState<DocumentRow[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setIngestText(text);
    };
    reader.readAsText(file);
  };

  const handleIngest = async () => {
    if (!ingestText.trim()) return;
    setIsIngesting(true);
    try {
      await IngestionService.ingest(ingestText, { 
        timestamp: new Date().toISOString(),
        source: 'sandbox',
        length: ingestText.length 
      });
      setIngestText('');
      if (activeSubTab === 'db') fetchDbData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setLocalAnswer('');
    setWorldAnswer('');
    setResults([]);

    try {
      const searchResults = await SearchService.search(searchQuery, 5);
      setResults(searchResults);

      const localRagPromise = async () => {
        if (searchResults.length > 0) {
          setIsAnsweringLocal(true);
          const answer = await AnswerService.answer(searchQuery, searchResults.map(r => r.content), setModelProgress);
          setLocalAnswer(answer);
          setIsAnsweringLocal(false);
        }
      };

      const worldKnowledgePromise = async () => {
        setIsAnsweringWorld(true);
        const answer = await GeneralKnowledgeService.answer(searchQuery, setModelProgress);
        setWorldAnswer(answer);
        setIsAnsweringWorld(false);
      };

      await Promise.all([localRagPromise(), worldKnowledgePromise()]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchDbData = async () => {
    setIsDbLoading(true);
    try {
      const db = await VectorDatabase.getInstance();
      const result = await db.query('SELECT * FROM documents ORDER BY id DESC LIMIT 50');
      const formatted = result.rows.map((row: any) => ({
        ...row,
        embedding: row.embedding ? Array.from(row.embedding) : []
      }));
      setDbData(formatted);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDbLoading(false);
    }
  };

  const clearDatabase = async () => {
    if (!confirm('Are you sure? This will delete all ingested knowledge.')) return;
    try {
      const db = await VectorDatabase.getInstance();
      await db.exec('DELETE FROM documents');
      await fetchDbData();
      setResults([]);
      setLocalAnswer('');
      setWorldAnswer('');
    } catch (error) {
       console.error(error);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'db') fetchDbData();
  }, [activeSubTab]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between border-b border-border pb-6 transition-colors">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Interactive <span className="text-indigo-400">Sandbox</span></h2>
          <p className="text-muted-foreground text-sm mt-1">Experiment with retrieval, ingestion, and world knowledge fusion.</p>
        </div>
        <div className="flex bg-muted p-1 rounded-lg border border-border">
          <button
            onClick={() => setActiveSubTab('rag')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
              activeSubTab === 'rag' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Search className="w-3.5 h-3.5" />
            RAG Explorer
          </button>
          <button
            onClick={() => setActiveSubTab('db')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
              activeSubTab === 'db' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Table className="w-3.5 h-3.5" />
            Database
          </button>
        </div>
      </div>

      {activeSubTab === 'rag' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Ingestion Column */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm uppercase tracking-widest">
              <Upload className="w-4 h-4" />
              Ingestion
            </div>
            <Card className="bg-card border-border overflow-hidden shadow-xl transition-colors">
              <CardContent className="pt-6 space-y-4">
                <textarea
                  value={ingestText}
                  onChange={(e) => setIngestText(e.target.value)}
                  placeholder="Paste document content..."
                  className="w-full min-h-[200px] bg-background/50 border border-border rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                />
                <div className="flex justify-between items-center">
                   <label className="text-[10px] font-bold bg-muted hover:bg-accent px-3 py-2 rounded-lg cursor-pointer transition-colors border border-border border-dashed text-muted-foreground uppercase tracking-wider">
                      Upload File
                      <input type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
                    </label>
                   <Button 
                    onClick={handleIngest} 
                    disabled={isIngesting || !ingestText.trim() || !isModelLoaded}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 shadow-lg shadow-indigo-600/20"
                  >
                    {isIngesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ingest'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Search Column */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-sm uppercase tracking-widest">
              <Search className="w-4 h-4" />
              Retrieval
            </div>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ask something..."
                className="bg-card border-border h-11 rounded-xl"
              />
              <Button onClick={handleSearch} disabled={isSearching || !isModelLoaded} className="bg-purple-600 hover:bg-purple-500 px-6 h-11">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </Button>
            </div>

            <div className="space-y-4">
               {isAnsweringWorld && !worldAnswer && <div className="h-24 bg-card animate-pulse rounded-xl border border-border" />}
               {worldAnswer && (
                 <Card className="bg-blue-500/5 border-blue-500/10 transition-colors">
                   <CardHeader className="py-3"><CardTitle className="text-xs text-blue-500 flex items-center gap-2"><Globe className="w-3 h-3" /> World Knowledge</CardTitle></CardHeader>
                   <CardContent className="pb-3 text-sm text-foreground/80 leading-relaxed">{worldAnswer}</CardContent>
                 </Card>
               )}

               {isAnsweringLocal && !localAnswer && <div className="h-24 bg-card animate-pulse rounded-xl border border-border" />}
               {localAnswer && (
                 <Card className="bg-indigo-500/10 border-indigo-500/20 transition-colors">
                   <CardHeader className="py-3"><CardTitle className="text-xs text-indigo-500 flex items-center gap-2"><BookOpen className="w-3 h-3" /> Document Knowledge</CardTitle></CardHeader>
                   <CardContent className="pb-3 text-sm text-foreground/80 leading-relaxed">{localAnswer}</CardContent>
                 </Card>
               )}

               {results.map((res) => (
                 <Card key={res.id} className="bg-card border-border hover:border-indigo-500/30 transition-all px-4 py-3 flex gap-4 items-center group shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate italic">"{res.content}"</p>
                    </div>
                    <div className="text-[10px] font-bold text-emerald-500 whitespace-nowrap">{Math.round(res.similarity * 100)}%</div>
                 </Card>
               ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm uppercase tracking-widest">
                <Database className="w-4 h-4" />
                Raw Data Explorer
              </div>
              <div className="flex gap-2">
                 <Button onClick={fetchDbData} variant="outline" size="sm" className="border-border hover:bg-accent h-8 gap-1.5 transition-colors">
                    <RefreshCw className={cn("w-3 h-3", isDbLoading && "animate-spin")} />
                    Refresh
                 </Button>
                 <Button onClick={clearDatabase} variant="outline" size="sm" className="border-red-500/20 text-red-500 hover:bg-red-500/5 h-8 gap-1.5 transition-colors">
                    <Trash2 className="w-3 h-3" />
                    Clear
                 </Button>
              </div>
           </div>
           
           <Card className="bg-card border-border overflow-hidden shadow-2xl backdrop-blur-xl transition-colors">
              <div className="overflow-x-auto">
                 <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="bg-muted border-b border-border text-[10px] uppercase font-black text-foreground/40 tracking-[0.2em]">
                       <tr>
                          <th className="px-6 py-4 border-b border-border">ID</th>
                          <th className="px-6 py-4 border-b border-border">Content</th>
                          <th className="px-6 py-4 border-b border-border text-right">Vector Signature</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                       {dbData.map(row => (
                         <tr key={row.id} className="group hover:bg-muted/50 transition-colors">
                            <td className="px-6 py-4 align-top font-mono text-indigo-500 text-xs font-bold whitespace-nowrap pt-5">#{row.id}</td>
                            <td className="px-6 py-4 align-top">
                               <div className="max-w-2xl">
                                  <p className="text-sm text-foreground/90 leading-relaxed font-light">{row.content}</p>
                                  {row.metadata && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {Object.entries(row.metadata).map(([k, v]) => (
                                        <span key={k} className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted border border-border text-muted-foreground uppercase tracking-tighter">
                                          {k}: {String(v)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                               </div>
                            </td>
                            <td className="px-6 py-4 align-top text-right pt-5">
                               <div className="inline-flex items-end gap-0.5 h-6 px-3 py-1 bg-indigo-500/5 rounded-full border border-indigo-500/10 group-hover:border-indigo-500/30 transition-all">
                                  {row.embedding.slice(0, 24).map((v, i) => (
                                    <div 
                                      key={i} 
                                      className="w-0.5 rounded-full bg-indigo-400/40" 
                                      style={{ height: `${Math.max(20, Math.min(100, Math.abs(v) * 200))}%` }} 
                                    />
                                  ))}
                                </div>
                            </td>
                         </tr>
                       ))}
                       {dbData.length === 0 && !isDbLoading && (
                         <tr>
                            <td colSpan={3} className="px-6 py-20 text-center">
                               <Database className="w-12 h-12 text-muted-foreground/10 mx-auto mb-4" />
                               <p className="text-muted-foreground text-sm">No data in database. Ingest some content to see it here.</p>
                            </td>
                         </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </Card>
        </section>
      )}
    </div>
  );
}
