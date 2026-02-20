'use client';

import { useState, useCallback } from 'react';
import { Compass } from 'lucide-react';
import { quizQuestions, type QuizOption } from '@/lib/tools/quiz-questions';
import { scoreDestinations, type QuizResult } from '@/lib/tools/quiz-scoring';
import { QuizQuestion } from './QuizQuestion';
import { QuizResults } from './QuizResults';

type QuizState = 'intro' | 'questions' | 'calculating' | 'results';

export function TravelQuizClient() {
  const [state, setState] = useState<QuizState>('intro');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<QuizOption[][]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);

  const handleStart = () => {
    setState('questions');
    setCurrentQuestion(0);
    setAnswers([]);
  };

  const handleSelect = useCallback(
    (options: QuizOption[]) => {
      setAnswers((prev) => {
        const next = [...prev];
        next[currentQuestion] = options;
        return next;
      });
    },
    [currentQuestion]
  );

  const handleNext = useCallback(() => {
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      // Calculate results
      setState('calculating');
      setTimeout(() => {
        const scored = scoreDestinations(answers);
        setResults(scored);
        setState('results');
      }, 1500);
    }
  }, [currentQuestion, answers]);

  const handleRestart = () => {
    setState('intro');
    setCurrentQuestion(0);
    setAnswers([]);
    setResults([]);
  };

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 pt-28 lg:pt-32 pb-16">
        {state === 'intro' && (
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
              <Compass className="w-10 h-10" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Where Should <span className="text-gradient">You</span> Go?
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-lg mx-auto">
              Answer 6 quick questions about your travel style and we&apos;ll match you with your perfect destination.
            </p>
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-8 py-4 rounded-full text-lg font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
            >
              Take the Quiz
            </button>
            <p className="text-sm text-slate-400 mt-4">
              Takes about 60 seconds
            </p>
          </div>
        )}

        {state === 'questions' && (
          <QuizQuestion
            question={quizQuestions[currentQuestion]}
            questionIndex={currentQuestion}
            totalQuestions={quizQuestions.length}
            selected={answers[currentQuestion] || []}
            onSelect={handleSelect}
            onNext={handleNext}
          />
        )}

        {state === 'calculating' && (
          <div className="text-center pt-20 animate-fade-in">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Finding your perfect match...
            </h2>
            <p className="text-slate-500">
              Analyzing your travel personality
            </p>
          </div>
        )}

        {state === 'results' && (
          <QuizResults results={results} onRestart={handleRestart} />
        )}
      </div>
    </main>
  );
}
