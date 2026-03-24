import type { ReportResults, UserInput } from './types'

const WIZARD_KEY = 'mingli_wizard_v1'

export type WizardSnapshot = {
  step: 1 | 2
  input: UserInput | null
  results: ReportResults | null
}

/** 刷新后恢复：停留在第 2 步并保留 input/results，避免回到第 1 步导致误以为要重新生成 */
export function loadWizardSnapshot(): WizardSnapshot {
  if (typeof window === 'undefined') {
    return { step: 1, input: null, results: null }
  }
  try {
    const raw = sessionStorage.getItem(WIZARD_KEY)
    if (!raw) return { step: 1, input: null, results: null }
    const p = JSON.parse(raw) as { step?: number; input?: UserInput; results?: ReportResults }
    if (p.step === 2 && p.input && p.results) {
      return { step: 2, input: p.input, results: p.results }
    }
  } catch {
    /* ignore */
  }
  return { step: 1, input: null, results: null }
}

export function saveWizardSnapshot(step: 1 | 2, input: UserInput | null, results: ReportResults | null) {
  try {
    if (step === 2 && input && results) {
      sessionStorage.setItem(WIZARD_KEY, JSON.stringify({ step: 2, input, results }))
    }
  } catch {
    /* ignore */
  }
}

export function clearWizardSnapshot() {
  try {
    sessionStorage.removeItem(WIZARD_KEY)
  } catch {
    /* ignore */
  }
}
