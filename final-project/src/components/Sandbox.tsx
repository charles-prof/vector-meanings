import { useState, useEffect } from 'react';
import { Search, Upload, Loader2, Sparkles, BookOpen, Clock, Table, Trash2, RefreshCw, Globe, Tag } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
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
  const { isModelLoaded, setStatus, setModelProgress } = useAI();
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
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Interactive <span className="text-indigo-400">Sandbox</span></h2>
          <p className="text-muted-foreground text-sm mt-1">Experiment with retrieval, ingestion, and world knowledge fusion.</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setActiveSubTab('rag')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
              activeSubTab === 'rag' ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
            )}
          >
            <Search className="w-3.5 h-3.5" />
            RAG Explorer
          </button>
          <button
            onClick={() => setActiveSubTab('db')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
              activeSubTab === 'db' ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
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
            <Card className="bg-white/5 border-white/10 overflow-hidden shadow-2xl">
              <CardContent className="pt-6 space-y-4">
                <textarea
                  value={ingestText}
                  onChange={(e) => setIngestText(e.target.value)}
                  placeholder="Paste document content..."
                  className="w-full min-h-[200px] bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                />
                <div className="flex justify-between items-center">
                   <label className="text-[10px] font-bold bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg cursor-pointer transition-colors border border-white/10 border-dashed text-muted-foreground uppercase tracking-wider">
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
                className="bg-white/5 border-white/10 h-11 rounded-xl"
              />
              <Button onClick={handleSearch} disabled={isSearching || !isModelLoaded} className="bg-purple-600 hover:bg-purple-500 px-6 h-11">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </Button>
            </div>

            <div className="space-y-4">
               {isAnsweringWorld && !worldAnswer && <div className="h-24 bg-white/5 animate-pulse rounded-xl border border-white/5" />}
               {worldAnswer && (
                 <Card className="bg-blue-500/5 border-blue-500/10">
                   <CardHeader className="py-3"><CardTitle className="text-xs text-blue-400 flex items-center gap-2"><Globe className="w-3 h-3" /> World Knowledge</CardTitle></CardHeader>
                   <CardContent className="pb-3 text-sm text-white/80">{worldAnswer}</CardContent>
                 </Card>
               )}

               {isAnsweringLocal && !localAnswer && <div className="h-24 bg-white/5 animate-pulse rounded-xl border border-white/5" />}
               {localAnswer && (
                 <Card className="bg-indigo-500/5 border-indigo-500/10">
                   <CardHeader className="py-3"><CardTitle className="text-xs text-indigo-400 flex items-center gap-2"><BookOpen className="w-3 h-3" /> Document Knowledge</CardTitle></CardHeader>
                   <CardContent className="pb-3 text-sm text-white/80">{localAnswer}</CardContent>
                 </Card>
               )}

               {results.map((res, i) => (
                 <Card key={res.id} className="bg-white/[0.02] border-white/5 hover:border-white/10 transition-all px-4 py-3 flex gap-4 items-center group">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate italic">"{res.content}"</p>
                    </div>
                    <div className="text-[10px] font-bold text-emerald-400 whitespace-nowrap">{Math.round(res.similarity * 100)}%</div>
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
                 <Button onClick={fetchDbData} variant="outline" size="sm" className="border-white/5 hover:bg-white/5 h-8 gap-1.5">
                    <RefreshCw className={cn("w-3 h-3", isDbLoading && "animate-spin")} />
                    Refresh
                 </Button>
                 <Button onClick={clearDatabase} variant="outline" size="sm" className="border-red-500/20 text-red-400 hover:bg-red-500/5 h-8 gap-1.5">
                    <Trash2 className="w-3 h-3" />
                    Clear
                 </Button>
              </div>
           </div>
           {/* Reuse the table logic here (simplified) */}
           <Card className="bg-white/5 border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/10 text-[10px] uppercase font-bold text-muted-foreground">
                       <tr>
                          <th className="px-6 py-3">ID</th>
                          <th className="px-6 py-3">Content</th>
                          <th className="px-6 py-3">Vector Space</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {dbData.map(row => (
                         <tr key={row.id} className="hover:bg-white/[0.01]">
                            <td className="px-6 py-4 font-mono text-indigo-400">#{row.id}</td>
                            <td className="px-6 py-4 max-w-md truncate text-muted-foreground">{row.content}</td>
                            <td className="px-6 py-4">
                               <div className="flex gap-0.5 opacity-50">
                                  {row.embedding.slice(0, 8).map((v, i) => (
                                    <div key={i} className="w-1.5 h-3 bg-indigo-500/40 rounded-sm" style={{ height: `${Math.abs(v) * 30}px` }} />
                                  ))}
                               </div>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </Card>
        </section>
      )}
    </div>
  );
}
