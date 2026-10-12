import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixture} from './fixtures.mjs';
const dir=dirname(fileURLToPath(import.meta.url)),manifest=[];
const slug=text=>text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
test.beforeEach(async({page})=>{
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(!path.startsWith('/api/'))return route.continue();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:fixture(path)})});
  });
  await page.clock.setFixedTime(new Date('2026-10-12T09:00:00Z'));
});
async function capture(page,name,section='top'){
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.skeleton:visible')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText("This board didn't load");
  await expect(page.locator('body')).not.toContainText("Something went wrong");
  await page.screenshot({path:join(dir,name+'.png'),fullPage:false,animations:'disabled',caret:'hide'});
  manifest.push({file:name+'.png',route:new URL(page.url()).pathname,section,viewport:{width:1920,height:1080},mockData:true});
}
async function auth(page){await page.addInitScript(()=>localStorage.setItem('gridly_accessToken','portfolio-local-fixture'));}
test('public pages and landing sections',async({page})=>{
  for(const [name,path] of [['01-home','/'],['02-login','/login'],['03-signup','/signup']]){
    await page.goto(path,{waitUntil:'networkidle'});
    await expect(page.locator('h1').first()).toBeVisible();
    await capture(page,name);
    if(path==='/'){
      const headings=page.locator('h2');
      for(let i=0;i<await headings.count();i++){
        const h=headings.nth(i),label=(await h.innerText()).trim().replace(/\s+/g,' ');
        await h.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
        await page.evaluate(()=>window.scrollBy(0,-100));
        await capture(page,`01-home-${i+1}-${slug(label)}`,label);
      }
    }
  }
});
test('workspace screens',async({page})=>{
  await auth(page);
  await page.goto('/workspaces',{waitUntil:'networkidle'});
  await expect(page.getByText('Acme Studio',{exact:true})).toBeVisible();
  await capture(page,'04-workspaces');
  await page.getByRole('button',{name:'New Workspace',exact:true}).click();
  await expect(page.getByPlaceholder(/^Workspace Name/)).toBeVisible();
  await page.getByPlaceholder(/^Workspace Name/).fill('Customer Experience');
  await capture(page,'05-new-workspace-form');
  await page.goto('/w/acme-studio',{waitUntil:'networkidle'});
  await expect(page.getByText('Q4 Product Roadmap',{exact:true})).toBeVisible();
  await capture(page,'06-workspace-boards');
  await page.getByRole('button',{name:'Analytics',exact:true}).click();
  await expect(page.locator('svg.recharts-surface').first()).toBeVisible();
  await capture(page,'07-workspace-analytics');
  await page.getByRole('button',{name:'Boards',exact:true}).click();
  await page.getByRole('button',{name:/^New board$/i}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page,'08-new-board-dialog');
});
test('board views and dialogs',async({page})=>{
  await auth(page);
  await page.goto('/boards/board-1',{waitUntil:'networkidle'});
  await expect(page.getByRole('heading',{name:'Q4 Product Roadmap'})).toBeVisible();
  await capture(page,'09-board-kanban');
  for(const view of ['Table','Calendar','Timeline','Analytics']){
    await page.getByRole('button',{name:view,exact:true}).click();
    await expect(page.getByRole('button',{name:view,exact:true})).toHaveAttribute('aria-pressed','true');
    if(view==='Analytics')await expect(page.locator('svg.recharts-surface').first()).toBeVisible();
    await capture(page,'10-board-'+slug(view));
  }
  await page.getByRole('button',{name:'Board',exact:true}).click();
  await page.getByText('Customer onboarding research',{exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page,'11-task-detail');
  await page.getByRole('dialog').evaluate(el=>el.scrollTop=el.scrollHeight);
  await capture(page,'11-task-detail-fields','assignees, custom fields and dependencies');
  await page.getByRole('dialog').evaluate(el=>el.scrollTop=0);
  for(const tab of ['Checklist','Comments','Files']){
    await page.getByRole('dialog').getByRole('button',{name:new RegExp('^'+tab)}).click();
    if(tab==='Comments')await expect(page.getByText('The research notes look great.',{exact:false})).toBeVisible();
    if(tab==='Files')await expect(page.getByText('onboarding-research.pdf',{exact:true})).toBeVisible();
    await capture(page,'12-task-detail-'+slug(tab),tab);
  }
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Board settings',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page,'13-board-settings');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Members',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page,'14-board-members');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Activity',exact:true}).click();
  await expect(page.getByText('Activity',{exact:true}).last()).toBeVisible();
  await capture(page,'15-board-activity');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.cmd-k-modal')).toBeVisible();
  await capture(page,'16-command-palette');
});
test.afterAll(()=>writeFileSync(join(dir,'manifest.json'),JSON.stringify({capturedOn:'2026-10-12',viewport:{width:1920,height:1080},backendRunning:false,screenshots:manifest},null,2)));
