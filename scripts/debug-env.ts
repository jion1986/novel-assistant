import { config } from 'dotenv'
config({ path: ['.env.local', '.env'], override: true })

console.log('KIMI_API_KEY exists:', !!process.env.KIMI_API_KEY)
console.log('KIMI_API_KEY length:', process.env.KIMI_API_KEY?.length)
console.log('KIMI_BASE_URL:', process.env.KIMI_BASE_URL)

import { getAvailableModels } from '../lib/ai/multiModelClient'
console.log('Models:', JSON.stringify(getAvailableModels()))
