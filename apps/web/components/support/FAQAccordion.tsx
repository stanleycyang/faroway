"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
}

export function FAQAccordion({ items }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const idPrefix = useId();

  return (
    <div className="divide-y divide-gray-200 border-t border-b border-gray-200">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `${idPrefix}-panel-${index}`;
        return (
          <div key={item.question}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="w-full flex items-center justify-between py-5 text-left group"
            >
              <span className="text-lg font-medium text-gray-900 group-hover:text-primary transition-colors pr-4">
                {item.question}
              </span>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              id={panelId}
              hidden={!isOpen}
              className={`overflow-hidden transition-all duration-300 ${
                isOpen ? "max-h-96 pb-5" : "max-h-0"
              }`}
            >
              <p className="text-gray-600 leading-relaxed">{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
