import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Server-rendered Markdown for read-only surfaces (public share pages and AI
 * answers). The editor keeps its own client-side preview because typing is
 * client state.
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
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
