import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs"

const base = "node_modules/pdfjs-dist"
if (existsSync(`${base}/build/pdf.worker.min.mjs`)) {
    mkdirSync("public/pdfjs", { recursive: true })
    copyFileSync(`${base}/build/pdf.worker.min.mjs`, "public/pdf.worker.min.mjs")
    cpSync(`${base}/standard_fonts`, "public/pdfjs/standard_fonts", { recursive: true })
    cpSync(`${base}/cmaps`, "public/pdfjs/cmaps", { recursive: true })
    console.log("pdf.js worker, standard fonts and cmaps copied to public/")
}
