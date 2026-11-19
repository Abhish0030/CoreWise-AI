'use client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

export function AssistantMarkdown({ text, links = [] }: { text: string; links?: string[] }) {
  const allowed = new Set(links);
  return (
    <div className="assistant-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) =>
            href && href.startsWith('/') && !href.startsWith('//') && allowed.has(href) ? (
              <Link href={href}>{children}</Link>
            ) : (
              <span>{children}</span>
            ),
          img: () => null,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
