const EMPTY_PARAGRAPH = { type: 'paragraph' };

function templateFromHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = typeof html === 'string' ? html : '';
  return template.content;
}

function safeUrl(value) {
  const url = String(value || '').trim();
  if (!url) return null;
  if (/^(https?:|mailto:|tel:)/i.test(url) || url.startsWith('/')) return url;
  return null;
}

function addMark(marks, mark) {
  if (!mark) return marks;
  const existing = marks.find((item) => item.type === mark.type);
  const next = marks.filter((item) => item.type !== mark.type);

  if (mark.type === 'textStyle' && existing) {
    next.push({
      type: 'textStyle',
      attrs: { ...(existing.attrs || {}), ...(mark.attrs || {}) },
    });
  } else {
    next.push(mark);
  }

  return next;
}

function marksFromElement(element, inherited = []) {
  const tag = element.tagName?.toLowerCase();
  let marks = inherited;

  if (tag === 'strong' || tag === 'b') marks = addMark(marks, { type: 'bold' });
  if (tag === 'em' || tag === 'i') marks = addMark(marks, { type: 'italic' });
  if (tag === 'u') marks = addMark(marks, { type: 'underline' });
  if (tag === 's' || tag === 'strike' || tag === 'del') marks = addMark(marks, { type: 'strike' });
  if (tag === 'code') marks = addMark(marks, { type: 'code' });

  if (tag === 'a') {
    const href = safeUrl(element.getAttribute('href'));
    if (href) {
      marks = addMark(marks, {
        type: 'link',
        attrs: {
          href,
          target: element.getAttribute('target') || null,
          rel: element.getAttribute('rel') || null,
          title: element.getAttribute('title') || null,
        },
      });
    }
  }

  const color = element.getAttribute('data-color') || element.style?.color;
  const font = element.getAttribute('data-font');
  const styles = {};
  if (color) styles.color = color;
  if (font === 'serif') styles.fontFamily = 'Georgia, serif';
  if (font === 'mono') styles.fontFamily = "'Courier New', monospace";
  if (font === 'italic') marks = addMark(marks, { type: 'italic' });
  if (font === 'bold') marks = addMark(marks, { type: 'bold' });

  if (Object.keys(styles).length) {
    marks = addMark(marks, { type: 'textStyle', attrs: styles });
  }

  return marks;
}

function blockStyleMarks(block) {
  let marks = [];
  const textStyle = {};
  if (block?.color) textStyle.color = block.color;
  if (block?.fontStyle === 'serif') textStyle.fontFamily = 'Georgia, serif';
  if (block?.fontStyle === 'mono') textStyle.fontFamily = "'Courier New', monospace";
  if (Object.keys(textStyle).length) {
    marks = addMark(marks, { type: 'textStyle', attrs: textStyle });
  }
  if (block?.fontStyle === 'italic') marks = addMark(marks, { type: 'italic' });
  if (block?.fontStyle === 'bold') marks = addMark(marks, { type: 'bold' });
  return marks;
}

function imageNode(element, overrides = {}) {
  const src = safeUrl(overrides.src || element?.getAttribute?.('src'));
  if (!src) return null;

  return {
    type: 'image',
    attrs: {
      src,
      alt: overrides.alt ?? element?.getAttribute?.('alt') ?? null,
      title: overrides.title ?? element?.getAttribute?.('title') ?? null,
      position: overrides.position ?? element?.getAttribute?.('data-position') ?? 'center',
      size: overrides.size ?? element?.getAttribute?.('data-size') ?? 'medium',
      caption: overrides.caption ?? element?.getAttribute?.('data-caption') ?? '',
    },
  };
}

function inlineNodesFromDom(nodes, inheritedMarks = []) {
  const result = [];

  for (const node of Array.from(nodes || [])) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue) {
        result.push({
          type: 'text',
          text: node.nodeValue,
          ...(inheritedMarks.length ? { marks: inheritedMarks } : {}),
        });
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = node.tagName.toLowerCase();

    if (tag === 'br') {
      result.push({ type: 'hardBreak' });
      continue;
    }

    if (tag === 'img') {
      const image = imageNode(node);
      if (image) result.push(image);
      continue;
    }

    result.push(...inlineNodesFromDom(node.childNodes, marksFromElement(node, inheritedMarks)));
  }

  return result;
}

function paragraphFromDom(element, marks = []) {
  const content = inlineNodesFromDom(element?.childNodes, marks);
  return { type: 'paragraph', ...(content.length ? { content } : {}) };
}

function headingFromDom(element) {
  const level = Number(element.tagName.slice(1));
  const content = inlineNodesFromDom(element.childNodes);
  return {
    type: 'heading',
    attrs: { level: Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1 },
    ...(content.length ? { content } : {}),
  };
}

function listItemFromDom(element, marks = []) {
  const content = [];
  let inlineBuffer = [];

  const flushInline = () => {
    if (!inlineBuffer.length) return;
    content.push({ type: 'paragraph', content: inlineBuffer });
    inlineBuffer = [];
  };

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        flushInline();
        const nested = listFromDom(child, marks);
        if (nested) content.push(nested);
      } else if (tag === 'p') {
        flushInline();
        content.push(paragraphFromDom(child, marks));
      } else {
        inlineBuffer.push(...inlineNodesFromDom([child], marks));
      }
    } else {
      inlineBuffer.push(...inlineNodesFromDom([child], marks));
    }
  }

  flushInline();
  if (!content.length) content.push(EMPTY_PARAGRAPH);
  return { type: 'listItem', content };
}

function listFromDom(element, marks = []) {
  const ordered = element.tagName.toLowerCase() === 'ol';
  const items = Array.from(element.children)
    .filter((child) => child.tagName.toLowerCase() === 'li')
    .map((item) => listItemFromDom(item, marks));

  if (!items.length) return null;

  return {
    type: ordered ? 'orderedList' : 'bulletList',
    ...(ordered ? { attrs: { start: Number(element.getAttribute('start')) || 1 } } : {}),
    content: items,
  };
}

function tableFromDom(element, marks = []) {
  const rows = Array.from(element.querySelectorAll('tr')).map((row) => {
    const cells = Array.from(row.children)
      .filter((cell) => ['td', 'th'].includes(cell.tagName.toLowerCase()))
      .map((cell) => {
        const inline = inlineNodesFromDom(cell.childNodes, marks);
        const cellContent = inline.length
          ? [{ type: 'paragraph', content: inline }]
          : [EMPTY_PARAGRAPH];

        return {
          type: cell.tagName.toLowerCase() === 'th' ? 'tableHeader' : 'tableCell',
          attrs: {
            colspan: Math.max(1, Number(cell.getAttribute('colspan')) || 1),
            rowspan: Math.max(1, Number(cell.getAttribute('rowspan')) || 1),
            colwidth: null,
          },
          content: cellContent,
        };
      });

    return cells.length ? { type: 'tableRow', content: cells } : null;
  }).filter(Boolean);

  return rows.length ? { type: 'table', content: rows } : null;
}

function htmlBlocksFromDom(nodes) {
  const result = [];

  for (const node of Array.from(nodes || [])) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue.trim()) {
        result.push({
          type: 'paragraph',
          content: [{ type: 'text', text: node.nodeValue }],
        });
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = node.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      result.push(headingFromDom(node));
    } else if (tag === 'p') {
      result.push(paragraphFromDom(node));
    } else if (tag === 'ul' || tag === 'ol') {
      const list = listFromDom(node);
      if (list) result.push(list);
    } else if (tag === 'table') {
      const table = tableFromDom(node);
      if (table) result.push(table);
    } else if (tag === 'hr') {
      result.push({ type: 'horizontalRule' });
    } else if (tag === 'pre') {
      const code = node.querySelector('code') || node;
      result.push({
        type: 'codeBlock',
        attrs: { language: node.getAttribute('data-language') || 'text' },
        content: code.textContent
          ? [{ type: 'text', text: code.textContent }]
          : undefined,
      });
    } else if (tag === 'figure' && node.querySelector('img')) {
      const img = node.querySelector('img');
      const caption = node.querySelector('figcaption')?.textContent || '';
      const image = imageNode(img, { caption });
      if (image) result.push(image);
    } else if (tag === 'img') {
      const image = imageNode(node);
      if (image) result.push(image);
    } else if (node.classList.contains('note-fact-card')) {
      const body = node.querySelector('.note-fact-content') || node;
      const content = htmlBlocksFromDom(body.childNodes);
      result.push({
        type: 'factCard',
        attrs: {
          emoji: node.querySelector('.note-fact-emoji')?.textContent || '💡',
          color: node.getAttribute('data-color') || node.style.color || null,
          fontStyle: node.getAttribute('data-font') || null,
        },
        content: content.length ? content : [EMPTY_PARAGRAPH],
      });
    } else if (tag === 'div') {
      result.push(...htmlBlocksFromDom(node.childNodes));
    } else {
      const paragraph = paragraphFromDom(node);
      result.push(paragraph);
    }
  }

  return result;
}

function legacyBlockToTiptapNode(block) {
  if (!block || typeof block !== 'object') return null;
  const content = typeof block.content === 'string' ? block.content : '';
  const blockMarks = blockStyleMarks(block);

  if (/^h[1-6]$/.test(block.type)) {
    const level = Number(block.type.slice(1));
    const parsed = inlineNodesFromDom(templateFromHtml(content).childNodes, blockMarks);
    return {
      type: 'heading',
      attrs: { level },
      ...(parsed.length ? { content: parsed } : {}),
    };
  }

  if (block.type === 'text') {
    const parsed = inlineNodesFromDom(templateFromHtml(content).childNodes, blockMarks);
    return { type: 'paragraph', ...(parsed.length ? { content: parsed } : {}) };
  }

  if (block.type === 'ul' || block.type === 'ol') {
    const wrapper = document.createElement(block.type);
    wrapper.innerHTML = content;
    return listFromDom(wrapper, blockMarks) || EMPTY_PARAGRAPH;
  }

  if (block.type === 'table') {
    const wrapper = document.createElement('table');
    wrapper.innerHTML = content;
    return tableFromDom(wrapper, blockMarks) || EMPTY_PARAGRAPH;
  }

  if (block.type === 'image') {
    const image = imageNode(null, {
      src: content,
      alt: block.alt || null,
      title: null,
      position: block.position || 'center',
      size: block.size || 'medium',
      caption: block.caption || '',
    });
    return image;
  }

  if (block.type === 'divider') return { type: 'horizontalRule' };

  if (block.type === 'code') {
    return {
      type: 'codeBlock',
      attrs: { language: block.language || 'text' },
      ...(content ? { content: [{ type: 'text', text: content }] } : {}),
    };
  }

  if (block.type === 'fact') {
    const parsed = htmlBlocksFromDom(templateFromHtml(content).childNodes);
    return {
      type: 'factCard',
      attrs: {
        emoji: '💡',
        color: block.color || null,
        fontStyle: block.fontStyle || null,
      },
      content: parsed.length ? parsed : [EMPTY_PARAGRAPH],
    };
  }

  const parsed = inlineNodesFromDom(templateFromHtml(content).childNodes, blockMarks);
  return { type: 'paragraph', ...(parsed.length ? { content: parsed } : {}) };
}

/**
 * Convert the old NoteChunk.blocks format to a ProseMirror/Tiptap doc.
 *
 * The receiving Tiptap editor must register StarterKit with heading levels 1-6,
 * the Table/TableRow/TableHeader/TableCell extensions, Image configured as
 * inline and extended with position/size/caption attributes, TextStyle, Link,
 * and a custom factCard node. The returned document is never written automatically.
 */
export function legacyBlocksToTiptapDocument(blocks) {
  const content = (Array.isArray(blocks) ? blocks : [])
    .map(legacyBlockToTiptapNode)
    .filter(Boolean);

  return {
    type: 'doc',
    content: content.length ? content : [EMPTY_PARAGRAPH],
  };
}
