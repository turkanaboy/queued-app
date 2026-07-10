import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const packageUrl = new URL('../ios/App/CapApp-SPM/Package.swift', import.meta.url)
const packagePath = fileURLToPath(packageUrl)
const windowsPath = String.raw`..\..\..\node_modules\@capacitor\app`
const portablePath = '../../../node_modules/@capacitor/app'
const source = await readFile(packagePath, 'utf8')
const normalized = source.replaceAll(windowsPath, portablePath)

if (!normalized.includes(`path: "${portablePath}"`)) {
  throw new Error(`CapacitorApp path was not found in ${packagePath}`)
}

if (normalized !== source) {
  await writeFile(packagePath, normalized)
}
