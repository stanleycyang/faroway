"use client";

import {
  Backpack,
  ChefHat,
  CloudSun,
  Coffee,
  Compass,
  Crown,
  Flame,
  Gem,
  Heart,
  Home,
  Landmark,
  Leaf,
  Mountain,
  Scale,
  Snowflake,
  Soup,
  Sun,
  Umbrella,
  User,
  Users,
  Utensils,
  Wallet,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type {
  QuizOption,
  QuizQuestion as QuizQuestionType,
} from "@/lib/tools/quiz-questions";

const OPTION_ICONS: Record<string, LucideIcon> = {
  Backpacker: Backpack,
  "Mid-Range": Wallet,
  Splurge: Gem,
  "No Limit": Crown,
  "Hot & Sunny": Sun,
  "Warm & Mild": CloudSun,
  "Cool & Crisp": Wind,
  "Cold & Dramatic": Snowflake,
  "Museums & History": Landmark,
  "Beach & Water": Umbrella,
  "Hiking & Nature": Mountain,
  "Food & Markets": Utensils,
  "Go go go!": Zap,
  "Balanced mix": Scale,
  "Slow & easy": Leaf,
  Spontaneous: Compass,
  Solo: User,
  Partner: Heart,
  Friends: Users,
  Family: Home,
  "Play it safe": Coffee,
  "Open-minded": Soup,
  "I'll try anything": Flame,
  "Foodie is my vibe": ChefHat,
};

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
            className="h-full bg-primary-700 rounded-full transition-all duration-500"
            style={{
              width: `${((questionIndex + 1) / totalQuestions) * 100}%`,
            }}
          />
        </div>
        <span className="text-sm font-medium text-slate-600">
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
        className="font-editorial text-2xl md:text-3xl font-bold text-slate-900 mb-2"
      >
        {question.question}
      </h1>
      <p className="text-slate-600 mb-8">{question.subtitle}</p>

      <div className="grid grid-cols-2 gap-4">
        {question.options.map((option) => {
          const isSelected = selected.some((s) => s.label === option.label);
          const Icon = OPTION_ICONS[option.label] ?? Compass;
          return (
            <button
              type="button"
              key={option.label}
              onClick={() => handleSelect(option)}
              aria-pressed={isSelected}
              className={`group p-5 rounded-2xl border-2 text-left transition-all bg-white ${
                isSelected
                  ? "border-primary-700 bg-primary-50 shadow-md"
                  : "border-[#DCE5E3] hover:border-primary-700/40 hover:shadow-sm"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                  isSelected
                    ? "bg-primary-700 text-white"
                    : "bg-[#EFF5F3] text-[#143D46]"
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-slate-900">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {question.multiSelect && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-600">{selected.length}/3 selected</p>
          <button
            type="button"
            onClick={() => onAdvance(selected)}
            disabled={selected.length === 0}
            className="px-6 py-2.5 rounded-full bg-[#143D46] text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0E2C33] transition-colors"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
