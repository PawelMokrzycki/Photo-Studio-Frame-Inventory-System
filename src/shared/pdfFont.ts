import { jsPDF } from 'jspdf'
import { ARIAL_FONT } from './arialFont'

let fontLoaded = false

export function loadFont(doc: jsPDF): boolean {
  if (fontLoaded) {
    doc.setFont('Arial')
    return true
  }

  try {
    doc.addFileToVFS('arial.ttf', ARIAL_FONT)
    doc.addFont('arial.ttf', 'Arial', 'normal')
    fontLoaded = true
    doc.setFont('Arial')
    return true
  } catch (e) {
    console.error('Font load error:', e)
    return false
  }
}
