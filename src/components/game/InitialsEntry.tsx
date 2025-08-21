import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InitialsBadge } from "./InitialsBadge";

interface Props {
  score: number;
  onSubmit: (initials: string) => void;
}

export const InitialsEntry: React.FC<Props> = ({ score, onSubmit }) => {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const initials = val.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    if (initials.length === 0) return;
    onSubmit(initials);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const key = e.key;
    if (key === "ArrowRight") {
      e.preventDefault();
      saveBtnRef.current?.focus();
    } else if (key === "ArrowLeft") {
      e.preventDefault();
      inputRef.current?.focus();
    } else if (key === "Enter") {
      // Let focused element handle Enter (form submit or button click)
    }
  };

  return (
    <div className="mt-6 p-4 bg-card/70 border border-border/60 rounded-lg backdrop-blur-sm animate-enter" onKeyDown={handleKeyDown}>
      <div className="text-sm uppercase tracking-wide text-muted-foreground">New High Score</div>
      <div className="mt-1 text-2xl font-bold">{score}</div>
      <form onSubmit={submit} className="mt-4 flex items-center gap-4">
        <InitialsBadge initials={val.toUpperCase()} />
        <input
          ref={inputRef}
          type="text"
          maxLength={3}
          placeholder="Enter initials"
          value={val}
          onChange={(e) => setVal(e.target.value.toUpperCase())}
          className="bg-background/60 border border-border/60 rounded-md px-3 py-2 w-36 text-center tracking-widest font-mono text-lg outline-none focus:ring-2 focus:ring-[hsl(var(--neon))]"
        />
        <Button ref={saveBtnRef} variant="neon" type="submit">Save</Button>
      </form>
    </div>
  );
};
