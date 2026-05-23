import { UnknownAction } from '@reduxjs/toolkit'

interface InitialState {
  type: string | null
  payload: unknown
  meta: unknown
  error: boolean
  count: number
}

const initialState: InitialState = {
  type: null,
  payload: null,
  meta: null,
  error: false,
  count: 0,
}

export const actionReducer = (
  state = initialState,
  action: UnknownAction,
): InitialState => {
  return {
    type: action.type ?? null,
    payload: 'payload' in action ? structuredClone(action.payload) : null,
    meta: 'meta' in action ? structuredClone(action.meta) : null,
    error: !!action.error,
    count: state.count + 1,
  }
}
