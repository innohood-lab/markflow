import { spawn, exec, ChildProcess } from 'child_process'
import * as net from 'net'
import * as path from 'path'
import * as crypto from 'crypto'
import { createRequire } from 'module'

const nodeRequire = createRequire(import.meta.url)
const app: any = (() => {
  if (!process.versions?.electron) return null
  try {
    return nodeRequire('electron')?.app ?? null
  } catch {
    return null
  }
})()

export interface EngineStatus {
  state: 'starting' | 'ready' | 'error' | 'stopped'
  port: number | null
  version?: string
  markitdownVersion?: string
  error?: string
}

export class SidecarManager {
  private childProcess: ChildProcess | null = null
  private port: number | null = null
  private secret: string | null = null
  private isShuttingDown: boolean = false
  private restartCount: number = 0
  private maxRestarts: number = 1
  private statusListeners: ((status: EngineStatus) => void)[] = []
  private currentStatus: EngineStatus = {
    state: 'stopped',
    port: null
  }

  constructor() {
    this.registerExitHooks()
  }

  public getStatus(): EngineStatus {
    return { ...this.currentStatus }
  }

  public getSecret(): string | null {
    return this.secret
  }

  public onStatusChange(listener: (status: EngineStatus) => void): () => void {
    this.statusListeners.push(listener)
    // Send current status immediately
    listener(this.getStatus())
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener)
    }
  }

  private setStatus(newStatus: Partial<EngineStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...newStatus }
    for (const listener of this.statusListeners) {
      try {
        listener(this.getStatus())
      } catch (err) {
        console.error('[Sidecar] Error in status listener:', err)
      }
    }
  }


  /**
   * Find an available unused TCP port on 127.0.0.1
   */
  public async getAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer()
      server.unref()
      server.on('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as net.AddressInfo
        const port = address.port
        server.close((err) => {
          if (err) reject(err)
          else resolve(port)
        })
      })
    })
  }

  /**
   * Start the sidecar engine
   */
  public async start(): Promise<EngineStatus> {
    if (this.currentStatus.state === 'starting' || this.currentStatus.state === 'ready') {
      return this.getStatus()
    }

    this.isShuttingDown = false

    try {
      this.port = await this.getAvailablePort()
      this.secret = crypto.randomBytes(32).toString('hex')
      this.setStatus({
        state: 'starting',
        port: this.port,
        error: undefined
      })

      console.log(`[Sidecar] Selected dynamic port: ${this.port}`)

      const isPackaged = app?.isPackaged ?? false
      let cmd: string
      let args: string[]
      let cwd: string

      if (!isPackaged) {
        // Development mode: prefer engine/.venv python directly for fast, reliable startup, fallback to uv
        const fs = await import('fs')
        const appPath = app?.getAppPath ? app.getAppPath() : process.cwd()
        const candidates = [
          path.resolve(appPath, '../../engine'),
          path.resolve(appPath, '../engine'),
          path.resolve(process.cwd(), 'engine'),
          path.resolve(__dirname, '../../../../engine')
        ]
        cwd = candidates.find((p) => fs.existsSync(p)) || candidates[0]
        const venvPython =
          process.platform === 'win32'
            ? path.join(cwd, '.venv', 'Scripts', 'python.exe')
            : path.join(cwd, '.venv', 'bin', 'python')

        if (fs.existsSync(venvPython)) {
          cmd = venvPython
          args = [
            '-m',
            'uvicorn',
            'markflow_engine.api:app',
            '--host',
            '127.0.0.1',
            '--port',
            this.port.toString(),
            '--log-level',
            'warning'
          ]
        } else {
          cmd = 'uv'
          args = [
            'run',
            'uvicorn',
            'markflow_engine.api:app',
            '--host',
            '127.0.0.1',
            '--port',
            this.port.toString(),
            '--log-level',
            'warning'
          ]
        }
      } else {
        // Production mode: run packaged executable
        const exeName = process.platform === 'win32' ? 'markflow-engine.exe' : 'markflow-engine'
        cmd = path.join(process.resourcesPath, 'engine', exeName)
        args = ['--port', this.port.toString()]
        cwd = path.join(process.resourcesPath, 'engine')
      }

      console.log(`[Sidecar] Spawning engine: ${cmd} in ${cwd}`)

      this.childProcess = spawn(cmd, args, {
        cwd,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          MARKFLOW_ENGINE_SECRET: this.secret || ''
        },
        shell: cmd === 'uv' && process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe']
      })

      this.childProcess.stdout?.on('data', (data) => {
        console.log(`[Engine STDOUT] ${data.toString().trim()}`)
      })

      this.childProcess.stderr?.on('data', (data) => {
        console.warn(`[Engine STDERR] ${data.toString().trim()}`)
      })

      this.childProcess.on('error', (err) => {
        console.error('[Sidecar] Process spawn error:', err)
        this.setStatus({
          state: 'error',
          error: `엔진 실행 실패: ${err.message}`
        })
      })

      this.childProcess.on('exit', (code, signal) => {
        console.log(`[Sidecar] Process exited with code ${code}, signal ${signal}`)
        this.childProcess = null

        if (!this.isShuttingDown) {
          if (this.restartCount < this.maxRestarts) {
            this.restartCount++
            console.warn(`[Sidecar] Unexpected exit. Attempting automatic restart (attempt ${this.restartCount}/${this.maxRestarts})...`)
            setTimeout(() => {
              this.start().catch((e) => console.error('[Sidecar] Auto-restart failed:', e))
            }, 1000)
          } else {
            this.setStatus({
              state: 'error',
              error: `변환 엔진이 예기치 않게 종료되었습니다 (종료 코드: ${code}).`
            })
          }
        } else {
          this.setStatus({
            state: 'stopped',
            port: null
          })
        }
      })

      // Wait for health check with 45-second timeout
      const ready = await this.waitForHealth(this.port, 45000)
      if (ready.success) {
        this.restartCount = 0 // Reset restart counter on success
        this.setStatus({
          state: 'ready',
          port: this.port,
          version: ready.version,
          markitdownVersion: ready.markitdownVersion,
          error: undefined
        })
        console.log(`[Sidecar] Engine ready! markitdown version: ${ready.markitdownVersion}`)
      } else {
        this.setStatus({
          state: 'error',
          error: ready.error || '엔진 응답 시간(45초)을 초과했습니다.'
        })
      }

      return this.getStatus()
    } catch (err: any) {
      console.error('[Sidecar] Failed to start:', err)
      this.setStatus({
        state: 'error',
        error: `엔진 시작 중 오류 발생: ${err?.message || err}`
      })
      return this.getStatus()
    }
  }

  /**
   * Poll GET /health until 200 OK or timeout
   */
  private async waitForHealth(
    port: number,
    timeoutMs: number
  ): Promise<{ success: boolean; version?: string; markitdownVersion?: string; error?: string }> {
    const startTime = Date.now()
    const url = `http://127.0.0.1:${port}/health`

    while (Date.now() - startTime < timeoutMs) {
      if (this.isShuttingDown || !this.childProcess) {
        return { success: false, error: '엔진이 시작 도중 중단되었습니다.' }
      }

      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1000) })
        if (response.ok) {
          const data = (await response.json()) as any
          if (data && data.status === 'ok') {
            return {
              success: true,
              version: data.version,
              markitdownVersion: data.markitdown_version
            }
          }
        }
      } catch {
        // Retry silently until timeout
      }

      await new Promise((r) => setTimeout(r, 500))
    }

    return { success: false, error: '15초 내에 엔진 응답을 수신하지 못했습니다.' }
  }

  /**
   * Stop the sidecar engine and clean up all child processes (preventing zombies)
   */
  public async stop(): Promise<void> {
    this.isShuttingDown = true

    if (!this.childProcess && !this.port) {
      this.setStatus({ state: 'stopped', port: null })
      return
    }

    const pid = this.childProcess?.pid
    console.log(`[Sidecar] Stopping engine process (PID: ${pid})...`)

    if (pid) {
      if (process.platform === 'win32') {
        // On Windows, kill entire process tree to prevent python.exe zombie
        try {
          exec(`taskkill /pid ${pid} /T /F`, (error) => {
            if (error) {
              // Process might already be dead
              console.log('[Sidecar] taskkill output:', error.message)
            }
          })
        } catch (e) {
          console.warn('[Sidecar] Failed to run taskkill:', e)
        }
      } else {
        try {
          // Negative PID kills the process group
          process.kill(-pid, 'SIGTERM')
        } catch {
          this.childProcess?.kill('SIGTERM')
        }
      }
    }

    this.childProcess = null
    this.port = null
    this.setStatus({ state: 'stopped', port: null })
  }

  /**
   * Wait until engine transitions out of 'starting' state (up to timeoutMs)
   */
  public async waitForReady(timeoutMs: number = 15000): Promise<boolean> {
    if (this.currentStatus.state === 'ready') return true
    if (this.currentStatus.state === 'stopped' || this.currentStatus.state === 'error') {
      await this.start().catch(() => {})
    }
    const startTime = Date.now()
    while (this.currentStatus.state === 'starting' && Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, 200))
    }
    return this.currentStatus.state === 'ready'
  }

  /**
   * Send document conversion request to Python FastAPI sidecar
   */
  public async convertDocument(
    filePath: string,
    libraryDir?: string,
    profile: string = 'balanced',
    llmConfig?: any
  ): Promise<any> {
    try {
      if (this.currentStatus.state === 'starting') {
        await this.waitForReady(15000)
      }

      if (!this.port || this.currentStatus.state !== 'ready') {
        return {
          status: 'error',
          message:
            this.currentStatus.error ||
            '변환 엔진이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.',
          file_path: filePath
        }
      }

      const url = `http://127.0.0.1:${this.port}/convert`
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (this.secret) {
        headers['X-Engine-Secret'] = this.secret
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_path: filePath,
          library_dir: libraryDir,
          profile,
          llm_config: llmConfig
        })
      })

      if (!res.ok) {
        return {
          status: 'error',
          message: `엔진 응답 오류 (${res.status}): ${res.statusText}`,
          file_path: filePath
        }
      }

      return await res.json()
    } catch (err: any) {
      return {
        status: 'error',
        message: `변환 요청 실패: ${err?.message || err}`,
        file_path: filePath
      }
    }
  }

  /**
   * Register system hooks to guarantee clean exit
   */
  private registerExitHooks(): void {
    const cleanup = () => {
      this.stop().catch(() => {})
    }

    if (app && typeof app.on === 'function') {
      app.on('before-quit', cleanup)
      app.on('will-quit', cleanup)
    }
    process.on('exit', cleanup)
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  }
}
