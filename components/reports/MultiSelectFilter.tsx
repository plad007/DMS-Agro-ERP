import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  subLabel?: string;
}

interface MultiSelectFilterProps {
  label: string;
  placeholder?: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (nextValues: string[]) => void;
  className?: string;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  placeholder = 'Todos',
  options,
  selectedValues,
  onChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const filteredOptions = options.filter((opt) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(term))
    );
  });

  const selectedSet = new Set(selectedValues);

  const toggleValue = (val: string) => {
    if (selectedSet.has(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedValues);
    filteredOptions.forEach((opt) => next.add(opt.value));
    onChange(Array.from(next));
  };

  const clearSelection = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange([]);
  };

  const summaryText =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.length === 1
      ? options.find((o) => o.value === selectedValues[0])?.label || selectedValues[0]
      : `${selectedValues.length} selecionados`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1 truncate">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg border bg-white text-left transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          selectedValues.length > 0
            ? 'border-emerald-500 text-slate-900 font-medium'
            : 'border-slate-300 text-slate-600 hover:border-slate-400'
        }`}
      >
        <span className="truncate flex-1">{summaryText}</span>
        <span className="flex items-center gap-1 shrink-0">
          {selectedValues.length > 0 && (
            <span
              role="button"
              tabIndex={-1}
              onClick={clearSelection}
              title="Limpar seleção"
              className="p-0.5 text-slate-400 hover:text-red-600 rounded"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-40 mt-1 w-full min-w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-slate-50 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar..."
                className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-emerald-700 hover:text-emerald-800 font-medium"
              >
                Selecionar todos ({filteredOptions.length})
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-slate-500 hover:text-red-600 font-medium"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-xs text-slate-400 text-center">Nenhum item encontrado.</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedSet.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleValue(opt.value)}
                    className={`w-full px-3 py-2 text-left text-xs flex items-start gap-2.5 hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-emerald-50/70' : ''
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-slate-800 font-medium truncate">{opt.label}</span>
                      {opt.subLabel && (
                        <span className="block text-[10px] text-slate-400 truncate">{opt.subLabel}</span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
