"use client";

import type {
  QuizQuestion as QuizQuestionType,
  QuizOption,
} from "@/lib/tools/quiz-questions";

interface QuizQuestionProps {
  question: QuizQuestionType;
  questionIndex: number;
  totalQuestions: number;
  selected: QuizOption[];
  onSelect: (options: QuizOption[]) => void;
  onAdvance: (options: QuizOption[]) => void;
  onBack: () => void;
}

export function QuizQuestion({
  question,
  questionIndex,
  totalQuestions,
  selected,
  onSelect,
  onAdvance,
  onBack,
}: QuizQuestionProps) {
  const handleSelect = (option: QuizOption) => {
    if (question.multiSelect) {
      const isSelected = selected.some((s) => s.label === option.label);
      if (isSelected) {
        onSelect(selected.filter((s) => s.label !== option.label));
      } else if (selected.length < 3) {
        onSelect([...selected, option]);
      }
    } else {
      onAdvance([option]);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-8">
        <div
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={1}
          aria-valuemax={totalQuestions}
          aria-valuenow={questionIndex + 1}
          className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-gradient-to-r from-primary to-amber-500 rounded-full transition-all duration-500"
            style={{
              width: `${((questionIndex + 1) / totalQuestions) * 100}%`,
            }}
          />
        </div>
        <span className="text-sm font-medium text-slate-500">
          {questionIndex + 1}/{totalQuestions}
        </span>
      </div>

      {questionIndex > 0 && (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 min-h-11 text-sm font-medium text-slate-700 underline underline-offset-4"
        >
          Previous question
        </button>
      )}

      <h1
        tabIndex={-1}
        className="text-2xl md:text-3xl font-bold text-slate-900 mb-2"
      >
        {question.question}
      </h1>
      <p className="text-slate-500 mb-8">{question.subtitle}</p>

      <div className="grid grid-cols-2 gap-4">
        {question.options.map((option) => {
          const isSelected = selected.some((s) => s.label === option.label);
          return (
            <button
              type="button"
              key={option.label}
              onClick={() => handleSelect(option)}
              aria-pressed={isSelected}
              className={`group p-5 rounded-2xl border-2 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-slate-200 hover:border-primary/30 hover:shadow-sm"
              }`}
            >
              <span className="text-3xl mb-3 block">{option.emoji}</span>
              <span className="text-sm font-semibold text-slate-900">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {question.multiSelect && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-500">{selected.length}/3 selected</p>
          <button
            type="button"
            onClick={() => onAdvance(selected)}
            disabled={selected.length === 0}
            className="px-6 py-2.5 rounded-full bg-slate-900 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
