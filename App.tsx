import React, { useState, useEffect } from 'react';
import { Vote, Loader2, BarChart2, ShieldCheck, Info, Ban, HelpCircle } from 'lucide-react';
import { CANDIDATES, SPECIAL_OPTIONS } from './constants';
import { CandidateCard } from './components/CandidateCard';
import { ResultsView } from './components/ResultsView';
import { hasUserVoted, submitVote, getPollResults } from './services/pollService';
import { PollData } from './types';

function App() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<'voting' | 'results'>('voting');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [pollData, setPollData] = useState<PollData | null>(null);

  useEffect(() => {
    const init = async () => {
      const voted = hasUserVoted();
      if (voted) {
        const data = await getPollResults();
        setPollData(data);
        setView('results');
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleVote = async () => {
    if (!selectedCandidateId) return;

    setSubmitting(true);
    try {
      const success = await submitVote(selectedCandidateId);
      if (success) {
        const data = await getPollResults();
        setPollData(data);
        setView('results');
      }
    } catch (error) {
      console.error("Error submitting vote", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewResultsManually = async () => {
    setLoading(true);
    const data = await getPollResults();
    setPollData(data);
    setLoading(false);
    setView('results');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-800" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/favicon.png" alt="Costa Rica Decide" className="w-8 h-8" />
            <div>
              <span className="font-bold text-lg tracking-tight text-gray-900">Costa Rica Decide</span>
              <span className="hidden sm:inline ml-2 text-xs bg-cr-blue/10 text-cr-blue px-2 py-0.5 rounded-full font-medium">Elecciones 2026</span>
            </div>
          </div>
          {view === 'voting' && (
            <button
              onClick={handleViewResultsManually}
              className="text-sm font-medium text-gray-500 hover:text-blue-800 transition-colors flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
            >
              <BarChart2 size={16} />
              <span className="hidden sm:inline">Ver resultados</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {view === 'voting' ? (
          <div className="animate-in slide-in-from-bottom-4 duration-700 fade-in">
            <div className="text-center mb-10">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
                ¿Quién debería ser el próximo presidente?
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Tu opinión es importante para el futuro de Costa Rica. Selecciona a tu candidato preferido. El voto es 100% anónimo.
              </p>

              <div className="mt-6 flex justify-center items-center space-x-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <div className="flex items-center"><ShieldCheck size={14} className="mr-1" /> Voto Seguro</div>
                <div className="flex items-center"><Info size={14} className="mr-1" /> Un voto por persona</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {CANDIDATES.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  isSelected={selectedCandidateId === candidate.id}
                  onSelect={setSelectedCandidateId}
                />
              ))}
            </div>

            {/* Special Options */}
            <div className="border-t border-gray-200 pt-6 mb-10">
              <p className="text-sm text-gray-500 text-center mb-4">Otras opciones</p>
              <div className="grid grid-cols-2 gap-3">
                {/* Voto Nulo */}
                <button
                  onClick={() => setSelectedCandidateId('nulo')}
                  className={`
                    flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-300
                    ${selectedCandidateId === 'nulo'
                      ? 'border-red-500 bg-red-50 text-red-700 shadow-lg'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <Ban size={20} />
                  <span className="font-medium">Voto Nulo</span>
                </button>

                {/* Indeciso */}
                <button
                  onClick={() => setSelectedCandidateId('indeciso')}
                  className={`
                    flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-300
                    ${selectedCandidateId === 'indeciso'
                      ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-lg'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <HelpCircle size={20} />
                  <span className="font-medium">Indeciso</span>
                </button>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 sm:relative sm:bg-transparent sm:border-0 sm:p-0 flex justify-center z-40">
              <button
                onClick={handleVote}
                disabled={!selectedCandidateId || submitting}
                className={`
                  w-full sm:w-auto px-10 py-4 rounded-full font-bold text-lg shadow-xl transition-all duration-300 flex items-center justify-center space-x-2
                  ${!selectedCandidateId || submitting
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                    : 'bg-blue-900 text-white hover:bg-blue-800 hover:scale-105 active:scale-95 hover:shadow-2xl ring-4 ring-blue-50'
                  }
                `}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={24} />
                    <span>Enviando voto...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmar Voto</span>
                  </>
                )}
              </button>
            </div>
            {/* Spacer for sticky footer on mobile */}
            <div className="h-20 sm:h-0"></div>
          </div>
        ) : (
          <div className="animate-in zoom-in-95 duration-500 fade-in">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-10">
              {pollData ? <ResultsView data={pollData} /> : <div className="text-center">Cargando datos...</div>}
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Actualizar datos
              </button>
            </div>
          </div>
        )}

      </main>

      <footer className="py-8 text-center text-gray-400 text-sm border-t border-gray-200 mt-10">
        <p className="mb-2">© 2026 Costa Rica Decide. Proyecto independiente de demostración.</p>
        <p className="text-xs text-gray-300">Esta es una encuesta de opinión, no un proceso electoral oficial.</p>
      </footer>
    </div>
  );
}

export default App;
