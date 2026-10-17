import { MarkFlowApi, EngineStatus, ConversionRecord } from './index'

export { MarkFlowApi, EngineStatus, ConversionRecord }

declare global {
  interface Window {
    markflowApi: MarkFlowApi
  }
}
