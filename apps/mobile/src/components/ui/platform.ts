import { Platform } from 'react-native';
import * as Device from 'expo-device';

export const supportsBlur =
  Platform.OS !== 'web' &&
  Device.totalMemory !== null &&
  Device.totalMemory >= 3 * 1024 * 1024 * 1024;
