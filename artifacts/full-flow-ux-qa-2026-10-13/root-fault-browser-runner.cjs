const { chromium, webkit, devices, expect } = require('/Users/stanley/Workspace/worktrees/faroway-ux-qa/node_modules/@playwright/test');
const fs = require('fs');
const base = 'http://localhost:3125';
const out = '/Users/stanley/Workspace/worktrees/faroway-ux-qa/artifacts/full-flow-ux-qa-2026-10-13';
(async () => {
 const results = [];
 for (const [name, engine, options] of [['desktop',chromium,{viewport:{width:1440,height:1000}}],['mobile-safari',webkit,devices['iPhone 14']],['mobile-chrome',chromium,devices['Pixel 7']]]) {
  const browser = await engine.launch();
  try {
   const context = await browser.newContext(options);
   await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
   const page = await context.newPage();
   const response = await page.goto(base+'/qa-root-fault');
   const heading = page.getByRole('heading',{name:'This page couldn’t load',exact:true});
   await expect(heading).toBeVisible(); await expect(heading).toBeFocused();
   await expect(page.locator('body')).not.toContainText('QA-only root layout fault');
   if (!(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth))) throw Error('Horizontal overflow');
   const screenshot=out+'/root-fault-'+name+'.png'; await page.screenshot({path:screenshot,fullPage:true});
   await page.keyboard.press(name === 'mobile-safari' ? 'Alt+Tab' : 'Tab'); await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeFocused();
   await page.keyboard.press('Enter'); await expect(heading).toBeVisible();
   await expect(page.getByRole('link',{name:'Go home',exact:true})).toHaveAttribute('href','/');
   const homeNavigation=page.waitForEvent('request',req=>req.isNavigationRequest() && req.url()===base+'/');
   await page.getByRole('link',{name:'Go home',exact:true}).click();
   await homeNavigation; await page.waitForURL(base+'/'); await expect(heading).toHaveCount(0);
   await expect(page.locator('#main-content')).toBeVisible(); await expect(page.locator('#main-content h1')).toBeVisible();
   results.push({name,status:response.status(),focusedHeading:true,keyboardRetry:true,persistentFaultStillRecoverable:true,homeDocumentNavigation:true,noOverflow:true,screenshot});
   console.log(name,'passed');
  } finally { await browser.close(); }
 }
 fs.writeFileSync(out+'/root-fault-browser-acceptance.json',JSON.stringify({scope:'Actual Next production root-layout throw in isolated QA worktree; no provider or private writes',results},null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
