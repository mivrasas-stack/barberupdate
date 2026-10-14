import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentCapabilities,isValidConfirmation} from '../src/payments.js';

test('Wompi is selected but no live provider can charge money',()=>{
  assert.equal(paymentCapabilities.onlinePayments.providerSelected,null);
  assert.equal(paymentCapabilities.onlinePayments.enabled,false);
  assert.equal(paymentCapabilities.onlinePayments.scope,'barbershop_orders');
  assert.equal(paymentCapabilities.platformBilling.providerSelected,'wompi');
  assert.equal(paymentCapabilities.platformBilling.enabled,false);
  assert.equal(paymentCapabilities.platformBilling.checkoutSurface,'future_landing_page');
  assert.equal(paymentCapabilities.subscriptionBilling.enabled,false);
});
test('Offline collections must be confirmed by staff with transfer evidence',()=>{
  assert.equal(isValidConfirmation('cash',undefined),true);
  assert.equal(isValidConfirmation('transfer',undefined),false);
  assert.equal(isValidConfirmation('transfer',''),false);
  assert.equal(isValidConfirmation('transfer','TR-validated-by-operator'),true);
});
