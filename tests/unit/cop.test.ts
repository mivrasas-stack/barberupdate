import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCopDigits,parseCopDigits} from '../../src/utils/cop';
import {formatCurrency} from '../../src/utils/formatters';

test('COP amounts use Colombian grouping and never invent USD/EUR conversion',()=>{
 assert.equal(formatCopDigits(null),'');
 assert.equal(formatCopDigits(0),'0');
 assert.equal(formatCopDigits(120000),'120.000');
 assert.match(formatCurrency(120000,'COP'),/\$\s*120\.000/);
 assert.equal(formatCurrency(120000,'USD'),formatCurrency(120000,'COP'),
   'Deprecated currency preference cannot silently convert stored COP integers');
 assert.equal(formatCurrency(0,'COP'),formatCurrency(0,'COP'));
});
test('blank inputs remain blank and typed values are whole pesos',()=>{
 assert.equal(parseCopDigits(''),null);
 assert.equal(parseCopDigits('   '),null);
 assert.equal(parseCopDigits('0'),0);
 assert.equal(parseCopDigits('120000'),120000);
 assert.equal(parseCopDigits('120.000'),120000);
 assert.equal(parseCopDigits('12,5'),null,'Fractional COP strings must not be silently reinterpreted');
 assert.equal(parseCopDigits('-1'),null);
 assert.equal(parseCopDigits('Infinity'),null);
 assert.equal(parseCopDigits('999999999999999999999999'),null);
});
