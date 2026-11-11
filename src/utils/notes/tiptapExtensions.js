import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import hljs from 'highlight.js/lib/common';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';

function buildCodeHighlightDecorations(doc) {
  if (typeof document === 'undefined') return DecorationSet.empty;

  const decorations = [];

  doc.descendants((node, position) => {
    if (node.type.name !== 'codeBlock' || !node.textContent) return;

    const source = node.textContent;
    let highlighted;
    try {
      const language = node.attrs.language;
      highlighted = language && hljs.getLanguage(language)
        ? hljs.highlight(source, { language })
        : hljs.highlightAuto(source);
    } catch {
      return;
    }

    const container = document.createElement('div');
    container.innerHTML = highlighted.value;
    let offset = 0;

    const visit = (current, inheritedClasses = []) => {
      if (current.nodeType === 3) {
        const length = current.nodeValue?.length || 0;
        if (length && inheritedClasses.length) {
          decorations.push(Decoration.inline(
            position + 1 + offset,
            position + 1 + offset + length,
            { class: inheritedClasses.join(' ') }
          ));
        }
        offset += length;
        return;
      }

      if (current.nodeType !== 1) return;
      const ownClasses = Array.from(current.classList || []).filter((name) => (
        name.startsWith('hljs-') || name.endsWith('_')
      ));
      const classes = [...new Set([...inheritedClasses, ...ownClasses])];
      Array.from(current.childNodes).forEach((child) => visit(child, classes));
    };

    Array.from(container.childNodes).forEach((child) => visit(child));
  });

  return DecorationSet.create(doc, decorations);
}

const CodeSyntaxHighlight = Extension.create({
  name: 'codeSyntaxHighlight',

  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        decorations: (state) => buildCodeHighlightDecorations(state.doc),
      },
    })];
  },
});

const ImageWithMetadata = Image.extend({
  inline: true,
  group: 'inline',

  addAttributes() {
    return {
      ...this.parent?.(),
      position: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-position') || 'center',
      },
      size: {
        default: 'medium',
        parseHTML: (element) => element.getAttribute('data-size') || 'medium',
      },
      caption: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-caption') || '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span.note-image-wrap',
        getAttrs: (element) => {
          const image = element.querySelector('img');
          if (!image) return false;

          return {
            src: image.getAttribute('src'),
            alt: image.getAttribute('alt'),
            title: image.getAttribute('title'),
            position: element.getAttribute('data-position') || 'center',
            size: element.getAttribute('data-size') || 'medium',
            caption:
              element.getAttribute('data-caption') ||
              element.querySelector('.note-img-caption')?.textContent ||
              '',
          };
        },
      },
      ...(this.parent?.() || []),
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const position = node.attrs.position || 'center';
    const size = node.attrs.size || 'medium';
    const caption = node.attrs.caption || '';
    const imageAttributes = { ...HTMLAttributes };

    delete imageAttributes.position;
    delete imageAttributes.size;
    delete imageAttributes.caption;

    return [
      'span',
      mergeAttributes(
        {
          class: `note-image-wrap note-img-${position} note-img-${size}`,
          'data-position': position,
          'data-size': size,
          ...(caption ? { 'data-caption': caption } : {}),
        }
      ),
      [
        'img',
        mergeAttributes(this.options.HTMLAttributes, imageAttributes, { class: 'note-img' }),
      ],
      ...(caption
        ? [['span', { class: 'note-img-caption' }, caption]]
        : []),
    ];
  },
});

const FactCardExtension = Node.create({
  name: 'factCard',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: (element) =>
          element.querySelector('.note-fact-emoji')?.textContent || '💡',
        renderHTML: () => ({}),
      },
      color: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('data-color') || element.style.color || null,
        renderHTML: (attributes) =>
          attributes.color ? { 'data-color': attributes.color } : {},
      },
      fontStyle: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-font') || null,
        renderHTML: (attributes) =>
          attributes.fontStyle ? { 'data-font': attributes.fontStyle } : {},
      },
    };
  },

  parseHTML() {
    return [{
      tag: 'div.note-fact-card',
      contentElement: '.note-fact-content',
    }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'note-fact-card' }),
      ['span', { class: 'note-fact-emoji', contenteditable: 'false' }, node.attrs.emoji || '💡'],
      ['div', { class: 'note-fact-content' }, 0],
    ];
  },
});

export const notesExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    codeBlock: { HTMLAttributes: { class: 'note-code' } },
  }),
  CodeSyntaxHighlight,
  TextStyleKit.configure({
    color: { types: ['textStyle'] },
    fontFamily: { types: ['textStyle'] },
  }),
  TableKit.configure({
    table: {
      resizable: true,
      HTMLAttributes: { class: 'note-table' },
    },
  }),
  ImageWithMetadata.configure({
    HTMLAttributes: { class: 'note-img' },
  }),
  FactCardExtension,
  Highlight.configure({ multicolor: true }),
  Placeholder.configure({ placeholder: 'Start writing…' }),
];

export { FactCardExtension, ImageWithMetadata };
