import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
}

export function FAQAccordion({ items }: FAQAccordionProps) {
  return (
    <div className="divide-y divide-gray-200 border-t border-b border-gray-200">
      {items.map((item, index) => (
        <details key={index} className="group">
          <summary className="min-h-12 w-full cursor-pointer list-none flex items-center justify-between py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900">
            <span className="text-lg font-medium text-gray-900 group-hover:text-primary transition-colors pr-4">
              {item.question}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="w-5 h-5 text-gray-500 flex-shrink-0 group-open:rotate-180 motion-safe:transition-transform duration-200"
            />
          </summary>
          <p className="pb-5 text-gray-600 leading-relaxed">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
