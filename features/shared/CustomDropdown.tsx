"use client";

import { useEffect, useId, useRef, useState } from "react";

export type DropdownOption = {
  value: string;
  label: string;
};

export default function CustomDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = "Choose an option",
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  const focusOption = (index: number) => {
    if (!options.length) return;
    const nextIndex = (index + options.length) % options.length;
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <span id={`${id}-label`} className="sr-only">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${selected?.label || placeholder}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusOption(selectedIndex >= 0 ? selectedIndex : 0));
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#111211] px-3 py-2.5 text-left text-[13px] text-white transition hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4f36a]/70"
      >
        <span className={selected ? "" : "text-white/45"}>{selected?.label || placeholder}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} fill="none">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute bottom-full z-50 mb-2 max-h-56 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#171918] p-1 shadow-2xl shadow-black/50"
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  focusOption(index + 1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  focusOption(index - 1);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                  triggerRef.current?.focus();
                } else if (event.key === "Home") {
                  event.preventDefault();
                  focusOption(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  focusOption(options.length - 1);
                }
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] transition hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none ${option.value === value ? "text-[#d4f36a]" : "text-white/80"}`}
            >
              {option.label}
              {option.value === value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
