import { Node, mergeAttributes } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';

const ImageWithMetadata = Image.extend({
  inline: true,

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
