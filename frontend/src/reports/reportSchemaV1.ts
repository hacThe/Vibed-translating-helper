export type CorrectionCategory = 'meaning' | 'diction' | 'grammar' | 'detail'

export type ReportNoteV1 = {
  original_text: string
  occurrence: number
  correction: string
  category: CorrectionCategory
  explanation_en: string
  note_vi: string
  start_offset: number
  end_offset: number
}

export type ReportParagraphV1 = {
  index: number
  translation_text: string
  revised_text: string
  notes: ReportNoteV1[]
}

export type ReportSchemaV1 = {
  schema_version: 'v1'
  revised_title: string
  paragraphs: ReportParagraphV1[]
  revised_article: string
  key_lessons: Array<{
    title: string
    explanation: string
    example: string
  }>
  editing_checklist: Array<{
    title: string
    description: string
  }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isLesson(value: unknown): boolean {
  return isRecord(value)
    && isString(value.title)
    && isString(value.explanation)
    && isString(value.example)
}

function isChecklistItem(value: unknown): boolean {
  return isRecord(value) && isString(value.title) && isString(value.description)
}

export function isReportSchemaV1(value: unknown, submittedTranslation?: string): value is ReportSchemaV1 {
  if (!isRecord(value)
    || value.schema_version !== 'v1'
    || !isString(value.revised_title)
    || !isString(value.revised_article)
    || !Array.isArray(value.paragraphs)
    || !Array.isArray(value.key_lessons)
    || !Array.isArray(value.editing_checklist)
    || !value.key_lessons.every(isLesson)
    || !value.editing_checklist.every(isChecklistItem)) return false

  const paragraphs = value.paragraphs
  const validParagraphs = paragraphs.every((paragraph, paragraphIndex) => {
    if (!isRecord(paragraph)
      || paragraph.index !== paragraphIndex + 1
      || !isString(paragraph.translation_text)
      || !isString(paragraph.revised_text)
      || !Array.isArray(paragraph.notes)) return false

    const translationText = paragraph.translation_text
    let previousEnd = 0
    return paragraph.notes
      .slice()
      .sort((left, right) => {
        if (!isRecord(left) || !isRecord(right)) return 0
        return Number(left.start_offset) - Number(right.start_offset)
      })
      .every((note) => {
        if (!isRecord(note)
          || !isString(note.original_text)
          || typeof note.occurrence !== 'number'
          || !isString(note.correction)
          || !['meaning', 'diction', 'grammar', 'detail'].includes(String(note.category))
          || !isString(note.explanation_en)
          || !isString(note.note_vi)
          || typeof note.start_offset !== 'number'
          || typeof note.end_offset !== 'number'
          || note.start_offset < previousEnd
          || note.end_offset <= note.start_offset
          || translationText.slice(note.start_offset, note.end_offset) !== note.original_text) return false

        previousEnd = note.end_offset
        return true
      })
  })

  if (!validParagraphs) return false
  if (submittedTranslation === undefined) return true

  const submittedParagraphs = submittedTranslation.split(/\r?\n[ \t]*\r?\n/)
  return submittedParagraphs.length === paragraphs.length
    && submittedParagraphs.every((text, index) => {
      const paragraph = paragraphs[index]
      return isRecord(paragraph) && paragraph.translation_text === text
    })
}
