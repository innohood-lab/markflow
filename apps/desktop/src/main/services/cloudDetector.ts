import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export type CloudProvider = 'gdrive' | 'onedrive' | 'dropbox' | 'icloud' | 'custom'

export interface DetectedCloudAccount {
  id: string
  provider: CloudProvider
  name: string
  path: string
  isAvailable: boolean
  isReadOnly?: boolean
}

/**
 * Automatically detect all installed cloud storage sync folders on Windows and macOS.
 */
export function detectCloudStorageFolders(customFolders: Array<{ id: string; name: string; path: string }> = []): DetectedCloudAccount[] {
  const home = os.homedir()
  const detected: DetectedCloudAccount[] = []

  // 1. Google Drive Detection
  if (process.platform === 'win32') {
    // Check common virtual drive letters for Google Drive (G:, H:, etc.)
    const driveLetters = ['G', 'H', 'I', 'F', 'D', 'E']
    let gdriveFound = false
    for (const letter of driveLetters) {
      const rootDrive = `${letter}:\\`
      const myDriveKo = path.join(rootDrive, '내 드라이브')
      const myDriveEn = path.join(rootDrive, 'My Drive')

      if (fs.existsSync(myDriveKo)) {
        detected.push({
          id: `gdrive-${letter}`,
          provider: 'gdrive',
          name: `Google Drive (${letter}:)`,
          path: myDriveKo,
          isAvailable: true
        })
        gdriveFound = true
        break
      } else if (fs.existsSync(myDriveEn)) {
        detected.push({
          id: `gdrive-${letter}`,
          provider: 'gdrive',
          name: `Google Drive (${letter}:)`,
          path: myDriveEn,
          isAvailable: true
        })
        gdriveFound = true
        break
      }
    }
    if (!gdriveFound) {
      const legacyPath = path.join(home, 'Google Drive')
      if (fs.existsSync(legacyPath)) {
        detected.push({
          id: 'gdrive-local',
          provider: 'gdrive',
          name: 'Google Drive',
          path: legacyPath,
          isAvailable: true
        })
      }
    }
  } else if (process.platform === 'darwin') {
    const cloudStorageDir = path.join(home, 'Library', 'CloudStorage')
    if (fs.existsSync(cloudStorageDir)) {
      try {
        const entries = fs.readdirSync(cloudStorageDir)
        for (const entry of entries) {
          if (entry.startsWith('GoogleDrive-')) {
            const email = entry.replace('GoogleDrive-', '')
            const fullPath = path.join(cloudStorageDir, entry, '내 드라이브')
            const enPath = path.join(cloudStorageDir, entry, 'My Drive')
            const finalPath = fs.existsSync(fullPath) ? fullPath : fs.existsSync(enPath) ? enPath : path.join(cloudStorageDir, entry)

            detected.push({
              id: `gdrive-${email}`,
              provider: 'gdrive',
              name: `Google Drive (${email})`,
              path: finalPath,
              isAvailable: true
            })
          }
        }
      } catch {}
    }
  }

  // 2. Microsoft OneDrive Detection
  const oneDrivePaths: Array<{ name: string; path?: string }> = [
    { name: 'OneDrive (개인용)', path: process.env['OneDriveConsumer'] },
    { name: 'OneDrive (업무용)', path: process.env['OneDriveCommercial'] },
    { name: 'OneDrive', path: process.env['OneDrive'] || path.join(home, 'OneDrive') }
  ]

  if (process.platform === 'darwin') {
    const cloudStorageDir = path.join(home, 'Library', 'CloudStorage')
    if (fs.existsSync(cloudStorageDir)) {
      try {
        const entries = fs.readdirSync(cloudStorageDir)
        for (const entry of entries) {
          if (entry.startsWith('OneDrive-')) {
            const accName = entry.replace('OneDrive-', '')
            oneDrivePaths.push({
              name: `OneDrive (${accName})`,
              path: path.join(cloudStorageDir, entry)
            })
          }
        }
      } catch {}
    }
  }

  const seenOneDrive = new Set<string>()
  for (const od of oneDrivePaths) {
    if (od.path && fs.existsSync(od.path) && !seenOneDrive.has(od.path.toLowerCase())) {
      seenOneDrive.add(od.path.toLowerCase())
      detected.push({
        id: `onedrive-${path.basename(od.path)}`,
        provider: 'onedrive',
        name: od.name,
        path: od.path,
        isAvailable: true
      })
    }
  }

  // 3. Dropbox Detection
  const dropboxInfoPaths = [
    path.join(process.env['APPDATA'] || '', 'Dropbox', 'info.json'),
    path.join(process.env['LOCALAPPDATA'] || '', 'Dropbox', 'info.json'),
    path.join(home, '.dropbox', 'info.json')
  ]

  let dropboxFound = false
  for (const infoPath of dropboxInfoPaths) {
    if (fs.existsSync(infoPath)) {
      try {
        const content = fs.readFileSync(infoPath, 'utf-8')
        const parsed = JSON.parse(content)
        if (parsed.personal?.path && fs.existsSync(parsed.personal.path)) {
          detected.push({
            id: 'dropbox-personal',
            provider: 'dropbox',
            name: 'Dropbox (Personal)',
            path: parsed.personal.path,
            isAvailable: true
          })
          dropboxFound = true
        }
        if (parsed.business?.path && fs.existsSync(parsed.business.path)) {
          detected.push({
            id: 'dropbox-business',
            provider: 'dropbox',
            name: 'Dropbox (Business)',
            path: parsed.business.path,
            isAvailable: true
          })
          dropboxFound = true
        }
      } catch {}
    }
  }

  if (!dropboxFound) {
    const defaultDropbox = path.join(home, 'Dropbox')
    if (fs.existsSync(defaultDropbox)) {
      detected.push({
        id: 'dropbox-default',
        provider: 'dropbox',
        name: 'Dropbox',
        path: defaultDropbox,
        isAvailable: true
      })
    }
  }

  // 4. Apple iCloud Drive Detection
  if (process.platform === 'win32') {
    const winICloud = path.join(home, 'iCloudDrive')
    if (fs.existsSync(winICloud)) {
      detected.push({
        id: 'icloud-windows',
        provider: 'icloud',
        name: 'iCloud Drive',
        path: winICloud,
        isAvailable: true
      })
    }
  } else if (process.platform === 'darwin') {
    const macICloud = path.join(home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs')
    if (fs.existsSync(macICloud)) {
      detected.push({
        id: 'icloud-mac',
        provider: 'icloud',
        name: 'iCloud Drive',
        path: macICloud,
        isAvailable: true
      })
    }
  }

  // 5. Custom User-Registered Folders
  for (const cf of customFolders) {
    if (cf.path && fs.existsSync(cf.path)) {
      detected.push({
        id: cf.id || `custom-${cf.name}`,
        provider: 'custom',
        name: cf.name || path.basename(cf.path),
        path: cf.path,
        isAvailable: true
      })
    }
  }

  return detected
}
