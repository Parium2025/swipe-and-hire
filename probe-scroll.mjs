import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 393, height: 571 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.goto('https://id-preview--09c4e686-17a9-467e-89b1-3cf832371d49.lovable.app/jobbsokare', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
const snap = async (label) => {
  const data = await page.evaluate(() => {
    const root = document.querySelector('[data-landing-scroll-root]');
    const stage = document.querySelector('[data-hero-intro-stage]');
    const gallery = document.getElementById('sa-funkar-det');
    const strip = document.querySelector('.phg-strip');
    const visibleText = document.elementFromPoint(innerWidth/2, innerHeight/2)?.textContent?.slice(0,80);
    return {
      y: root?.scrollTop ?? document.scrollingElement?.scrollTop,
      rootOverflow: root ? getComputedStyle(root).overflowY : null,
      rootScrollHeight: root?.scrollHeight,
      rootClientHeight: root?.clientHeight,
      stage: stage?.getBoundingClientRect().toJSON(),
      gallery: gallery?.getBoundingClientRect().toJSON(),
      phgX: strip ? getComputedStyle(strip).transform : null,
      phgProgress: gallery?.querySelector('.phg-section')?.style.getPropertyValue('--phg-progress'),
      visibleText,
    };
  });
  console.log(label, JSON.stringify(data));
};
await snap('start');
for (let i=0;i<4;i++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(1400); await snap('down'+i); }
for (let i=0;i<2;i++) { await page.mouse.wheel(0, -250); await page.waitForTimeout(1400); await snap('up'+i); }
await browser.close();
