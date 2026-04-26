import type { CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../../../types'
import { ChatToolCard } from './ChatToolCard'

export function ChatMessageView({
  message,
  storyId,
  threadId,
}: {
  message: ChatMessage
  storyId: string
  threadId: string
}) {
  void storyId
  void threadId

  // Pure tool messages (read-tool results) are not rendered — the AI consumed them already.
  if (message.role === 'tool') return null

  // Assistant messages with tool calls render as approval cards (proposed/applied/rejected)
  if (
    message.role === 'assistant' &&
    message.tool_call_status &&
    message.tool_calls &&
    message.tool_calls.length > 0
  ) {
    return <ChatToolCard message={message} />
  }

  // User: plain text (typed as-is, no formatting expected).
  if (message.role === 'user') {
    return <div style={userBubble}>{message.content}</div>
  }

  // Assistant: markdown via react-markdown. ReactMarkdown builds an AST
  // (no innerHTML), so no XSS risk from arbitrary input.
  return (
    <div style={assistantBubble}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MDComponents}>
        {message.content ?? ''}
      </ReactMarkdown>
    </div>
  )
}

const userBubble: CSSProperties = {
  alignSelf: 'flex-end',
  maxWidth: '85%',
  padding: '8px 10px',
  background: 'var(--ink)',
  color: 'var(--paper)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
}

const assistantBubble: CSSProperties = {
  alignSelf: 'flex-start',
  maxWidth: '95%',
  padding: '8px 10px',
  background: 'var(--paper-2)',
  borderLeft: '2px solid var(--blue)',
  color: 'var(--ink)',
  fontFamily: 'var(--font-serif)',
  fontSize: 14,
  lineHeight: 1.55,
}

// Markdown component overrides — keep things in the project's blueprint aesthetic
// (mono for code, blue for links, paper-2 for code blocks, etc.) and tighten spacing
// so chat replies don't feel like blog posts.
const MDComponents = {
  p: (props: any) => <p style={{ margin: '0 0 6px' }} {...props} />,
  h1: (props: any) => <h3 style={mdHeading} {...props} />,
  h2: (props: any) => <h3 style={mdHeading} {...props} />,
  h3: (props: any) => <h3 style={mdHeading} {...props} />,
  h4: (props: any) => <h4 style={mdHeading} {...props} />,
  ul: (props: any) => <ul style={{ margin: '0 0 6px', paddingLeft: 18 }} {...props} />,
  ol: (props: any) => <ol style={{ margin: '0 0 6px', paddingLeft: 18 }} {...props} />,
  li: (props: any) => <li style={{ marginBottom: 2 }} {...props} />,
  a: (props: any) => (
    <a style={{ color: 'var(--blue)', textDecoration: 'underline' }} target="_blank" rel="noreferrer" {...props} />
  ),
  code: ({ inline, ...props }: any) =>
    inline ? (
      <code style={mdInlineCode} {...props} />
    ) : (
      <code style={mdBlockCode} {...props} />
    ),
  pre: (props: any) => <pre style={mdPre} {...props} />,
  blockquote: (props: any) => <blockquote style={mdQuote} {...props} />,
  table: (props: any) => <table style={mdTable} {...props} />,
  th: (props: any) => <th style={mdTh} {...props} />,
  td: (props: any) => <td style={mdTd} {...props} />,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '8px 0' }} />,
}

const mdHeading: CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontWeight: 500,
  fontSize: 15,
  margin: '6px 0 4px',
}
const mdInlineCode: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  padding: '0 4px',
}
const mdBlockCode: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  display: 'block',
}
const mdPre: CSSProperties = {
  margin: '4px 0 6px',
  padding: 8,
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  overflow: 'auto',
  whiteSpace: 'pre',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
}
const mdQuote: CSSProperties = {
  margin: '4px 0 6px',
  paddingLeft: 8,
  borderLeft: '2px solid var(--line)',
  color: 'var(--ink-2)',
}
const mdTable: CSSProperties = {
  borderCollapse: 'collapse',
  margin: '4px 0',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
}
const mdTh: CSSProperties = {
  border: '1px solid var(--line)',
  padding: '2px 6px',
  textAlign: 'left',
  background: 'var(--paper)',
}
const mdTd: CSSProperties = {
  border: '1px solid var(--line)',
  padding: '2px 6px',
}
