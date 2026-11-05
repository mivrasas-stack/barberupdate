import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBookingWhatsAppPhone} from '../../src/utils/whatsappPhone';

test('Colombian mobile numbers become the same E.164 value in booking and consent',()=>{
  assert.equal(normalizeBookingWhatsAppPhone('300 123 4567'),'+573001234567');
  assert.equal(normalizeBookingWhatsAppPhone('573001234567'),'+573001234567');
  assert.equal(normalizeBookingWhatsAppPhone('+57 (300) 123-4567'),'+573001234567');
  assert.equal(normalizeBookingWhatsAppPhone('+34600111222'),'+34600111222');
  assert.equal(normalizeBookingWhatsAppPhone('600111222'),null);
  assert.equal(normalizeBookingWhatsAppPhone('300123456'),null);
  assert.equal(normalizeBookingWhatsAppPhone(''),null);
});
