import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',
 testMatch:'connection.spec.js',
 workers:1,
 fullyParallel:false,
 timeout:130000,
 reporter:'list',
 use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:3001',
   screenshot:'only-on-failure',trace:'retain-on-failure'},
 webServer:{
  command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3001 --strictPort',
  url:'http://127.0.0.1:3001/login',
  reuseExistingServer:true,
  timeout:60000
 }
});
