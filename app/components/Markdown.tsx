import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

/**
 * Server-rendered Markdown for read-only surfaces (public share pages and AI
 * answers). The editor keeps its own client-side preview because typing is
 * client state, but both use the same highlight pipeline so a snippet looks
 * identical before and after publishing.
 */
export function Markdown({
  children,
  className = "prose-note",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeHighlight, { detect: false, plainText: ["plaintext"] }],
        ]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
