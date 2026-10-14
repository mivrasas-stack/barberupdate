import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',
 testMatch:/.*\.spec\.js$/,
 fullyParallel:false,
 workers:1,
 timeout:150000,
 expect:{timeout:12000},
 reporter:[['list'],['json',{outputFile:'test-results/playwright-results.json'}]],
 use:{
  baseURL:'http://127.0.0.1:3001',
  ...devices['Desktop Chrome'],
  screenshot:'only-on-failure',
  trace:'retain-on-failure',
  actionTimeout:15000
 },
 webServer:{
  command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3001 --strictPort',
  url:'http://127.0.0.1:3001',
  reuseExistingServer:true,
  timeout:60000
 }
});
