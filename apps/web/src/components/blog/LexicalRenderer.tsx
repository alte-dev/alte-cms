import React from "react";
import Link from "next/link";
import { safeHref } from "@/lib/safe-href";

interface LexicalNode {
  type: string;
  tag?: string;
  text?: string;
  format?: number;
  fields?: Record<string, any>;
  children?: LexicalNode[];
  value?: any;
  [key: string]: any;
}

// Lexical text format bitmask flags
const IS_BOLD = 1;
const IS_ITALIC = 2;
const IS_STRIKETHROUGH = 4;
const IS_UNDERLINE = 8;
const IS_CODE = 16;
const IS_SUBSCRIPT = 32;
const IS_SUPERSCRIPT = 64;

function renderTextNode(node: LexicalNode, key: number | string) {
  let content: React.ReactNode = node.text || "";
  const format = node.format || 0;

  if (format & IS_CODE) {
    content = (
      <code className="bg-zinc-100 text-pink-600 rounded px-1.5 py-0.5 text-sm font-mono">
        {content}
      </code>
    );
  }
  if (format & IS_BOLD) {
    content = <strong>{content}</strong>;
  }
  if (format & IS_ITALIC) {
    content = <em>{content}</em>;
  }
  if (format & IS_UNDERLINE) {
    content = <u>{content}</u>;
  }
  if (format & IS_STRIKETHROUGH) {
    content = <s>{content}</s>;
  }
  if (format & IS_SUBSCRIPT) {
    content = <sub>{content}</sub>;
  }
  if (format & IS_SUPERSCRIPT) {
    content = <sup>{content}</sup>;
  }

  return <React.Fragment key={key}>{content}</React.Fragment>;
}

function renderNode(node: LexicalNode, index: number): React.ReactNode {
  if (node.type === "text") {
    return renderTextNode(node, index);
  }

  const children = node.children?.map((child, idx) => renderNode(child, idx));

  switch (node.type) {
    case "paragraph":
      return (
        <p key={index} className="text-zinc-700 leading-relaxed mb-4 text-base sm:text-lg">
          {children && children.length > 0 ? children : <br />}
        </p>
      );

    case "heading": {
      const tag = node.tag || "h2";
      if (tag === "h1") {
        return (
          <h1
            key={index}
            className="text-3xl sm:text-4xl font-extrabold text-zinc-900 mt-8 mb-4 tracking-tight"
          >
            {children}
          </h1>
        );
      }
      if (tag === "h2") {
        return (
          <h2
            key={index}
            className="text-2xl sm:text-3xl font-bold text-zinc-900 mt-8 mb-4 tracking-tight"
          >
            {children}
          </h2>
        );
      }
      if (tag === "h3") {
        return (
          <h3
            key={index}
            className="text-xl sm:text-2xl font-bold text-zinc-900 mt-6 mb-3 tracking-tight"
          >
            {children}
          </h3>
        );
      }
      return (
        <h4 key={index} className="text-lg font-bold text-zinc-900 mt-4 mb-2">
          {children}
        </h4>
      );
    }

    case "list": {
      if (node.tag === "ol" || node.listType === "number") {
        return (
          <ol key={index} className="list-decimal list-inside space-y-2 mb-4 text-zinc-700 pl-4">
            {children}
          </ol>
        );
      }
      return (
        <ul key={index} className="list-disc list-inside space-y-2 mb-4 text-zinc-700 pl-4">
          {children}
        </ul>
      );
    }

    case "listitem":
      return (
        <li key={index} className="leading-relaxed">
          {children}
        </li>
      );

    case "quote":
      return (
        <blockquote
          key={index}
          className="border-l-4 border-zinc-400 pl-4 py-1 italic text-zinc-600 my-6"
        >
          {children}
        </blockquote>
      );

    case "link": {
      const rawUrl = node.fields?.url || node.url || "#";
      const safeUrl = safeHref(rawUrl);
      const isExternal = safeUrl.startsWith("https://");
      return (
        <Link
          key={index}
          href={safeUrl}
          target={isExternal || node.fields?.newTab ? "_blank" : undefined}
          rel={isExternal || node.fields?.newTab ? "noopener noreferrer" : undefined}
          className="text-blue-600 underline hover:text-blue-800 transition-colors"
        >
          {children}
        </Link>
      );
    }

    case "upload": {
      const media = node.value;
      if (!media || !media.url) return null;
      return (
        <figure key={index} className="my-8">
          <img
            src={media.url}
            alt={media.alt || "Görsel"}
            className="w-full rounded-xl object-cover max-h-[500px]"
            loading="lazy"
          />
          {media.caption && (
            <figcaption className="text-center text-xs text-zinc-500 mt-2">
              {media.caption}
            </figcaption>
          )}
        </figure>
      );
    }

    default:
      return <React.Fragment key={index}>{children}</React.Fragment>;
  }
}

export function LexicalRenderer({ content }: { content?: any }) {
  if (!content) return null;

  if (typeof content === "string") {
    return (
      <div className="prose max-w-none text-zinc-700 leading-relaxed whitespace-pre-line">
        {content}
      </div>
    );
  }

  const root = content.root || content;
  if (!root || !Array.isArray(root.children)) {
    return null;
  }

  return (
    <div className="prose prose-zinc max-w-none">
      {root.children.map((node: LexicalNode, idx: number) => renderNode(node, idx))}
    </div>
  );
}
