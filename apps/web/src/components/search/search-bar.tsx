"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, X, Loader2 } from "lucide-react";

interface SuggestionItem {
  id: string;
  title: string;
  handle: string;
  thumbnail?: string | null;
  formattedPrice?: string;
}

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close suggestions popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions with 250ms debounce
  const fetchSuggestions = useCallback(async (searchTerm: string) => {
    if (searchTerm.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchTerm.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setIsOpen(true);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 250);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;

    setIsOpen(false);
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      router.push(`/urun/${suggestions[selectedIndex].handle}`);
    } else {
      router.push(`/ara?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    }
  };

  const clearQuery = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm lg:max-w-md">
      <form onSubmit={handleSubmit} role="search" className="relative flex items-center">
        <label htmlFor="store-search-input" className="sr-only">
          Ürünlerde Ara
        </label>
        <div className="relative w-full flex items-center">
          <input
            ref={inputRef}
            id="store-search-input"
            type="search"
            role="combobox"
            aria-haspopup="listbox"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ürün, kategori veya stil ara..."
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls="search-suggestions-list"
            className="w-full pl-9 pr-14 py-1.5 text-xs sm:text-sm bg-stone-100/80 hover:bg-stone-100 focus:bg-white text-stone-900 placeholder:text-stone-600 rounded-full border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition"
          />

          <Search className="absolute left-3 w-4 h-4 text-stone-500 pointer-events-none" />

          <div className="absolute right-3 flex items-center gap-1">
            {isLoading && (
              <Loader2 className="w-3.5 h-3.5 text-stone-500 animate-spin" aria-hidden="true" />
            )}
            {query.length > 0 && !isLoading && (
              <button
                type="button"
                onClick={clearQuery}
                aria-label="Aramayı temizle"
                className="text-stone-600 hover:text-stone-900 transition p-0.5 rounded-full hover:bg-stone-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Autocomplete Dropdown Popover */}
      {isOpen && suggestions.length > 0 && (
        <div
          id="search-suggestions-list"
          role="listbox"
          aria-label="Arama önerileri"
          className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-stone-200 py-2 z-50 overflow-hidden max-h-96 overflow-y-auto divide-y divide-stone-100"
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            Önerilen Ürünler
          </div>
          {suggestions.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Link
                key={item.id}
                href={`/urun/${item.handle}`}
                onClick={() => setIsOpen(false)}
                role="option"
                aria-selected={isSelected}
                className={`flex items-center gap-3 px-3 py-2 transition ${
                  isSelected ? "bg-stone-100 text-stone-900" : "hover:bg-stone-50 text-stone-800"
                }`}
              >
                <div className="w-10 h-10 relative bg-stone-100 rounded-md overflow-hidden flex-shrink-0">
                  {item.thumbnail ? (
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <Search className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium truncate">{item.title}</div>
                  {item.formattedPrice && (
                    <div className="text-xs text-stone-500 font-semibold">
                      {item.formattedPrice}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          <div className="p-2 bg-stone-50 text-center">
            <Link
              href={`/ara?q=${encodeURIComponent(query.trim())}`}
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-stone-900 hover:text-stone-700 underline block"
            >
              Tüm sonuçları gör ({query}) →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
