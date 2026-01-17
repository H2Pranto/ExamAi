
import React from 'react';
import * as LucideIcons from 'lucide-react';
import katex from 'katex';

interface RichTextProps {
  text: string;
  isOption?: boolean;
}

export const RichText: React.FC<RichTextProps> = ({ text, isOption = false }) => {
  if (!text) return null;

  // Unified Regex:
  // 1. [icon:Name]
  // 2. [img:Source]
  // 3. **Bold** (supports multiline)
  // 4. $Math$ (supports multiline)
  const regex = /(\[icon:\w+\]|\[img:[^\]]+\]|\*\*[\s\S]*?\*\*|\$[\s\S]*?\$)/g;
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        // 1. Check for Icon: [icon:Name]
        if (part.startsWith('[icon:') && part.endsWith(']')) {
          const iconName = part.slice(6, -1);
          const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.Info;
          return (
            <span key={i} className="inline-flex items-center align-middle mx-1">
              <IconComponent size={isOption ? 16 : 20} className="text-current" />
            </span>
          );
        }

        // 2. Check for Image: [img:Source]
        if (part.startsWith('[img:') && part.endsWith(']')) {
          const imgSrc = part.slice(5, -1);
          return (
            <div key={i} className={`my-2 ${isOption ? 'max-w-[120px]' : 'max-w-full'}`}>
              <img 
                src={imgSrc} 
                alt="Visual Content" 
                className="rounded-lg border border-gray-200 shadow-sm h-auto block"
                loading="lazy"
              />
            </div>
          );
        }

        // 3. Check for Bold: **Text**
        if (part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2);
          return (
            <strong key={i} className="font-extrabold text-slate-900 mx-0.5">
              <RichText text={boldText} isOption={isOption} />
            </strong>
          );
        }

        // 4. Check for Math: $Formula$
        if (part.startsWith('$') && part.endsWith('$')) {
          const formula = part.slice(1, -1);
          try {
            const html = katex.renderToString(formula, {
              throwOnError: false,
              displayMode: false,
              output: 'html', // Generate HTML output only (no MathML) for consistency
            });
            return (
              <span 
                key={i} 
                className="inline-block mx-1 align-middle text-base"
                dangerouslySetInnerHTML={{ __html: html }} 
              />
            );
          } catch (e) {
            return <code key={i} className="bg-gray-100 px-1 rounded text-red-500 text-xs">{formula}</code>;
          }
        }

        // 5. Regular text
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};
