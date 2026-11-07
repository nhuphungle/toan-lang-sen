import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeAttr } from '../public/src/dom.js';

test('isSafeAttr: allowlist, chặn on*/style/href/src/srcdoc', () => {
  for (const [n, v] of [['class', 'a'], ['aria-label', 'x'], ['data-autofocus', true], ['maxlength', '20'], ['viewBox', '0 0 1 1']]) assert.equal(isSafeAttr(n, v), true, n);
  for (const n of ['onclick', 'onerror', 'style', 'href', 'src', 'srcdoc', 'formaction', 'xlink:href', 'is', 'ONCLICK']) assert.equal(isSafeAttr(n, 'x'), false, n);
  assert.equal(isSafeAttr('class', { toString: () => 'x' }), false);
  assert.equal(isSafeAttr(5, 'x'), false);
});
