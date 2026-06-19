import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CodeBlock({ code, language = 'javascript' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#0b0e15]">
      <div className="flex items-center justify-between border-b border-line/70 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-fg-faint">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-fg-dim transition-colors hover:text-fg"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#34e0a1]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'コピーしました' : 'コピー'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono text-fg-dim">{code}</code>
      </pre>
    </div>
  );
}
