import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("https://energyos-tan.vercel.app/", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3000);

const report = await page.evaluate(() => {
  const lights = document.querySelectorAll(".season-lights i");
  const snow = document.querySelectorAll(".season-snow");
  const layer = document.querySelector(".season-layer");
  const LightsBb = lights.length ? lights[0].getBoundingClientRect() : null;
  const snowBb = snow.length ? snow[0].getBoundingClientRect() : null;
  const layerCss = layer ? getComputedStyle(layer) : null;
  const lightsCss = lights.length ? getComputedStyle(lights[0]) : null;
  const santaHat = document.querySelector(".season-logo-accessory");
  const navLogoArea = document.querySelector("header, nav, [class*=sidebar]");
  const svgsInHeader = document.querySelectorAll("header svg, nav svg, h1 svg");
  return {
    layer: layer ? {
      display: layerCss.display, visibility: layerCss.visibility, zIndex: layerCss.zIndex,
      position: layerCss.position, width: layerCss.width, height: layerCss.height,
      pointerEvents: layerCss.pointerEvents,
      bbox: { x: layer.getBoundingClientRect().x, y: layer.getBoundingClientRect().y, w: layer.getBoundingClientRect().width, h: layer.getBoundingClientRect().height },
    } : null,
    lights: lights.length ? {
      count: lights.length,
      css: lightsCss && { display: lightsCss.display, visibility: lightsCss.visibility, zIndex: lightsCss.zIndex, position: lightsCss.position },
      bbox: LightsBb && { x: LightsBb.x, y: LightsBb.y, w: LightsBb.width, h: LightsBb.height },
      viewportTop: window.innerHeight,
    } : null,
    snow: snow.length ? {
      count: snow.length,
      sample: snow[0].getBoundingClientRect().toJSON(),
      css: (() => { const cs = getComputedStyle(snow[0]); return { display: cs.display, visibility: cs.visibility, animationName: cs.animationName }; })(),
    } : null,
    santaHat: santaHat ? santaHat.getBoundingClientRect().toJSON() : null,
    headerHasSanta: svgsInHeader.length,
  };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
