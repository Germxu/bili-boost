import './style.css'
import { CAPTURE_FRAME_MESSAGE, FEATURE_META } from '../shared/constants'
import { getSettings, setFeatureEnabled, setSpeedWheelSettings } from '../shared/storage'
import type { FeatureId } from '../shared/types'

const list = document.querySelector<HTMLElement>('#feature-list')!
const status = document.querySelector<HTMLElement>('#status')!
const rememberCheckbox = document.querySelector<HTMLInputElement>('#speed-remember')!
const captureBtn = document.querySelector<HTMLButtonElement>('#capture-frame')!

function flashSaved(): void {
  status.textContent = '设置已保存'
  window.setTimeout(() => {
    status.textContent = ''
  }, 1500)
}

async function render(): Promise<void> {
  const settings = await getSettings()
  list.replaceChildren()

  ;(Object.keys(FEATURE_META) as FeatureId[]).forEach((id) => {
    const meta = FEATURE_META[id]
    const row = document.createElement('label')
    row.className = 'feature-row'

    const text = document.createElement('span')
    text.className = 'feature-text'
    const title = document.createElement('strong')
    title.textContent = meta.name
    const desc = document.createElement('small')
    desc.textContent = meta.description
    text.append(title, desc)

    const toggle = document.createElement('span')
    toggle.className = 'switch'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'switch-input'
    checkbox.checked = settings.features[id]
    checkbox.dataset.id = id
    const track = document.createElement('span')
    track.className = 'switch-track'
    const thumb = document.createElement('span')
    thumb.className = 'switch-thumb'
    track.appendChild(thumb)
    toggle.append(checkbox, track)

    row.append(text, toggle)
    list.appendChild(row)
  })

  rememberCheckbox.checked = settings.speedWheel.remember
}

list.addEventListener('change', async (event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  const id = event.target.dataset.id as FeatureId
  await setFeatureEnabled(id, event.target.checked)
  flashSaved()
})

rememberCheckbox.addEventListener('change', async () => {
  await setSpeedWheelSettings({ remember: rememberCheckbox.checked })
  flashSaved()
})

captureBtn.addEventListener('click', async () => {
  const [ tab ] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    status.textContent = '无法获取当前页面'
    return
  }
  try {
    await chrome.tabs.sendMessage(tab.id, CAPTURE_FRAME_MESSAGE)
    status.textContent = '截图指令已发送'
  } catch {
    status.textContent = '未就绪，请刷新视频页'
  }
  window.setTimeout(() => {
    status.textContent = ''
  }, 1800)
})

void render()
