import { config } from '@tamagui/config'
import { createTamagui } from '@tamagui/core'

const tamaguiConfig = createTamagui(config)

export default tamaguiConfig

export type Conf = typeof tamaguiConfig

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
}