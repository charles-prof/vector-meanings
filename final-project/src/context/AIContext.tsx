import React, { createContext, useContext, useState, useEffect } from 'react';
import { EmbeddingService } from '../lib/embeddings';

interface AIContextType {
  isModelLoaded: boolean;
  modelProgress: number;
  status: string;
  setStatus: (s: string) => void;
  setModelProgress: (p: number) => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    const init = async () => {
      setStatus('Loading Embedding Model...');
      try {
        await EmbeddingService.getPipeline((progress) => {
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

  return (
    <AIContext.Provider value={{ isModelLoaded, modelProgress, status, setStatus, setModelProgress }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}
