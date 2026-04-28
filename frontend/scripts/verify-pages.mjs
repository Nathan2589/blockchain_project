#!/usr/bin/env node
// Headless verification pass for T9. Loads each route, captures any
// console/page errors, takes light + dark screenshots, repeats at three
// breakpoints. Writes everything under .verify/ for inspection.

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright"

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, "..", ".verify")
const baseUrl = process.env.VERIFY_URL || "http://localhost:5173"

const routes = [
  { path: "/create", name: "create" },
  { path: "/balance", name: "balance" },
  { path: "/buy", name: "buy" },
  { path: "/return", name: "return" },
]
const breakpoints = [
  { width: 360, height: 720, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1280, height: 800, name: "desktop" },
]
const themes = ["dark", "light"]

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const report = []

for (const theme of themes) {
  for (const bp of breakpoints) {
    const ctx = await browser.newContext({
      viewport: { width: bp.width, height: bp.height },
      colorScheme: theme === "dark" ? "dark" : "light",
    })
    // next-themes reads from localStorage; set it before any page script runs.
    await ctx.addInitScript((t) => {
      try {
        window.localStorage.setItem("theme", t)
      } catch {}
    }, theme)
    const page = await ctx.newPage()
    const errors = []
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`[console] ${msg.text()}`)
    })
    page.on("pageerror", (err) => {
      errors.push(`[pageerror] ${err.message}`)
    })

    for (const route of routes) {
      const tag = `${route.name}-${theme}-${bp.name}`
      try {
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle" })
        // give framer-motion a beat to settle
        await page.waitForTimeout(150)
        const screenshot = resolve(outDir, `${tag}.png`)
        await page.screenshot({ path: screenshot, fullPage: bp.width <= 768 })
        const title = await page.title()
        const h1 = await page.locator("h1").first().textContent({ timeout: 1000 }).catch(() => null)
        report.push({
          tag,
          route: route.path,
          theme,
          breakpoint: `${bp.width}x${bp.height}`,
          title,
          h1,
          screenshot: screenshot.replace(`${outDir}/`, ""),
          errors: [...errors],
        })
        errors.length = 0
      } catch (err) {
        report.push({
          tag,
          route: route.path,
          theme,
          breakpoint: `${bp.width}x${bp.height}`,
          error: (err instanceof Error ? err.message : String(err)),
        })
      }
    }
    await ctx.close()
  }
}

await browser.close()

await writeFile(resolve(outDir, "report.json"), JSON.stringify(report, null, 2))

const failures = report.filter((r) => r.error || (r.errors && r.errors.length > 0))
if (failures.length === 0) {
  console.log(`OK: ${report.length} page loads, no console errors.`)
} else {
  console.log(`FAILURES: ${failures.length} of ${report.length}`)
  for (const f of failures) {
    console.log(`  [${f.tag}]`, f.error || f.errors.join("; "))
  }
}
console.log(`Report and screenshots in ${outDir}`)
