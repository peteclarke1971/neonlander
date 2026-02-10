import { useEffect, useRef, useState } from "react";

interface TerminalTextProps {
  text: string;
  className?: string;
  speed?: number;
}

export default function TerminalText({ text, className = "", speed = 40 }: TerminalTextProps) {
  const [displayed, setDisplayed] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const indexRef = useRef(0);
  const textRef = useRef(text);

  // Reset when text changes
  useEffect(() => {
    textRef.current = text;
    indexRef.current = 0;
    setDisplayed("");

    if (!text) return;

    const typing = setInterval(() => {
      indexRef.current++;
      const i = indexRef.current;
      if (i >= textRef.current.length) {
        clearInterval(typing);
      }
      setDisplayed(textRef.current.slice(0, i));
    }, speed);

    return () => clearInterval(typing);
  }, [text, speed]);

  // Blinking cursor
  useEffect(() => {
    const blink = setInterval(() => setCursorVisible(v => !v), 530);
    return () => clearInterval(blink);
  }, []);

  return (
    <p
      className={className}
      style={{
        fontFamily: '"Orbitron", sans-serif',
        color: "hsl(var(--neon))",
        textShadow: "0 0 8px hsl(var(--neon) / 0.5)",
        minHeight: "2em",
      }}
    >
      {displayed}
      <span style={{ opacity: cursorVisible ? 1 : 0 }}>_</span>
    </p>
  );
}
