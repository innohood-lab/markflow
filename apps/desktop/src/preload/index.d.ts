import { MarkFlowApi } from './index'

declare global {
  interface Window {
    markflowApi: MarkFlowApi
  }
}
