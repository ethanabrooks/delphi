import { config } from '@tamagui/config/v3'
import { createTamagui } from '@tamagui/core'

console.log('🔧 Loading Tamagui config...')
console.log('📦 @tamagui/config imported:', typeof config)

const tamaguiConfig = createTamagui(config)

console.log('✅ Tamagui config created:', {
  themes: Object.keys(tamaguiConfig.themes || {}),
  tokens: Object.keys(tamaguiConfig.tokens || {}),
  media: Object.keys(tamaguiConfig.media || {})
})

export default tamaguiConfig

export type Conf = typeof tamaguiConfig

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
}