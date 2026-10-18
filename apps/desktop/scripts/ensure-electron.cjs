#!/usr/bin/env node
/**
 * Ensures the Electron binary is downloaded, extracted, and registered via path.txt.
 * Workaround for Node.js v25+/v26+ where `extract-zip` inside `electron/install.js`
 * prematurely drains the event loop after extracting the first file.
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const childProcess = require('child_process')
const { createRequire } = require('module')

function getPlatformPath(platform) {
  switch (platform) {
    case 'mas':
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron'
    case 'freebsd':
    case 'openbsd':
    case 'linux':
      return 'electron'
    case 'win32':
      return 'electron.exe'
    default:
      throw new Error('Electron builds are not available on platform: ' + platform)
  }
}

async function main() {
  const desktopReq = createRequire(path.join(__dirname, '..', 'package.json'))
  const electronPkgPath = desktopReq.resolve('electron/package.json')
  const electronDir = path.dirname(electronPkgPath)
  const electronReq = createRequire(electronPkgPath)
  const { version } = electronReq('./package.json')

  const platform = process.env.npm_config_platform || os.platform()
  let arch = process.env.npm_config_arch || os.arch()
  if (
    platform === 'darwin' &&
    process.platform === 'darwin' &&
    arch === 'x64' &&
    process.env.npm_config_arch === undefined
  ) {
    try {
      const out = childProcess.execSync('sysctl -in sysctl.proc_translated').toString().trim()
      if (out === '1') arch = 'arm64'
    } catch {
      // ignore
    }
  }

  const platformPath = getPlatformPath(platform)
  const distDir = path.join(electronDir, 'dist')
  const pathTxtFile = path.join(electronDir, 'path.txt')
  const binaryPath = path.join(distDir, platformPath)

  // Fast check if already installed
  try {
    const installedVer = fs.readFileSync(path.join(distDir, 'version'), 'utf-8').replace(/^v/, '').trim()
    const recordedPath = fs.readFileSync(pathTxtFile, 'utf-8').trim()
    if (installedVer === version && recordedPath === platformPath && fs.existsSync(binaryPath)) {
      return
    }
  } catch {
    // Proceed to install
  }

  console.log(`[ensure-electron] Preparing Electron v${version} (${platform}-${arch})...`)
  const { downloadArtifact } = electronReq('@electron/get')
  const checksums =
    process.env.electron_use_remote_checksums ?? process.env.npm_config_electron_use_remote_checksums
      ? undefined
      : electronReq('./checksums.json')

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    force: process.env.force_no_cache === 'true',
    cacheRoot: process.env.electron_config_cache,
    checksums,
    platform,
    arch
  })

  fs.mkdirSync(distDir, { recursive: true })

  if (platform === 'darwin' || platform === 'mas') {
    childProcess.execFileSync('/usr/bin/ditto', ['-x', '-k', zipPath, distDir], { stdio: 'inherit' })
  } else if (platform === 'win32') {
    childProcess.execFileSync('tar', ['-xf', zipPath, '-C', distDir], { stdio: 'inherit' })
  } else {
    childProcess.execFileSync('unzip', ['-q', '-o', zipPath, '-d', distDir], { stdio: 'inherit' })
  }

  const srcTypeDefPath = path.join(distDir, 'electron.d.ts')
  const targetTypeDefPath = path.join(electronDir, 'electron.d.ts')
  if (fs.existsSync(srcTypeDefPath)) {
    fs.renameSync(srcTypeDefPath, targetTypeDefPath)
  }

  fs.writeFileSync(pathTxtFile, platformPath, 'utf-8')
  console.log(`[ensure-electron] Electron v${version} ready at ${binaryPath}`)
}

main().catch((err) => {
  console.error('[ensure-electron] Failed to install Electron binary:', err)
  process.exit(1)
})
