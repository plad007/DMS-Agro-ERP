import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  searchPlaceholder?: string;
  dropdownMinWidth?: number;
  maxInlineTags?: number;
  sortAlphabetically?: boolean;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

const normalizeSearchText = (val: string): string =>
  val
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  placeholder = 'Todos',
  options,
  selectedValues,
  onChange,
  className = '',
  searchPlaceholder = 'Pesquisar...',
  dropdownMinWidth = 280,
  maxInlineTags = 1,
  sortAlphabetically = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const orderedOptions = useMemo(() => {
    if (!sortAlphabetically) return options;
    return [...options].sort((a, b) =>
      a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' })
    );
  }, [options, sortAlphabetically]);

  const optionByValue = useMemo(() => {
    const map = new Map<string, MultiSelectOption>();
    for (const opt of orderedOptions) {
      map.set(opt.value, opt);
    }
    return map;
  }, [orderedOptions]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 12;

    const width = Math.min(viewportW - margin * 2, Math.max(rect.width, dropdownMinWidth));
    const left = Math.max(margin, Math.min(rect.left, viewportW - width - margin));

    const spaceBelow = viewportH - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUpward = spaceBelow < 240 && spaceAbove > spaceBelow;
    const availableHeight = openUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(210, Math.min(410, availableHeight));

    if (openUpward) {
      setPosition({
        bottom: viewportH - rect.top + 4,
        left,
        width,
        maxHeight
      });
    } else {
      setPosition({
        top: rect.bottom + 4,
        left,
        width,
        maxHeight
      });
    }
  }, [dropdownMinWidth]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);

    const handleReposition = () => updatePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const trimmedSearch = search.trim();

  const filteredOptions = useMemo(() => {
    if (!trimmedSearch) return orderedOptions;
    const normTerm = normalizeSearchText(trimmedSearch);
    const digitsTerm = trimmedSearch.replace(/\D/g, '');

    return orderedOptions.filter((opt) => {
      const normLabel = normalizeSearchText(opt.label);
      if (normLabel.includes(normTerm)) return true;

      if (opt.subLabel) {
        const normSub = normalizeSearchText(opt.subLabel);
        if (normSub.includes(normTerm)) return true;

        if (digitsTerm.length >= 2) {
          const subDigits = opt.subLabel.replace(/\D/g, '');
          if (subDigits.includes(digitsTerm)) return true;
        }
      }

      return false;
    });
  }, [orderedOptions, trimmedSearch]);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const toggleValue = (val: string) => {
    if (selectedSet.has(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const removeSingleValue = (val: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== val));
  };

  const selectAllTarget = () => {
    if (!trimmedSearch) {
      onChange(orderedOptions.map((o) => o.value));
      return;
    }
    const next = new Set(selectedValues);
    filteredOptions.forEach((opt) => next.add(opt.value));
    onChange(Array.from(next));
  };

  const clearSelection = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange([]);
  };

  const selectedItemsMeta = useMemo(
    () =>
      selectedValues.map((val) => ({
        value: val,
        label: optionByValue.get(val)?.label || val
      })),
    [selectedValues, optionByValue]
  );

  const visibleInlineTags = selectedItemsMeta.slice(0, maxInlineTags);
  const hiddenTagsCount = Math.max(0, selectedItemsMeta.length - visibleInlineTags.length);

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1 truncate" title={label}>
        {label}
      </label>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full min-h-[38px] flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border bg-white text-left transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          selectedValues.length > 0
            ? 'border-emerald-500 text-slate-900'
            : 'border-slate-300 text-slate-600 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          {selectedValues.length === 0 ? (
            <span className="truncate text-slate-500 px-0.5">{placeholder}</span>
          ) : (
            <>
              {visibleInlineTags.map((item) => (
                <span
                  key={item.value}
                  className="inline-flex items-center gap-1 max-w-full min-w-0 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded px-1.5 py-0.5 text-[11px] font-medium"
                  title={item.label}
                >
                  <span className="truncate">{item.label}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => removeSingleValue(item.value, e)}
                    title={`Remover ${item.label}`}
                    className="text-emerald-700 hover:text-red-600 shrink-0 rounded-xs p-0.5 -mr-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </span>
                </span>
              ))}
              {hiddenTagsCount > 0 && (
                <span
                  className="inline-flex items-center shrink-0 bg-slate-100 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
                  title={`${selectedValues.length} selecionado(s)`}
                >
                  +{hiddenTagsCount} ({selectedValues.length})
                </span>
              )}
            </>
          )}
        </div>

        <span className="flex items-center gap-1 shrink-0">
          {selectedValues.length > 0 && (
            <span
              role="button"
              tabIndex={-1}
              onClick={clearSelection}
              title="Limpar seleção"
              className="p-0.5 text-slate-400 hover:text-red-600 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight
            }}
            className="z-[90] bg-white border border-slate-300 rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Sticky Search + Bulk Actions Header */}
            <div className="p-2.5 border-b border-slate-200 bg-slate-50 space-y-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      searchInputRef.current?.focus();
                    }}
                    title="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-600 font-medium tabular-nums">
                  <strong className="text-emerald-800">{selectedValues.length}</strong> de{' '}
                  {orderedOptions.length} selecionado(s)
                </span>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={selectAllTarget}
                    disabled={filteredOptions.length === 0}
                    className="text-emerald-700 hover:text-emerald-900 disabled:text-slate-300 font-semibold"
                    title={
                      trimmedSearch
                        ? 'Seleciona apenas os itens correspondentes à busca atual'
                        : 'Seleciona todos os itens da lista'
                    }
                  >
                    {trimmedSearch
                      ? `Selecionar filtrados (${filteredOptions.length})`
                      : `Selecionar todos (${orderedOptions.length})`}
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    disabled={selectedValues.length === 0}
                    className="text-slate-600 hover:text-red-600 disabled:text-slate-300 font-semibold"
                  >
                    Limpar seleção
                  </button>
                </div>
              </div>
            </div>

            {/* Selected Items Removable Strip */}
            {selectedItemsMeta.length > 0 && (
              <div className="px-2.5 py-1.5 border-b border-slate-100 bg-emerald-50/40 max-h-20 overflow-y-auto flex flex-wrap gap-1 shrink-0">
                {selectedItemsMeta.map((item) => (
                  <span
                    key={item.value}
                    className="inline-flex items-center gap-1 max-w-full bg-white border border-emerald-200 text-emerald-900 rounded px-1.5 py-0.5 text-[11px] font-medium"
                  >
                    <span className="truncate max-w-[180px]" title={item.label}>
                      {item.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSingleValue(item.value)}
                      title={`Remover ${item.label}`}
                      className="text-slate-400 hover:text-red-600 shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Independent Scrollable Options List */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 bg-white" role="listbox" aria-multiselectable="true">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-xs text-slate-500 text-center space-y-1.5">
                  <p>Nenhuma opção encontrada{trimmedSearch ? ` para "${trimmedSearch}"` : ''}.</p>
                  {trimmedSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        searchInputRef.current?.focus();
                      }}
                      className="text-emerald-700 hover:underline font-semibold"
                    >
                      Limpar pesquisa
                    </button>
                  )}
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = selectedSet.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggleValue(opt.value)}
                      className={`w-full px-3 py-2 text-left text-xs flex items-start gap-2.5 hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-emerald-50/60' : ''
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-slate-800 font-medium leading-snug break-words">
                          {opt.label}
                        </span>
                        {opt.subLabel && (
                          <span className="block text-[10px] text-slate-500 truncate mt-0.5">
                            {opt.subLabel}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
