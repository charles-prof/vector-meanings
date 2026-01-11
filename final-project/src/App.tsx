import { AIProvider } from './context/AIContext';
import { CodelabRunner } from './components/CodelabRunner';

export default function App() {
  return (
    <AIProvider>
      <CodelabRunner />
    </AIProvider>
  );
}
