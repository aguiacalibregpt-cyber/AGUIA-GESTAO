import { spawnSync } from 'node:child_process'

function check(cmd) {
  const res = spawnSync(cmd, ['--version'], { stdio: 'inherit' })
  if (res.status !== 0) {
    console.error(`Missing prerequisite: ${cmd}`)
    process.exit(1)
  }
}

check('pnpm')
check('rustc')
check('cargo')

const build = spawnSync('pnpm', ['build'], { stdio: 'inherit' })
if (build.status !== 0) process.exit(build.status)

const tauri = spawnSync('pnpm', ['tauri:build'], { stdio: 'inherit' })
process.exit(tauri.status)
