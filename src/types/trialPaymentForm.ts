import type { Dispatch, SetStateAction } from 'react'

export type TrialPaymentFormValues = {
  fullName: string
  furigana: string
  email: string
  koreanLevel: string
  inquiry: string
}

export type TrialPaymentCalendarState = {
  view: Date
  selected: Date
}

export type TrialPaymentFormSet = Dispatch<SetStateAction<TrialPaymentFormValues>>
export type TrialPaymentCalendarSet = Dispatch<SetStateAction<TrialPaymentCalendarState>>
