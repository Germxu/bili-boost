import './style.css'
import { FEATURE_META } from '../shared/constants'
import { getSettings, setFeatureEnabled, setSpeedWheelSettings } from '../shared/storage'
import type { FeatureId, SpeedStep } from '../shared/types'

const list = document.querySelector<HTMLElement>('#feature-list')!
const status = document.querySelector<HTMLElement>('#status')!
const stepSelect = document.querySelector<HTMLSelectElement>('#speed-step')!
const rememberCheckbox = document.querySelector<HTMLInputElement>('#speed-remember')!

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

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = settings.features[id]
    checkbox.dataset.id = id

    row.append(text, checkbox)
    list.appendChild(row)
  })

  stepSelect.value = String(settings.speedWheel.step)
  rememberCheckbox.checked = settings.speedWheel.remember
}

list.addEventListener('change', async (event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  const id = event.target.dataset.id as FeatureId
  await setFeatureEnabled(id, event.target.checked)
  flashSaved()
})

stepSelect.addEventListener('change', async () => {
  await setSpeedWheelSettings({ step: Number(stepSelect.value) as SpeedStep })
  flashSaved()
})

rememberCheckbox.addEventListener('change', async () => {
  await setSpeedWheelSettings({ remember: rememberCheckbox.checked })
  flashSaved()
})

void render()
