import { describe, expect, it } from 'vitest';
import { wouldCreateCycle } from './org-tree.js';

const tree = [
  { id: 'board', parentId: null },
  { id: 'gm', parentId: 'board' },
  { id: 'ops', parentId: 'gm' },
  { id: 'tl', parentId: 'ops' },
];

describe('wouldCreateCycle', () => {
  it('allows a normal re-parent and a root', () => {
    expect(wouldCreateCycle(tree, 'tl', 'gm')).toBe(false);
    expect(wouldCreateCycle(tree, 'tl', null)).toBe(false);
  });

  it('rejects a node as its own parent', () => {
    expect(wouldCreateCycle(tree, 'ops', 'ops')).toBe(true);
  });

  it('rejects a descendant as the new parent', () => {
    expect(wouldCreateCycle(tree, 'gm', 'tl')).toBe(true);
    expect(wouldCreateCycle(tree, 'board', 'ops')).toBe(true);
  });

  it('accepts a brand new node under any parent', () => {
    expect(wouldCreateCycle(tree, 'new', 'tl')).toBe(false);
  });
});
