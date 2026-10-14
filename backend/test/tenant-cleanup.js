// Only for test fixtures created by live-api.test.js.
// Never call this with an arbitrary tenant. All queries are tenant-scoped and transactional.
export async function cleanupTestTenant(pool,tenantId){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const t=await client.query('SELECT slug FROM public.tenants WHERE id=$1 FOR UPDATE',[tenantId]);
    if(!t.rowCount) {await client.query('COMMIT');return false;}
    if(!/^barberos-itest-[a-f0-9]{16}$/.test(t.rows[0].slug))
      throw new Error('Refusing to delete a non-test tenant');
    // Explicit deletion prevents unordered FK-cascade conflicts.
    const order=[
      'manual_refunds','manual_payments','order_items','inventory_movements','orders','reviews','loyalty_events',
      'loyalty_accounts','appointments','barber_time_off','barber_work_intervals',
      'cash_closings','transactions','tenant_subscriptions','media_assets',
      'outbox_events','products','services','barbers'
    ];
    for(const table of order){
      await client.query('DELETE FROM public.'+table+' WHERE tenant_id=$1',[tenantId]);
    }
    // Owner membership is intentionally immutable while the tenant exists.
    // Parent deletion invokes the FK cascade after the parent row is removed.
    const removed=await client.query('DELETE FROM public.tenants WHERE id=$1 RETURNING id',[tenantId]);
    if(removed.rowCount!==1) throw new Error('Unexpected tenant deletion count');
    await client.query('COMMIT');
    return true;
  }catch(e){
    await client.query('ROLLBACK').catch(()=>{});
    throw e;
  }finally{client.release();}
}
