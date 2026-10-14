import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/unified',
 testMatch:/.*\.spec\.js$/,
 fullyParallel:false,
 workers:1,
 timeout:30000,
 expect:{timeout:12000},
 reporter:'list',
 use:{
  baseURL:'http://localhost:3000',
  ...devices['Desktop Chrome'],
  screenshot:'only-on-failure',
  trace:'retain-on-failure'
 },
 webServer:{
  command:'node node_modules/vite/bin/vite.js --host localhost --port 3000 --strictPort',
  url:'http://localhost:3000/',
  reuseExistingServer:true,
  timeout:30000
 }
});