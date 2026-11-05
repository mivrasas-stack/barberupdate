import test from 'node:test';
import assert from 'node:assert/strict';
import {formatTime} from '../../src/utils/formatters';

test('appointment clock displays Colombia 12h labels while preserving internal 24h values',()=>{
 assert.equal(formatTime('00:00'),'12:00 a. m.');
 assert.equal(formatTime('09:00'),'9:00 a. m.');
 assert.equal(formatTime('12:00'),'12:00 p. m.');
 assert.equal(formatTime('18:30'),'6:30 p. m.');
 assert.equal(formatTime('22:00'),'10:00 p. m.');
 assert.equal(formatTime(''),'');
 assert.equal(formatTime('sin horario'),'sin horario');
});
